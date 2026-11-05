// カテゴリの初期値と、v1.1 までの「・」区切りカテゴリを分ける移行処理。純粋な関数。

/** 初期カテゴリ（並び順どおり） */
export const DEFAULT_CATEGORIES = [
  '野菜', '果物', '肉', '魚', '乳製品', '卵', '納豆', '豆腐', 'パン', '米', '麺',
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
