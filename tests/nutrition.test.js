import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nutrientsOf, sumNutrients, targetsFor, evaluate, ageBand, labelToPer100g, gramsPerIntakeUnit } from '../js/domain/nutrition.js';
import { dailyCost, pricePerIntakeUnit } from '../js/domain/cost.js';

// 成分表：鶏卵 全卵 生 / 糸引き納豆 / 精白米めし（100gあたり）
const EGG100 = { energy: 142, protein: 12.2, fat: 10.2, carb: 0.4, fiber: 0, salt: 0.4, calcium: 46, iron: 1.5, vitA: 210, vitD: 3.8, vitB1: 0.06, vitB2: 0.37, vitC: 0 };
const egg = {
  id: 'egg', name: '卵', inventoryUnit: 'パック', packageContent: 10, packageContentUnit: '個', gramsPerUnit: 50,
  consumption: { breakfast: 1, lunch: 0, dinner: 1 }, nutrition: { source: 'mext', per100g: EGG100 },
};
const rice = {
  id: 'rice', name: 'ご飯', inventoryUnit: '袋', packageContent: 5000, packageContentUnit: 'g',
  consumption: { breakfast: 150, lunch: 150, dinner: 150 }, nutrition: { source: 'mext', per100g: { ...EGG100, energy: 156, vitD: null } },
};

test('卵1個50g・1日2個 → 142kcal', () => {
  const r = nutrientsOf(egg);
  assert.equal(r.grams, 100);
  assert.equal(r.values.energy, 142);
  assert.equal(nutrientsOf(egg, 'breakfast').values.energy, 71);
  assert.equal(nutrientsOf(egg, 'lunch').values.energy, 0);
});

test('g の商品は重さ不要、個の商品は1個の重さが必要', () => {
  assert.equal(gramsPerIntakeUnit(rice), 1);
  assert.equal(gramsPerIntakeUnit({ ...egg, gramsPerUnit: null }), null);
});

test('合計：不明な値・計算できない商品を区別する', () => {
  const noNut = { id: 'x', name: 'お菓子', inventoryUnit: '袋', consumption: { breakfast: 0, lunch: 1, dinner: 0 }, nutrition: null };
  const noWeight = { ...egg, id: 'y', name: '卵2', gramsPerUnit: null };
  const s = sumNutrients([egg, rice, noNut, noWeight]);
  assert.equal(Math.round(s.totals.energy), 142 + 702);
  assert.deepEqual(s.unknown.vitD, ['ご飯']);
  assert.deepEqual(s.missing.map((m) => [m.product.name, m.reason]), [['お菓子', 'no-nutrition'], ['卵2', 'no-weight']]);
  assert.equal(Math.round(sumNutrients([egg, rice], 'lunch').totals.energy), 234);
});

test('年齢区分', () => {
  assert.equal(ageBand(17), null);
  assert.equal(ageBand(18), '18-29');
  assert.equal(ageBand(49), '30-49');
  assert.equal(ageBand(80), '75+');
});

test('目標：40歳女性・ふつう・月経あり', () => {
  const t = targetsFor({ sex: 'female', age: 40, activity: 'II', menstruation: true });
  assert.equal(t.energy.value, 2050);
  assert.equal(t.protein.value, 50);
  assert.equal(t.iron.value, 10.5);
  assert.equal(t.salt.value, 6.5);
  assert.equal(Math.round(t.fat.low), 46); // 2050×20%÷9
  assert.equal(Math.round(t.carb.high), 333); // 2050×65%÷4
});

test('目標：75歳以上で活動量「高い」は「ふつう」の値を使う', () => {
  assert.equal(targetsFor({ sex: 'male', age: 80, activity: 'III' }).energy.value, 2250);
});

test('判定', () => {
  assert.equal(evaluate(40, { kind: 'min', value: 50 }).status, 'low');
  assert.equal(evaluate(60, { kind: 'min', value: 50 }).status, 'ok');
  assert.equal(evaluate(3000, { kind: 'min', value: 650, upper: 2500 }).status, 'high');
  assert.equal(evaluate(7, { kind: 'max', value: 6.5 }).status, 'high');
  assert.equal(evaluate(6, { kind: 'max', value: 6.5 }).status, 'ok');
  assert.equal(evaluate(60, { kind: 'range', low: 46, high: 68 }).status, 'ok');
  assert.equal(evaluate(2400, { kind: 'approx', value: 2050 }).status, 'high');
});

test('パッケージ表示（1パック45gあたり）を100gあたりに', () => {
  const r = labelToPer100g({ energy: '90', protein: '7.4', fat: '', salt: '0' }, 45);
  assert.equal(r.energy, 200);
  assert.equal(r.fat, null);
  assert.equal(r.salt, 0);
});

test('食費：卵 1パック(10個) 228円・1日2個 → 1日45.6円・30日1368円', () => {
  const recs = [
    { storeId: 'A', price: 258, quantity: 1, purchasedAt: '2026-11-01', createdAt: 'a', packageContent: 10, packageContentUnit: '個' },
    { storeId: 'B', price: 228, quantity: 1, purchasedAt: '2026-11-01', createdAt: 'b', packageContent: 10, packageContentUnit: '個' },
  ];
  assert.equal(pricePerIntakeUnit(egg, recs).price, 22.8);
  const c = dailyCost([egg, rice], new Map([['egg', recs]]));
  assert.equal(Math.round(c.perDay * 10) / 10, 45.6);
  assert.equal(Math.round(c.perMonth), 1368);
  assert.equal(Math.round(c.perMeal.breakfast * 10) / 10, 22.8);
  assert.deepEqual(c.noPrice.map((p) => p.name), ['ご飯']);
});

test('食費：店舗で容量が違えばその容量で割る', () => {
  const milk = { id: 'm', inventoryUnit: '本', packageContent: 1000, packageContentUnit: 'ml', consumption: { breakfast: 200, lunch: 0, dinner: 0 } };
  const recs = [
    { storeId: 'A', price: 238, quantity: 1, purchasedAt: '2026-11-01', createdAt: 'a', packageContent: 1000, packageContentUnit: 'ml' },
    { storeId: 'B', price: 218, quantity: 1, purchasedAt: '2026-11-01', createdAt: 'b', packageContent: 900, packageContentUnit: 'ml' },
  ];
  assert.equal(Math.round(pricePerIntakeUnit(milk, recs).price * 1000) / 1000, 0.238);
});
