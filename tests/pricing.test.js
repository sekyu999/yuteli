import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStores, unitPrice, validatePriceInput, daysSince, yen } from '../js/domain/pricing.js';

let seq = 0;
const R = (storeId, price, date, extra = {}) => ({
  storeId,
  price,
  quantity: 1,
  purchasedAt: date,
  createdAt: `2026-01-01T00:00:${String(seq++).padStart(2, '0')}Z`,
  packageContent: null,
  packageContentUnit: null,
  ...extra,
});

test('最新価格から最安店舗を判定する（指示書の例：Bスーパー 228円）', () => {
  const r = compareStores([R('A', 258, '2026-10-01'), R('B', 228, '2026-10-01'), R('C', 248, '2026-10-01')]);
  assert.equal(r.mode, 'item');
  assert.equal(r.rows[0].storeId, 'B');
  assert.deepEqual(r.rows.map((x) => x.cheapest), [true, false, false]);
});

test('各店舗は最新の記録だけを使う（古い安値は無視）', () => {
  const r = compareStores([R('A', 150, '2026-01-01'), R('A', 260, '2026-10-01'), R('B', 228, '2026-10-01')]);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].storeId, 'B');
  assert.equal(r.rows.find((x) => x.storeId === 'A').record.price, 260);
});

test('容量が違う商品は単位価格で比較（1000ml/238円 vs 900ml/218円）', () => {
  const a = R('A', 238, '2026-10-01', { packageContent: 1000, packageContentUnit: 'ml' });
  const b = R('B', 218, '2026-10-01', { packageContent: 900, packageContentUnit: 'ml' });
  assert.equal(Math.round(unitPrice(a).value * 100) / 100, 23.8);
  assert.equal(Math.round(unitPrice(b).value * 100) / 100, 24.22);
  const r = compareStores([a, b]);
  assert.equal(r.mode, 'unit');
  assert.equal(r.rows[0].storeId, 'A'); // 総額は高いが実質は A が安い
});

test('まとめ買いは1個あたりに直して比較', () => {
  const r = compareStores([R('A', 300, '2026-10-01', { quantity: 3 }), R('B', 120, '2026-10-01')]);
  assert.equal(r.rows[0].storeId, 'A');
  assert.equal(r.rows[0].perItem, 100);
});

test('内容量がない記録が混じると1個あたりで比較', () => {
  const r = compareStores([
    R('A', 238, '2026-10-01', { packageContent: 1000, packageContentUnit: 'ml' }),
    R('B', 200, '2026-10-01'),
  ]);
  assert.equal(r.mode, 'item');
  assert.equal(r.rows[0].storeId, 'B');
});

test('g と 個 のように種類が違えば単位価格では比較しない', () => {
  const r = compareStores([
    R('A', 300, '2026-10-01', { packageContent: 500, packageContentUnit: 'g' }),
    R('B', 200, '2026-10-01', { packageContent: 10, packageContentUnit: '個' }),
  ]);
  assert.equal(r.mode, 'item');
});

test('同額なら両方とも最安', () => {
  const r = compareStores([R('A', 200, '2026-10-01'), R('B', 200, '2026-10-01')]);
  assert.deepEqual(r.rows.map((x) => x.cheapest), [true, true]);
});

test('記録がなければ none', () => {
  assert.equal(compareStores([]).mode, 'none');
});

test('価格入力の検証', () => {
  const ok = validatePriceInput(
    { productId: 'p', storeId: 's', price: '1,280', quantity: '2', purchasedAt: '2026-10-30', packageContent: '1', packageContentUnit: 'kg' },
    '2026-10-30'
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.value.price, 1280);
  assert.equal(ok.value.packageContent, 1000);
  const ng = validatePriceInput({ productId: '', storeId: '', price: '0', quantity: '0', purchasedAt: '2026-12-01' }, '2026-10-30');
  assert.deepEqual(Object.keys(ng.errors).sort(), ['price', 'productId', 'purchasedAt', 'quantity', 'storeId']);
});

test('経過日数と金額表示', () => {
  assert.equal(daysSince('2026-10-01', '2026-10-31'), 30);
  assert.equal(yen(1280), '1,280円');
  assert.equal(yen(23.84), '23.8円');
});
