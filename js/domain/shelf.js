// 売り場順の並べ替え。画面や DB には依存しない純粋な関数。

/**
 * カテゴリを店舗の売り場順に並べる。
 * 売り場順が未設定のカテゴリは、設定済みのものの後ろに標準の順番で並ぶ。
 * @param {Array<{id:string, defaultOrder:number}>} categories
 * @param {Array<{categoryId:string, sortOrder:number}>} shelfOrders その店舗の売り場順（店舗未選択なら空配列）
 * @returns {Array} 並べ替えたカテゴリ（元の配列は変更しない）
 */
export function orderCategories(categories, shelfOrders = []) {
  const pos = new Map(shelfOrders.map((s) => [s.categoryId, s.sortOrder]));
  return [...categories].sort((a, b) => {
    const pa = pos.has(a.id) ? pos.get(a.id) : Infinity;
    const pb = pos.has(b.id) ? pos.get(b.id) : Infinity;
    if (pa !== pb) return pa - pb;
    return a.defaultOrder - b.defaultOrder;
  });
}

/**
 * 項目をカテゴリごとのグループに分け、カテゴリの並び順で返す。
 * カテゴリのない項目・存在しないカテゴリの項目は最後の「その他（未分類）」にまとめる。
 * @template T
 * @param {T[]} items categoryId を持つ項目
 * @param {Array<{id:string,name:string}>} orderedCategories orderCategories の結果
 * @param {(a:T,b:T)=>number} [compare] グループ内の並び
 * @returns {Array<{ categoryId: string|null, name: string, items: T[] }>}
 */
export function groupByCategory(items, orderedCategories, compare) {
  const groups = orderedCategories.map((c) => ({ categoryId: c.id, name: c.name, items: [] }));
  const byId = new Map(groups.map((g) => [g.categoryId, g]));
  const rest = { categoryId: null, name: '未分類', items: [] };
  for (const it of items) (byId.get(it.categoryId) ?? rest).items.push(it);
  const result = [...groups, rest].filter((g) => g.items.length);
  if (compare) result.forEach((g) => g.items.sort(compare));
  return result;
}

/** 配列の index の要素を1つ上(-1)または下(+1)に動かした新しい配列 */
export function move(array, index, dir) {
  const to = index + dir;
  if (to < 0 || to >= array.length) return array.slice();
  const copy = array.slice();
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}
