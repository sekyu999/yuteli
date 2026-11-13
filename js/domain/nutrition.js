// 栄養の計算と目標との比較。画面や DB には依存しない純粋な関数。
import { MEALS, intakeUnit } from './consumption.js';
import { DRI, AGE_BANDS, UPPER_LIMITS, BMR_STANDARD, PAL, BMI_TARGET } from '../content/dri2025.js';

/** 扱う栄養素（並び順＝表示順） */
export const NUTRIENTS = [
  { key: 'energy', label: 'エネルギー', unit: 'kcal', digits: 0 },
  { key: 'protein', label: 'たんぱく質', unit: 'g', digits: 1 },
  { key: 'fat', label: '脂質', unit: 'g', digits: 1 },
  { key: 'carb', label: '炭水化物', unit: 'g', digits: 1 },
  { key: 'fiber', label: '食物繊維', unit: 'g', digits: 1 },
  { key: 'salt', label: '食塩相当量', unit: 'g', digits: 1 },
  { key: 'calcium', label: 'カルシウム', unit: 'mg', digits: 0 },
  { key: 'iron', label: '鉄', unit: 'mg', digits: 1 },
  { key: 'vitA', label: 'ビタミンA', unit: 'µg', digits: 0 },
  { key: 'vitD', label: 'ビタミンD', unit: 'µg', digits: 1 },
  { key: 'vitB1', label: 'ビタミンB1', unit: 'mg', digits: 2 },
  { key: 'vitB2', label: 'ビタミンB2', unit: 'mg', digits: 2 },
  { key: 'vitC', label: 'ビタミンC', unit: 'mg', digits: 0 },
];

/** パッケージ表示で入力する主な5項目（日本の栄養成分表示の義務項目） */
export const LABEL_NUTRIENTS = ['energy', 'protein', 'fat', 'carb', 'salt'];

/**
 * 入力単位1つあたりの重さ（g）。g・ml はそのまま1（ml は水と同じ重さとみなす）。
 * 個・パックなどは商品に登録した「1個あたりの重さ」を使う。分からなければ null。
 */
export function gramsPerIntakeUnit(p) {
  const u = intakeUnit(p);
  if (u === 'g' || u === 'ml') return 1;
  return p.gramsPerUnit > 0 ? p.gramsPerUnit : null;
}

/**
 * 1つの商品の、ある食事（またはその合計）の栄養量
 * @param {object} p 商品（nutrition.per100g を持つ）
 * @param {string|null} meal 'breakfast' | 'lunch' | 'dinner' | null（＝1日合計）
 * @returns {{ grams:number, values: Record<string, number|null> } | null} 計算できなければ null
 */
export function nutrientsOf(p, meal = null) {
  if (!p.nutrition?.per100g || !p.consumption) return null;
  const g1 = gramsPerIntakeUnit(p);
  if (!g1) return null;
  const amount = meal
    ? Number(p.consumption[meal]) || 0
    : MEALS.reduce((s, m) => s + (Number(p.consumption[m.key]) || 0), 0);
  const grams = amount * g1;
  const values = {};
  for (const n of NUTRIENTS) {
    const v = p.nutrition.per100g[n.key];
    values[n.key] = v === null || v === undefined ? null : (v * grams) / 100;
  }
  return { grams, values };
}

/**
 * 複数商品の栄養の合計
 * @returns {{ totals: Record<string, number>, unknown: Record<string, string[]>,
 *             missing: Array<{product:object, reason:'no-nutrition'|'no-weight'}> }}
 *   unknown: 栄養素ごとに「値が不明だった商品名」  missing: 計算に入れられなかった商品
 */
