// カテゴリの初期値と移行処理。純粋な関数。
// 経緯：v1.2 で「野菜・果物」などを分けたが、v1.3 で「・」でまとめた形に戻した（缶詰は残す）

/** 初期カテゴリ（並び順どおり） */
export const DEFAULT_CATEGORIES = [
  '野菜・果物', '肉・魚', '乳製品', '卵', '納豆・豆腐', 'パン・米・麺',
  '缶詰', '調味料', '飲料', '日用品', 'その他',
];

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
