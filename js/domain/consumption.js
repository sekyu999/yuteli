// 毎日食べる（使う）量。栄養と食費の計算に使う。画面や DB には依存しない純粋な関数。
// ・朝・昼・晩に食べる量を商品ごとに持つ（グループの分は groups.js で足す）
// ・量の単位は「内容量の単位（g / ml / 個）」。内容量が未登録なら「管理単位（パック・本…）」
// ・在庫は自動では減らさない（外食などで食べない日もあるため。在庫は手で ± する）

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
 * 1日に使う量を管理単位で（目安の表示用）
 * 例：卵 1パック=10個、1日2個 → 0.2パック
 */
export function dailyStockUse(p) {
  const intake = dailyIntake(p);
  if (!intake) return 0;
  if (p.packageContentUnit && p.packageContent) return intake / p.packageContent;
  return intake;
}

/** 小数第2位で丸める（0.30000000004 などを防ぐ） */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/** 在庫数の表示（整数ならそのまま、小数は1桁） */
export function formatStock(n) {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1);
}
