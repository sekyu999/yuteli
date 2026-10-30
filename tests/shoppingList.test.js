import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRefresh } from '../js/domain/shoppingList.js';
import { orderCategories, groupByCategory, move } from '../js/domain/shelf.js';

const P = (id, cur, tgt, extra = {}) => ({
  id,
  name: id,
  inventoryUnit: 'パック',
  categoryId: 'c1',
  currentStock: cur,
  targetStock: tgt,
  autoAddSuppressed: false,
  ...extra,
});

test('不足している商品だけが追加され、必要数 = 目標 − 現在庫', () => {
  const { toAdd } = planRefresh([P('卵', 0, 2), P('牛乳', 1, 3), P('納豆', 2, 2)], []);
  assert.deepEqual(
    toAdd.map((a) => [a.name, a.quantity]),
    [
      ['卵', 2],
      ['牛乳', 2],
    ]
  );
});

test('すでにリストにある商品は重複追加しない（何度更新しても同じ）', () => {
  const products = [P('卵', 0, 2)];
  const items = [{ id: 'i1', productId: '卵', name: '卵', unit: 'パック', categoryId: 'c1', quantity: 2 }];
  const r = planRefresh(products, items);
  assert.equal(r.toAdd.length, 0);
  assert.equal(r.toUpdate.length, 0);
});

test('リストにある商品の数量は最新の不足数にそろえる', () => {
  const items = [{ id: 'i1', productId: '卵', name: '卵', unit: 'パック', categoryId: 'c1', quantity: 2 }];
  const r = planRefresh([P('卵', 1, 4)], items);
  assert.deepEqual(r.toUpdate, [{ id: 'i1', changes: { quantity: 3 } }]);
});

test('在庫が足りても未購入の項目は消さない（持ち越し）', () => {
  const items = [{ id: 'i1', productId: '卵', name: '卵', unit: 'パック', categoryId: 'c1', quantity: 2 }];
  const r = planRefresh([P('卵', 5, 2)], items);
  assert.equal(r.toAdd.length, 0);
  assert.equal(r.toUpdate.length, 0);
});

test('購入済み抑制中の商品は追加しない', () => {
  const r = planRefresh([P('卵', 0, 2, { autoAddSuppressed: true })], []);
  assert.equal(r.toAdd.length, 0);
});

test('手動追加の一時項目には触れない', () => {
  const items = [{ id: 't1', productId: null, name: 'アイス', quantity: 1 }];
  const r = planRefresh([P('卵', 0, 1)], items);
  assert.equal(r.toAdd.length, 1);
  assert.equal(r.toUpdate.length, 0);
});

test('売り場順：設定済みのカテゴリが先、未設定は標準順で後ろ', () => {
  const cats = [
    { id: 'a', name: '野菜', defaultOrder: 1 },
    { id: 'b', name: '肉', defaultOrder: 2 },
    { id: 'c', name: '卵', defaultOrder: 3 },
    { id: 'd', name: '日用品', defaultOrder: 4 },
  ];
  const shelf = [
    { categoryId: 'c', sortOrder: 1 },
    { categoryId: 'a', sortOrder: 2 },
  ];
  assert.deepEqual(orderCategories(cats, shelf).map((c) => c.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(orderCategories(cats, []).map((c) => c.id), ['a', 'b', 'c', 'd']);
});

test('カテゴリごとにまとめ、カテゴリなしは最後', () => {
  const cats = [
    { id: 'a', name: '野菜' },
    { id: 'b', name: '肉' },
  ];
  const groups = groupByCategory(
    [
      { n: 1, categoryId: 'b' },
      { n: 2, categoryId: null },
      { n: 3, categoryId: 'a' },
    ],
    cats
  );
  assert.deepEqual(groups.map((g) => g.name), ['野菜', '肉', '未分類']);
});

test('move は端では動かない', () => {
  assert.deepEqual(move([1, 2, 3], 0, -1), [1, 2, 3]);
  assert.deepEqual(move([1, 2, 3], 0, 1), [2, 1, 3]);
});
