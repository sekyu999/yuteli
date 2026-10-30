// 内容量の単位を揃える（価格比較用）。画面や DB には依存しない純粋な関数。

/** 入力で選べる単位 → 保存する単位と倍率 */
const UNIT_TABLE = {
  g: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  L: { unit: 'ml', factor: 1000 },
  個: { unit: '個', factor: 1 },
};

export const INPUT_UNITS = Object.keys(UNIT_TABLE);

/**
 * 内容量を g / ml / 個 に正規化する。
 * 例：normalizeContent(1, 'L') → { amount: 1000, unit: 'ml' }
 * 不正な値なら null を返す（＝内容量なし扱い）。
 * @param {number|null|undefined} amount
 * @param {string|null|undefined} unit
 * @returns {{amount:number, unit:'g'|'ml'|'個'} | null}
 */
export function normalizeContent(amount, unit) {
  const rule = UNIT_TABLE[unit ?? ''];
  const n = Number(amount);
  if (!rule || !Number.isFinite(n) || n <= 0) return null;
  return { amount: n * rule.factor, unit: /** @type {any} */ (rule.unit) };
}
