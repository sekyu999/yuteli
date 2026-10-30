import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductInput, shortage, nameKey } from '../js/domain/product.js';

const base = { name: '卵', categoryId: 'c1', inventoryUnit: 'パック', currentStock: '0', targetStock: '2' };

test('正しい入力は数値に変換される', () => {
  const r = validateProductInput(base);
  assert.equal(r.ok, true);
  assert.equal(r.value.currentStock, 0);
  assert.equal(r.value.targetStock, 2);
  assert.equal(r.value.packageContent, null);
});

test('商品名・カテゴリ・単位は必須', () => {
  const r = validateProductInput({ ...base, name: '  ', categoryId: '', inventoryUnit: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name && r.errors.categoryId && r.errors.inventoryUnit);
});

test('在庫数は0以上の整数のみ', () => {
  assert.equal(validateProductInput({ ...base, currentStock: '-1' }).ok, false);
  assert.equal(validateProductInput({ ...base, currentStock: '1.5' }).ok, false);
  assert.equal(validateProductInput({ ...base, targetStock: 'abc' }).ok, false);
  assert.equal(validateProductInput({ ...base, currentStock: '' }).value.currentStock, 0);
});

test('内容量は正規化され、空欄なら null', () => {
  const r = validateProductInput({ ...base, packageContent: '1', packageContentUnit: 'L' });
  assert.equal(r.value.packageContent, 1000);
  assert.equal(r.value.packageContentUnit, 'ml');
  assert.equal(validateProductInput({ ...base, packageContent: '', packageContentUnit: 'g' }).value.packageContentUnit, null);
  assert.equal(validateProductInput({ ...base, packageContent: '0', packageContentUnit: 'g' }).ok, false);
});

test('不足数', () => {
  assert.equal(shortage({ currentStock: 0, targetStock: 2 }), 2);
  assert.equal(shortage({ currentStock: 3, targetStock: 2 }), 0);
});

test('商品名の比較は全角半角・大小文字を無視', () => {
  assert.equal(nameKey('ＡＢＣ '), nameKey('abc'));
});
