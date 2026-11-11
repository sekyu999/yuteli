// 家計：買いたい物・やりたい事の予定と、月ごとの見込み額。画面や DB には依存しない純粋な関数。

export const PLAN_KINDS = [
  { key: 'buy', label: '買いたい物' },
  { key: 'do', label: 'やりたい事' },
];

/**
 * @typedef {Object} Plan
 * @property {string} id
 * @property {'buy'|'do'} kind
 * @property {string} title
 * @property {number} price      円（税込の目安）
 * @property {string|null} month YYYY-MM（未定は null）
 * @property {string} memo
 * @property {boolean} done      買った・やった
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** 入力の検証と整形 */
export function validatePlanInput(raw) {
  const errors = {};
  const kind = raw.kind === 'do' ? 'do' : 'buy';
  const title = String(raw.title ?? '').trim();
  if (!title) errors.title = '名前を入力してください';
  else if (title.length > 40) errors.title = '40文字以内にしてください';

  const priceText = String(raw.price ?? '').replace(/[,円\s]/g, ''); // i18n-ignore
  const price = priceText === '' ? 0 : Number(priceText);
  if (!Number.isInteger(price) || price < 0 || price > 100000000) errors.price = '0以上の整数（円）で入力してください';

  let month = String(raw.month ?? '').trim() || null;
  if (raw.undecided) month = null;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) errors.month = '月を選んでください';

  const memo = String(raw.memo ?? '').trim();
  if (memo.length > 200) errors.memo = '200文字以内にしてください';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { kind, title, price, month, memo, done: !!raw.done } };
}

/** YYYY-MM に n か月足す */
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 今月（端末の時刻）YYYY-MM */
export function thisMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 「2026年11月」 */
export function monthLabel(ym, base) {
  if (!ym) return '未定';
  const [y, m] = ym.split('-').map(Number);
  const by = base ? Number(base.slice(0, 4)) : null;
  return by === y ? `${m}月` : `${y}年${m}月`; // i18n-ignore（画面では lib/i18n.js の monthText() を使う）
}

/**
 * 月ごとの見込み額
 * @param {Plan[]} plans
 * @param {string} start 最初の月 YYYY-MM
 * @param {number} count 何か月分
 * @param {number} foodPerMonth 毎月の食費の目安（円）。不明なら 0
 * @returns {Array<{month:string, buy:number, do:number, plans:number, food:number, total:number, done:number}>}
 */
export function monthlyTotals(plans, start, count, foodPerMonth = 0) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const month = addMonths(start, i);
    const inMonth = plans.filter((p) => p.month === month);
    const sum = (list) => list.reduce((s, p) => s + p.price, 0);
    const buy = sum(inMonth.filter((p) => p.kind === 'buy'));
    const doing = sum(inMonth.filter((p) => p.kind === 'do'));
    rows.push({
      month,
      buy,
      do: doing,
      plans: buy + doing,
      food: Math.round(foodPerMonth),
      total: buy + doing + Math.round(foodPerMonth),
      done: sum(inMonth.filter((p) => p.done)),
    });
  }
  return rows;
}

/**
 * 一覧用に月ごとにまとめる（月の古い順。未定は最後）
 * @returns {Array<{month:string|null, items:Plan[], total:number}>}
 */
export function groupByMonth(plans) {
  const map = new Map();
  for (const p of plans) {
    const k = p.month ?? '';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([k, items]) => ({
      month: k || null,
      items: items.sort((a, b) => Number(a.done) - Number(b.done) || b.price - a.price),
      total: items.reduce((s, p) => s + p.price, 0),
    }));
}

/**
 * 一覧の月の並び。今月から count か月分は予定がなくても出す（ドラッグの移動先にするため）。
 * それ以外の月（過ぎた月・先の月）は予定がある時だけ。最後に「未定」。
 * @returns {Array<{month:string|null, items:Plan[], total:number}>}
 */
export function monthSections(plans, now, count = 12) {
  const groups = new Map(groupByMonth(plans).map((g) => [g.month ?? '', g]));
  const keys = new Set([...groups.keys()].filter((k) => k !== ''));
  for (let i = 0; i < count; i++) keys.add(addMonths(now, i));
  const sorted = [...keys].sort();
  sorted.push('');
  return sorted.map((k) => groups.get(k) ?? { month: k || null, items: [], total: 0 });
}
