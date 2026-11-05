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

test('在庫数は0以上（現在庫は小数可・目標は整数のみ）', () => {
  assert.equal(validateProductInput({ ...base, currentStock: '-1' }).ok, false);
  assert.equal(validateProductInput({ ...base, currentStock: '1.5' }).ok, true);
  assert.equal(validateProductInput({ ...base, targetStock: '1.5' }).ok, false);
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

test('在庫は小数も可、毎日の量・重さ・栄養データを整形', () => {
  const r = validateProductInput({
    ...base, currentStock: '1.4', c_breakfast: '1', c_lunch: '', c_dinner: '1',
    gramsPerUnit: '50', nutrition: JSON.stringify({ source: 'mext', code: '12004', per100g: { energy: 142 } }),
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.currentStock, 1.4);
  assert.deepEqual(r.value.consumption, { breakfast: 1, lunch: 0, dinner: 1 });
  assert.equal(r.value.gramsPerUnit, 50);
  assert.equal(r.value.nutrition.code, '12004');
  assert.equal(validateProductInput({ ...base, c_lunch: '-1' }).ok, false);
  assert.equal(validateProductInput({ ...base, nutrition: '{bad' }).ok, false);
  assert.equal(validateProductInput({ ...base }).value.nutrition, null);
});
