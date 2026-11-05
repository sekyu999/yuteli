import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyStockUse, intakeUnit, formatStock, isDaily } from '../js/domain/consumption.js';
import { shortage } from '../js/domain/product.js';

const egg = {
  inventoryUnit: 'パック', packageContent: 10, packageContentUnit: '個',
  currentStock: 2, targetStock: 2,
  consumption: { breakfast: 1, lunch: 0, dinner: 1 },
};

test('入力単位：内容量があればその単位、なければ管理単位', () => {
  assert.equal(intakeUnit(egg), '個');
  assert.equal(intakeUnit({ inventoryUnit: 'パック', packageContentUnit: null }), 'パック');
});

test('1日に使う量：卵 10個入り・1日2個 → 0.2パック', () => {
  assert.equal(dailyStockUse(egg), 0.2);
  assert.equal(isDaily(egg), true);
  assert.equal(isDaily({ ...egg, consumption: null }), false);
});

test('不足数は切り上げ（以前のデータの小数在庫にも対応）', () => {
  assert.equal(shortage({ targetStock: 2, currentStock: 1.4 }), 1);
  assert.equal(shortage({ targetStock: 2, currentStock: 2 }), 0);
});

test('在庫の表示', () => {
  assert.equal(formatStock(2), '2');
  assert.equal(formatStock(1.44), '1.4');
});
