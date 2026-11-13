// カテゴリの初期値と移行処理。純粋な関数。
// 経緯：v1.2 で「野菜・果物」などを分けたが、v1.3 で「・」でまとめた形に戻した（缶詰は残す）。
// v1.12 でまた分け、豆類・お菓子・冷凍を足して並びも変えた（reorganizeCategories）

/** 初期カテゴリ（並び順どおり。v1.12） */
export const DEFAULT_CATEGORIES = [
  '野菜', '果物', '豆類', '乳製品', '肉', '魚', '調味料', '麺', '缶詰',
  '飲料', '日用品', 'パン', '米', '卵', 'お菓子', '冷凍', 'その他',
];

/** v1.11 までのまとめたカテゴリ → v1.12 の名前（先頭の名前に、元のカテゴリの商品が残る） */
export const V12_SPLITS = {
  '野菜・果物': ['野菜', '果物'],
  '肉・魚': ['肉', '魚'],
  '納豆・豆腐': ['豆類'],
  'パン・米・麺': ['パン', '米', '麺'],
};

/** 以前の初期カテゴリ → 分けた後の名前（先頭の名前に、元のカテゴリの商品が残る） */
export const SPLITS = {
  '野菜・果物': ['野菜', '果物'],
  '肉・魚': ['肉', '魚'],
  '納豆・豆腐': ['納豆', '豆腐'],
  'パン・米・麺': ['パン', '米', '麺'],
};

/**
 * 「・」区切りの初期カテゴリを分け、「缶詰」がなければ追加する。
 * 商品・リスト項目は元のカテゴリ（＝先頭の名前に変わる）を指したまま。
 * お店ごとの売り場順では、分けたカテゴリを元の位置の直後に入れる。
 * @param {{categories:Array, storeShelfOrders:Array}} data
 * @param {() => string} newId
 * @returns {{categories:Array, storeShelfOrders:Array, changed:boolean}}
 */
export function splitCategories({ categories, storeShelfOrders }, newId) {
  let changed = false;
  const ordered = [...categories].sort((a, b) => a.defaultOrder - b.defaultOrder);
  const out = [];
  /** 元のカテゴリID → そのあとに入れた新カテゴリID */
  const inserted = new Map();
  const names = new Set(ordered.map((c) => c.name));

  for (const c of ordered) {
    const parts = SPLITS[c.name];
    if (!parts) {
      out.push({ ...c });
      continue;
    }
    changed = true;
    out.push({ ...c, name: parts[0] });
    names.add(parts[0]);
    const added = [];
    for (const name of parts.slice(1)) {
      if (names.has(name)) continue;
      const nc = { id: newId(), name, defaultOrder: 0 };
      out.push(nc);
      names.add(name);
      added.push(nc.id);
    }
    inserted.set(c.id, added);
  }

  if (!names.has('缶詰')) {
    changed = true;
    const at = out.findIndex((c) => c.name === '調味料');
    const nc = { id: newId(), name: '缶詰', defaultOrder: 0 };
    if (at >= 0) out.splice(at, 0, nc);
    else out.push(nc);
  }
  out.forEach((c, i) => (c.defaultOrder = i + 1));

  // お店ごとの売り場順：分けたカテゴリを元の直後に
  const byStore = new Map();
  for (const s of storeShelfOrders) {
    if (!byStore.has(s.storeId)) byStore.set(s.storeId, []);
    byStore.get(s.storeId).push(s);
  }
  const shelf = [];
  for (const [storeId, list] of byStore) {
    const seq = [];
    for (const s of [...list].sort((a, b) => a.sortOrder - b.sortOrder)) {
      seq.push({ ...s });
      for (const cid of inserted.get(s.categoryId) ?? []) seq.push({ id: newId(), storeId, categoryId: cid, sortOrder: 0 });
    }
    seq.forEach((s, i) => (s.sortOrder = i + 1));
    shelf.push(...seq);
  }
  return { categories: out, storeShelfOrders: shelf, changed };
}

