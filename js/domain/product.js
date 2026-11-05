// 商品入力の検証と整形。画面や DB には依存しない純粋な関数。
import { normalizeContent } from './units.js';
import { MEALS } from './consumption.js';

/** 管理単位の候補（自由入力も可） */
export const INVENTORY_UNITS = ['パック', '本', '袋', '個', '箱', '缶', '枚', '玉', '束', 'kg'];

/**
 * フォームの入力値を検証し、保存できる形に整える。
 * @param {{name?:string, categoryId?:string, inventoryUnit?:string,
 *          currentStock?:any, targetStock?:any,
 *          packageContent?:any, packageContentUnit?:string}} raw
 * @returns {{ ok: true, value: object } | { ok: false, errors: Record<string,string> }}
 */
export function validateProductInput(raw) {
  const errors = {};

  const name = String(raw.name ?? '').trim();
  if (!name) errors.name = '商品名を入力してください';
  else if (name.length > 40) errors.name = '40文字以内にしてください';

  const categoryId = String(raw.categoryId ?? '');
  if (!categoryId) errors.categoryId = 'カテゴリを選んでください';

  const inventoryUnit = String(raw.inventoryUnit ?? '').trim();
  if (!inventoryUnit) errors.inventoryUnit = '単位を入力してください';
  else if (inventoryUnit.length > 10) errors.inventoryUnit = '10文字以内にしてください';

  // 在庫は自動で減ると小数になるため、小数第2位まで受け付ける
  const currentStock = toAmount(raw.currentStock, 999);
  if (currentStock === null) errors.currentStock = '0以上の数で入力してください';

  const targetStock = toCount(raw.targetStock);
  if (targetStock === null) errors.targetStock = '0以上の整数で入力してください';

  // 内容量は任意。数値が空なら「なし」。入力されたのに不正ならエラー。
  let packageContent = null;
  let packageContentUnit = null;
  const contentText = String(raw.packageContent ?? '').trim();
  if (contentText !== '') {
    const c = normalizeContent(Number(contentText), raw.packageContentUnit);
    if (!c) errors.packageContent = '正しい数値を入力してください';
    else {
      packageContent = c.amount;
      packageContentUnit = c.unit;
    }
  }

  // 毎日の量（朝・昼・晩）。空欄は0
  const consumption = {};
  for (const m of MEALS) {
    const v = toAmount(raw[`c_${m.key}`], 100000);
    if (v === null) errors[`c_${m.key}`] = '0以上の数で入力してください';
    consumption[m.key] = v ?? 0;
  }

  // 1個（1パック…）あたりの重さ g。任意
  let gramsPerUnit = null;
  if (String(raw.gramsPerUnit ?? '').trim() !== '') {
    gramsPerUnit = toAmount(raw.gramsPerUnit, 100000);
    if (!gramsPerUnit) errors.gramsPerUnit = '正しい重さを入力してください';
  }

  // 栄養データ（シートで選んだものが JSON 文字列で入る）。任意
  let nutrition = null;
  if (raw.nutrition && typeof raw.nutrition === 'object') nutrition = raw.nutrition;
  else if (String(raw.nutrition ?? '').trim() !== '') {
    try {
      nutrition = JSON.parse(raw.nutrition);
    } catch {
      errors.nutrition = '栄養データが読み取れません';
    }
  }
  if (nutrition && (typeof nutrition.per100g !== 'object' || !nutrition.source)) {
    errors.nutrition = '栄養データの形式が正しくありません';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      categoryId,
      inventoryUnit,
      currentStock,
      targetStock,
      packageContent,
      packageContentUnit,
      consumption,
      gramsPerUnit,
      nutrition,
    },
  };
}

/** 0以上の数（小数第2位まで）に変換。空欄は0。不正なら null */
function toAmount(v, max) {
  const text = String(v ?? '').trim();
  if (text === '') return 0;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

/** 0以上の整数に変換。空欄は0。不正なら null */
function toCount(v) {
  const text = String(v ?? '').trim();
  if (text === '') return 0;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
}

/**
 * 不足数（目標 − 現在。マイナスなら0）。
 * 在庫は自動で減ると小数になる（1.4パックなど）ため、買う数として切り上げて整数にする。
 */
export function shortage(product) {
  const diff = Math.round((product.targetStock - product.currentStock) * 100) / 100;
  return Math.max(0, Math.ceil(diff - 1e-9));
}

/** 商品名の比較用（全角半角・大文字小文字・前後空白の違いを無視） */
export function nameKey(name) {
  return String(name).normalize('NFKC').trim().toLowerCase();
}
