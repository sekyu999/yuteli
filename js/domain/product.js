// 商品入力の検証と整形。画面や DB には依存しない純粋な関数。
import { normalizeContent } from './units.js';

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

  const currentStock = toCount(raw.currentStock);
  if (currentStock === null) errors.currentStock = '0以上の整数で入力してください';

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
    },
  };
}

/** 0以上の整数に変換。空欄は0。不正なら null */
function toCount(v) {
  const text = String(v ?? '').trim();
  if (text === '') return 0;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
}

/** 不足数（目標 − 現在。マイナスなら0） */
export function shortage(product) {
  return Math.max(0, product.targetStock - product.currentStock);
}

/** 商品名の比較用（全角半角・大文字小文字・前後空白の違いを無視） */
export function nameKey(name) {
  return String(name).normalize('NFKC').trim().toLowerCase();
}