/**
 * v1.2 で分けたカテゴリを「・」でまとめた形に戻す（v1.3）。
 * 例：「野菜」「果物」→「野菜・果物」。先頭の名前（野菜）のカテゴリを改名し、
 * ほか（果物）の商品・リスト項目をそこへ移して、ほかのカテゴリと売り場順を消す。
 * まとめた名前のカテゴリがすでにある場合や、自分で作ったカテゴリは変えない。
 * @param {{categories:Array, storeShelfOrders:Array, products:Array, shoppingListItems:Array}} data
 * @returns {{categories:Array, storeShelfOrders:Array, products:Array, shoppingListItems:Array, changed:boolean}}
 */
export function mergeCategories({ categories, storeShelfOrders, products, shoppingListItems }) {
  let cats = categories.map((c) => ({ ...c }));
  let shelf = storeShelfOrders.map((s) => ({ ...s }));
  const prods = products.map((p) => ({ ...p }));
  const items = shoppingListItems.map((i) => ({ ...i }));
  let changed = false;

  for (const [combined, parts] of Object.entries(SPLITS)) {
    if (cats.some((c) => c.name === combined)) continue;
    const found = parts.map((n) => cats.find((c) => c.name === n)).filter(Boolean);
    if (!found.length) continue;
    changed = true;
    const target = found[0];
    target.name = combined;
    const others = new Set(found.slice(1).map((c) => c.id));
    for (const p of prods) if (others.has(p.categoryId)) p.categoryId = target.id;
    for (const i of items) if (others.has(i.categoryId)) i.categoryId = target.id;
    cats = cats.filter((c) => !others.has(c.id));
    shelf = shelf.filter((s) => !others.has(s.categoryId));
  }
  if (!changed) return { categories, storeShelfOrders, products, shoppingListItems, changed };

  cats.sort((a, b) => a.defaultOrder - b.defaultOrder).forEach((c, i) => (c.defaultOrder = i + 1));
  const byStore = new Map();
  for (const s of shelf) {
    if (!byStore.has(s.storeId)) byStore.set(s.storeId, []);
    byStore.get(s.storeId).push(s);
  }
  for (const list of byStore.values()) list.sort((a, b) => a.sortOrder - b.sortOrder).forEach((s, i) => (s.sortOrder = i + 1));
  return { categories: cats, storeShelfOrders: shelf, products: prods, shoppingListItems: items, changed };
}

/**
 * v1.12 のカテゴリに組み直す。
 * - まとめたカテゴリ（野菜・果物 など）は先頭の名前に改名し、商品・リスト項目はそのまま（野菜に残る）。
 *   同じ名前のカテゴリがすでにあれば、そちらへ商品・リスト項目・売り場順を移して元を消す
 * - 足りない初期カテゴリ（果物・お菓子・冷凍 など）を追加
 * - 並び順は DEFAULT_CATEGORIES どおり。自分で作ったカテゴリは「その他」の前に、今の順のまま
 * - お店ごとの売り場順：分けて増えたカテゴリは元の直後、それ以外の新しいカテゴリは最後に
 * @param {{categories:Array, storeShelfOrders:Array, products:Array, shoppingListItems:Array}} data
 * @param {() => string} newId
 */
