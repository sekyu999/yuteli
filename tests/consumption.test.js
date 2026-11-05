import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyStockUse, effectiveStock, daysLeft, intakeUnit, formatStock, stockInContent } from '../js/domain/consumption.js';
import { shortage } from '../js/domain/product.js';

const egg = {
  inventoryUnit: 'パック', packageContent: 10, packageContentUnit: '個',
  currentStock: 2, targetStock: 2, stockUpdatedOn: '2026-11-01',
  consumption: { breakfast: 1, lunch: 0, dinner: 1 },
};

test('入力単位：内容量があればその単位、なければ管理単位', () => {
  assert.equal(intakeUnit(egg), '個');
  assert.equal(intakeUnit({ inventoryUnit: 'パック', packageContentUnit: null }), 'パック');
});

test('1日の在庫の減り：卵 10個入り・1日2個 → 0.2パック', () => {
  assert.equal(dailyStockUse(egg), 0.2);
  assert.equal(dailyStockUse({ ...egg, packageContent: null, packageContentUnit: null, consumption: { breakfast: 1, lunch: 0, dinner: 0 } }), 1);
});

test('経過日数ぶん自動で減る（0未満にはならない）', () => {
  assert.equal(effectiveStock(egg, '2026-11-01'), 2);
  assert.equal(effectiveStock(egg, '2026-11-04'), 1.4);
  assert.equal(effectiveStock(egg, '2026-12-31'), 0);
  assert.equal(effectiveStock({ ...egg, consumption: null }, '2026-12-31'), 2);
});

test('あと何日もつか', () => {
  assert.equal(daysLeft(egg, '2026-11-04'), 7);
  assert.equal(daysLeft({ ...egg, consumption: null }, '2026-11-04'), null);
});

test('不足数は切り上げ（目標2、在庫1.4 → 1パック買う）', () => {
  assert.equal(shortage({ targetStock: 2, currentStock: 1.4 }), 1);
  assert.equal(shortage({ targetStock: 2, currentStock: 0.6 }), 2);
  assert.equal(shortage({ targetStock: 2, currentStock: 2 }), 0);
  assert.equal(shortage({ targetStock: 0.3 + 0.6, currentStock: 0.9 }), 0);
});

test('表示', () => {
  assert.equal(formatStock(2), '2');
  assert.equal(formatStock(1.44), '1.4');
  assert.equal(stockInContent(egg, 1.4), 14);
});
