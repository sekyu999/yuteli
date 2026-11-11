import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlanInput, monthlyTotals, groupByMonth, addMonths, monthLabel, monthSections } from '../js/domain/plans.js';

const P = (kind, price, month, done = false) => ({ kind, title: 'x', price, month, done });

test('入力の検証', () => {
  const ok = validatePlanInput({ kind: 'do', title: ' 旅行 ', price: '50,000', month: '2026-12' });
  assert.deepEqual(ok.value, { kind: 'do', title: '旅行', price: 50000, month: '2026-12', memo: '', done: false });
  assert.equal(validatePlanInput({ title: '', price: '-1', month: '2026-13' }).ok, false);
  assert.equal(validatePlanInput({ title: '本', price: '', month: '2026-12', undecided: '1' }).value.month, null);
});

test('月の計算', () => {
  assert.equal(addMonths('2026-11', 2), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(monthLabel('2026-12', '2026-11'), '12月');
  assert.equal(monthLabel('2027-01', '2026-11'), '2027年1月');
  assert.equal(monthLabel(null), '未定');
});

test('月ごとの見込み（予定＋食費）', () => {
  const rows = monthlyTotals(
    [P('buy', 30000, '2026-11'), P('do', 50000, '2026-11', true), P('buy', 8000, '2026-12'), P('buy', 1000, null)],
    '2026-11',
    3,
    4050
  );
  assert.deepEqual(rows[0], { month: '2026-11', buy: 30000, do: 50000, plans: 80000, food: 4050, total: 84050, done: 50000 });
  assert.equal(rows[1].total, 12050);
  assert.equal(rows[2].plans, 0);
});

test('一覧は月順・未定は最後・済みは下', () => {
  const g = groupByMonth([P('buy', 1, null), P('buy', 2, '2026-12', true), P('do', 3, '2026-12'), P('buy', 4, '2026-11')]);
  assert.deepEqual(g.map((x) => x.month), ['2026-11', '2026-12', null]);
  assert.deepEqual(g[1].items.map((p) => p.price), [3, 2]);
  assert.equal(g[1].total, 5);
});

test('一覧の月の並び（今月から12か月は空でも出す・未定は最後）', () => {
  const s = monthSections([P('buy', 100, '2026-09'), P('do', 50, '2028-01'), P('buy', 10, null), P('buy', 20, '2026-12')], '2026-11', 12);
  const keys = s.map((g) => g.month);
  assert.deepEqual(keys, ['2026-09', ...Array.from({ length: 12 }, (_, i) => addMonths('2026-11', i)), '2028-01', null]);
  assert.equal(s.find((g) => g.month === '2026-12').total, 20);
  assert.equal(s.find((g) => g.month === '2027-03').items.length, 0);
  assert.equal(monthSections([], '2026-11', 3).length, 4);
});