export function reorganizeCategories({ categories, storeShelfOrders, products, shoppingListItems }, newId) {
  let cats = [...categories].sort((a, b) => a.defaultOrder - b.defaultOrder).map((c) => ({ ...c }));
  let shelf = storeShelfOrders.map((s) => ({ ...s }));
  const prods = products.map((p) => ({ ...p }));
  const items = shoppingListItems.map((i) => ({ ...i }));
  const byName = (n) => cats.find((c) => c.name === n);
  /** 元のカテゴリID → 分けて足したカテゴリID（売り場順で直後に入れる） */
  const after = new Map();

  const moveTo = (fromId, toId) => {
    for (const p of prods) if (p.categoryId === fromId) p.categoryId = toId;
    for (const i of items) if (i.categoryId === fromId) i.categoryId = toId;
    shelf = shelf.filter((s) => s.categoryId !== fromId || !shelf.some((x) => x.storeId === s.storeId && x.categoryId === toId));
    for (const s of shelf) if (s.categoryId === fromId) s.categoryId = toId;
    cats = cats.filter((c) => c.id !== fromId);
  };

  /** 分けたカテゴリの商品を、成分表の番号・名前から行き先を推測して振り分ける（わからなければ先頭の名前に残す） */
  const moveGuessed = (fromId, parts) => {
    for (const p of prods) {
      if (p.categoryId !== fromId) continue;
      const name = guessPart(p, parts);
      const to = name && byName(name);
      if (to && to.id !== fromId) p.categoryId = to.id;
    }
  };

  for (const [combined, parts] of Object.entries(V12_SPLITS)) {
    const c = byName(combined);
    if (!c) continue;
    const same = byName(parts[0]);
    let baseId = c.id;
    if (same) {
      moveTo(c.id, same.id);
      baseId = same.id;
    } else {
      c.name = parts[0];
    }
    const added = [];
    for (const name of parts.slice(1)) {
      if (byName(name)) continue;
      const nc = { id: newId(), name, defaultOrder: 0 };
      cats.push(nc);
      added.push(nc.id);
    }
    after.set(baseId, [...(after.get(baseId) ?? []), ...added]);
    moveGuessed(baseId, parts);
  }
  for (const name of DEFAULT_CATEGORIES) if (!byName(name)) cats.push({ id: newId(), name, defaultOrder: 0 });

  // 並び：初期カテゴリの順 → 自分で作ったもの → その他
  const rank = (c) => {
    const i = DEFAULT_CATEGORIES.indexOf(c.name);
    if (c.name === 'その他') return 10000;
    return i >= 0 ? i : 1000 + c.defaultOrder;
  };
  cats.sort((a, b) => rank(a) - rank(b)).forEach((c, i) => (c.defaultOrder = i + 1));

  // お店ごとの売り場順
  const byStore = new Map();
  for (const s of shelf) {
    if (!byStore.has(s.storeId)) byStore.set(s.storeId, []);
    byStore.get(s.storeId).push(s);
  }
  const outShelf = [];
  for (const [storeId, list] of byStore) {
    const seq = [];
    const has = new Set();
    for (const s of list.sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (has.has(s.categoryId)) continue;
      seq.push(s);
      has.add(s.categoryId);
      for (const cid of after.get(s.categoryId) ?? []) {
        seq.push({ id: newId(), storeId, categoryId: cid, sortOrder: 0 });
        has.add(cid);
      }
    }
    for (const c of cats) if (!has.has(c.id)) seq.push({ id: newId(), storeId, categoryId: c.id, sortOrder: 0 });
    seq.forEach((s, i) => (s.sortOrder = i + 1));
    outShelf.push(...seq);
  }
  return { categories: cats, storeShelfOrders: outShelf, products: prods, shoppingListItems: items };
}

/**
 * 商品がどのカテゴリに入りそうか（v1.12 の振り分け用）。成分表の食品番号の先頭2桁と、名前で判断する
 * @param {{name:string, nutrition?:{source:string, code?:string, name?:string}|null}} p
 * @param {string[]} parts 候補（例：['パン','米','麺']）
 * @returns {string|null}
 */
export function guessPart(p, parts) {
  const code = p.nutrition?.source === 'mext' ? String(p.nutrition.code ?? '') : '';
  const text = `${p.name} ${p.nutrition?.name ?? ''}`;
  const pick = (n) => (parts.includes(n) ? n : null);
  if (/パン|ベーグル|ナン/.test(text)) return pick('パン'); // i18n-ignore（判定用。表示しない）
  if (/麺|めん|うどん|そば|パスタ|スパゲッティ|マカロニ|ラーメン|そうめん|ひやむぎ|ビーフン/.test(text)) return pick('麺'); // i18n-ignore（判定用。表示しない）
  if (/米|めし|ご飯|ごはん|玄米|もち|オートミール/.test(text)) return pick('米'); // i18n-ignore（判定用。表示しない）
  switch (code.slice(0, 2)) {
    case '07':
      return pick('果物');
    case '10':
      return pick('魚');
    case '11':
      return pick('肉');
  }
  if (/鮭|さけ|サーモン|さば|サバ|いわし|あじ|まぐろ|ツナ|たら|ぶり|えび|いか|たこ|貝|しらす|魚/.test(text)) return pick('魚'); // i18n-ignore（判定用。表示しない）
  if (/りんご|バナナ|みかん|いちご|ぶどう|キウイ|もも|なし|かき|メロン|すいか|レモン|グレープフルーツ|ベリー|パイン|果物/.test(text)) return pick('果物'); // i18n-ignore（判定用。表示しない）
  return null;
}
