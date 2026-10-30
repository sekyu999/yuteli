import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContent } from '../js/domain/units.js';

test('kg は g に、L は ml に換算される', () => {
  assert.deepEqual(normalizeContent(1.5, 'kg'), { amount: 1500, unit: 'g' });
  assert.deepEqual(normalizeContent(1, 'L'), { amount: 1000, unit: 'ml' });
});

test('g・ml・個 はそのまま', () => {
  assert.deepEqual(normalizeContent(900, 'ml'), { amount: 900, unit: 'ml' });
  assert.deepEqual(normalizeContent(10, '個'), { amount: 10, unit: '個' });
});

test('不正な値は null', () => {
  assert.equal(normalizeContent(null, 'g'), null);
  assert.equal(normalizeContent(0, 'g'), null);
  assert.equal(normalizeContent(-1, 'g'), null);
  assert.equal(normalizeContent(100, 'lb'), null);
  assert.equal(normalizeContent(100, null), null);
});