export function sumNutrients(products, meal = null) {
  const totals = Object.fromEntries(NUTRIENTS.map((n) => [n.key, 0]));
  const unknown = Object.fromEntries(NUTRIENTS.map((n) => [n.key, []]));
  const missing = [];
  for (const p of products) {
    const amount = meal ? Number(p.consumption?.[meal]) || 0 : MEALS.reduce((s, m) => s + (Number(p.consumption?.[m.key]) || 0), 0);
    if (!amount) continue;
    if (!p.nutrition?.per100g) {
      missing.push({ product: p, reason: 'no-nutrition' });
      continue;
    }
    const r = nutrientsOf(p, meal);
    if (!r) {
      missing.push({ product: p, reason: 'no-weight' });
      continue;
    }
    for (const n of NUTRIENTS) {
      if (r.values[n.key] === null) unknown[n.key].push(p.name);
      else totals[n.key] += r.values[n.key];
    }
  }
  return { totals, unknown, missing };
}

/** 年齢から年齢区分を決める（18歳未満は null） */
export function ageBand(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a < 18) return null;
  return AGE_BANDS.find((b) => a >= b.min && a <= b.max)?.key ?? null;
}

/**
 * 体質（太りやすい・ふつう・太りにくい）によるエネルギーの補正。
 * 食事摂取基準にはない、このアプリの目安（基礎代謝の個人差を ±5% で見込む）
 */
export const CONSTITUTION = [
  { key: 'gain', label: '太りやすい', factor: 0.95 },
  { key: 'normal', label: 'ふつう', factor: 1 },
  { key: 'lose', label: '太りにくい', factor: 1.05 },
];
export function constitutionFactor(profile) {
  return CONSTITUTION.find((c) => c.key === profile?.constitution)?.factor ?? 1;
}

/**
 * プロフィールから1日の目標を作る
 * @param {{sex:'male'|'female', age:number, activity:'I'|'II'|'III', menstruation?:boolean, constitution?:'gain'|'normal'|'lose'}} profile
 * @returns {Record<string, {kind:'range'|'min'|'max'|'approx', low?:number, high?:number, value?:number, upper?:number}> | null}
 */
export function targetsFor(profile) {
  if (!profile || !DRI[profile.sex]) return null;
  const band = ageBand(profile.age);
  if (!band) return null;
  const d = DRI[profile.sex][band];
  // 体重が分かれば自分の体重で計算、なければ国の参照体格の値
  const body = bodyStats(profile);
  const energy = body?.energy ?? Math.round((d.energy[profile.activity] ?? d.energy.II) * constitutionFactor(profile));
  const iron = profile.sex === 'female' && profile.menstruation && d.ironMenstruation ? d.ironMenstruation : d.iron;
  const gFromPct = (pct, kcalPerG) => (energy * pct) / 100 / kcalPerG;
  return {
    energy: { kind: 'approx', value: energy },
    protein: { kind: 'min', value: d.protein, high: gFromPct(d.proteinPct[1], 4) },
    fat: { kind: 'range', low: gFromPct(d.fatPct[0], 9), high: gFromPct(d.fatPct[1], 9) },
    carb: { kind: 'range', low: gFromPct(d.carbPct[0], 4), high: gFromPct(d.carbPct[1], 4) },
    fiber: { kind: 'min', value: d.fiber },
    salt: { kind: 'max', value: d.salt },
    calcium: { kind: 'min', value: d.calcium, upper: UPPER_LIMITS.calcium },
    iron: { kind: 'min', value: iron },
    vitA: { kind: 'min', value: d.vitA, upper: UPPER_LIMITS.vitA },
    vitD: { kind: 'min', value: d.vitD, upper: UPPER_LIMITS.vitD },
    vitB1: { kind: 'min', value: d.vitB1 },
    vitB2: { kind: 'min', value: d.vitB2 },
    vitC: { kind: 'min', value: d.vitC },
  };
}

/**
 * 身長・体重から BMI・基礎代謝・推定エネルギー必要量を出す
 * 基礎代謝 = 基礎代謝基準値 × 体重、必要量 = 基礎代謝 × 身体活動レベル（日本人の食事摂取基準 2025年版の方法）
 * @returns {{ bmi:number|null, bmiRange:[number,number], bmr:number, energy:number } | null} 体重がなければ null
 */
