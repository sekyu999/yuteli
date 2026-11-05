// 毎日の使用量と在庫の自動減少。画面や DB には依存しない純粋な関数。
//
// 考え方
// ・商品ごとに朝・昼・晩に食べる（使う）量を持つ
// ・量の単位は「内容量の単位（g / ml / 個）」。内容量が未登録なら「管理単位（パック・本…）」
// ・在庫は「最後に在庫を確定した日（stockUpdatedOn）」の数から、経過日数 × 1日の使用量 を引いて求める
//   → 毎日0時に1日分減る。DB を毎日書き換えないので、アプリを開かない日があってもずれない

export const MEALS = [
  { key: 'breakfast', label: '朝' },
  { key: 'lunch', label: '昼' },
  { key: 'dinner', label: '晩' },
];

/** 空の使用量 */
export function emptyConsumption() {
  return { breakfast: 0, lunch: 0, dinner: 0 };
}

/** 量を入力する単位（g / ml / 個 / パック…） */
export function intakeUnit(p) {
  return p.packageContentUnit || p.inventoryUnit;
}

/** 1日の量（入力単位） */
export function dailyIntake(p) {
  const c = p.consumption;
  if (!c) return 0;
  return MEALS.reduce((s, m) => s + (Number(c[m.key]) || 0), 0);
}

/** 毎日食べる（使う）商品か */
export function isDaily(p) {
  return dailyIntake(p) > 0;
}

/**
 * 1日に減る在庫（管理単位）
 * 例：卵 1パック=10個、1日2個 → 0.2パック
 */
export function dailyStockUse(p) {
  const intake = dailyIntake(p);
  if (!intake) return 0;
  if (p.packageContentUnit && p.packageContent) return intake / p.packageContent;
  return intake;
}

/** 2つの日付（YYYY-MM-DD）の差（日） */
export function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000));
}

/** 小数第2位で丸める（0.30000000004 などを防ぐ） */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * 今日時点の在庫（自動で減った分を反映）
 * @param {object} p 商品
 * @param {string} today YYYY-MM-DD
 */
export function effectiveStock(p, today) {
  const use = dailyStockUse(p);
  if (!use) return p.currentStock;
  const days = daysBetween(p.stockUpdatedOn ?? today, today);
  return Math.max(0, round2(p.currentStock - use * days));
}

/** 在庫があと何日もつか（毎日使わない商品は null） */
export function daysLeft(p, today) {
  const use = dailyStockUse(p);
  if (!use) return null;
  return Math.floor(effectiveStock(p, today) / use + 1e-9);
}

/** 不足数（目標 − 今日の在庫）。買う数なので切り上げて整数にする */
export function shortageOn(p, today) {
  return Math.max(0, Math.ceil(round2(p.targetStock - effectiveStock(p, today)) - 1e-9));
}

/** 在庫数の表示（整数ならそのまま、小数は1桁） */
export function formatStock(n) {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1);
}

/** 在庫を内容量の単位でも表す（卵 1.4パック → 14個）。内容量がなければ null */
export function stockInContent(p, stock) {
  if (!p.packageContent || !p.packageContentUnit) return null;
  return Math.round(stock * p.packageContent * 10) / 10;
}
