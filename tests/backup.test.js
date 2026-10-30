import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, backupFileName, CURRENT_SCHEMA_VERSION } from '../js/domain/backupFormat.js';

const sample = () =>
  buildBackup(
    {
      categories: [{ id: 'c1', name: '卵', defaultOrder: 1 }],
      products: [{ id: 'p1', name: '卵', categoryId: 'c1', inventoryUnit: 'パック', currentStock: 0, targetStock: 2 }],
      stores: [{ id: 's1', name: 'A', createdAt: 'x' }],
      storeShelfOrders: [{ id: 'o1', storeId: 's1', categoryId: 'c1', sortOrder: 1 }],
      shoppingListItems: [{ id: 'i1', productId: null, name: 'アイス', quantity: 1 }],
      priceRecords: [{ id: 'r1', productId: 'p1', storeId: 's1', price: 228, quantity: 1, purchasedAt: '2026-10-30' }],
    },
    '2026-10-30T00:00:00Z'
  );

test('書き出したものはそのまま読み込める', () => {
  const r = parseBackup(JSON.stringify(sample()));
  assert.equal(r.ok, true);
  assert.equal(r.backup.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(r.counts.products, 1);
  assert.equal(r.counts.priceRecords, 1);
});

test('壊れた JSON・別アプリのファイルは拒否', () => {
  assert.equal(parseBackup('{oops').ok, false);
  assert.equal(parseBackup('{"app":"other"}').ok, false);
  assert.equal(parseBackup('null').ok, false);
});

test('新しい版のバックアップは拒否', () => {
  const b = sample();
  b.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
  assert.match(parseBackup(JSON.stringify(b)).error, /新しい版/);
});

test('項目の型が違うと拒否', () => {
  const b = sample();
  b.data.products[0].currentStock = -1;
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
  const c = sample();
  c.data.priceRecords[0].price = '228';
  assert.equal(parseBackup(JSON.stringify(c)).ok, false);
});

test('ID の重複・欠落は拒否', () => {
  const b = sample();
  b.data.stores.push({ id: 's1', name: 'B' });
  assert.match(parseBackup(JSON.stringify(b)).error, /重複/);
  const c = sample();
  delete c.data.categories[0].id;
  assert.equal(parseBackup(JSON.stringify(c)).ok, false);
});

test('ファイル名', () => {
  assert.equal(backupFileName(new Date(2026, 9, 30, 19, 5)), 'yuteli-backup-20261030-1905.json');
});