export function bodyStats(profile) {
  const band = ageBand(profile?.age);
  const w = Number(profile?.weight);
  if (!band || !DRI[profile.sex] || !(w > 0)) return null;
  const h = Number(profile.height);
  const bmi = h > 0 ? w / (h / 100) ** 2 : null;
  const bmr = BMR_STANDARD[profile.sex][band] * w;
  const pal = PAL[band][profile.activity] ?? PAL[band].II;
  return { bmi, bmiRange: BMI_TARGET[band], bmr: Math.round(bmr), energy: Math.round(bmr * pal * constitutionFactor(profile)) };
}

/**
 * 1日の合計を目標と比べる
 * @returns {{ status:'low'|'ok'|'high', ratio:number|null, label:string }}
 *   ratio: 目標に対する割合（範囲の場合は下限に対する割合）
 */
export function evaluate(value, target) {
  if (!target) return { status: 'ok', ratio: null, label: '' };
  switch (target.kind) {
    case 'approx': {
      const ratio = value / target.value;
      if (ratio < 0.9) return { status: 'low', ratio, label: '少ない' };
      if (ratio > 1.1) return { status: 'high', ratio, label: '多い' };
      return { status: 'ok', ratio, label: 'ちょうどよい' };
    }
    case 'range': {
      const ratio = value / target.low;
      if (value < target.low) return { status: 'low', ratio, label: '少ない' };
      if (value > target.high) return { status: 'high', ratio, label: '多い' };
      return { status: 'ok', ratio, label: '目標の範囲内' };
    }
    case 'min': {
      const ratio = value / target.value;
      if (target.upper && value > target.upper) return { status: 'high', ratio, label: '上限超え' };
      if (target.high && value > target.high) return { status: 'high', ratio, label: '多い' };
      if (ratio < 1) return { status: 'low', ratio, label: '不足' };
      return { status: 'ok', ratio, label: '達成' };
    }
    case 'max': {
      const ratio = value / target.value;
      if (value >= target.value) return { status: 'high', ratio, label: '多い' };
      return { status: 'ok', ratio, label: '目標内' };
    }
  }
  return { status: 'ok', ratio: null, label: '' };
}

/** {name} のような部分に値を入れる（画面の t() と同じ形。domain は i18n に依存しないので自前で持つ） */
function fillText(text, params) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/**
 * 目標の表示文字列（例：「65g以上」「49〜73g」「7.5g未満」）
 * @param {Function} tr 文字の変換（画面からは t を渡して英訳する。省略時は日本語のまま）
 */
export function targetLabel(target, n, tr = fillText) {
  const f = (v) => formatValue(v, n);
  switch (target.kind) {
    case 'approx':
      return tr('約{v}{u}', { v: f(target.value), u: n.unit });
    case 'range':
      return tr('{lo}〜{hi}{u}', { lo: f(target.low), hi: f(target.high), u: n.unit });
    case 'min':
      return tr('{v}{u}以上', { v: f(target.value), u: n.unit });
    case 'max':
      return tr('{v}{u}未満', { v: f(target.value), u: n.unit });
  }
  return '';
}

/** 栄養素の値を表示用に丸める */
export function formatValue(v, n) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const digits = v >= 100 ? 0 : n.digits;
  return v.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/**
 * パッケージ表示の値（基準量あたり）を 100g あたりに直す
 * @param {Record<string, any>} values 入力値（空欄は null）
 * @param {number} basisGrams 表示の基準量（g）。例：1パック(45g)あたり → 45
 */
export function labelToPer100g(values, basisGrams) {
  const out = {};
  for (const n of NUTRIENTS) {
    const raw = values[n.key];
    const v = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    out[n.key] = v === null || !Number.isFinite(v) || v < 0 ? null : (v * 100) / basisGrams;
  }
  return out;
}
