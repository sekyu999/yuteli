// 価格の計算（単位価格・最安判定・入力の検証）。画面や DB には依存しない純粋な関数。
import { normalizeContent } from './units.js';

/** 単位価格の基準：液体は100mlあたり、重量は100gあたり、個数は1個あたり */
export const UNIT_BASE = { ml: 100, g: 100, 個: 1 };

/** 価格記録の1管理単位（1パック・1本…）あたりの価格 */
export function pricePerItem(record) {
  return record.price / record.quantity;
}

/**
 * 単位価格。内容量が登録されていなければ null（無理に計算しない）。
 * 例：1000ml で 238円 → { value: 23.8, label: '100mlあたり', unit: 'ml' }
 * @returns {{ value:number, unit:'g'|'ml'|'個', label:string } | null}
 */
export function unitPrice(record) {
  if (!record.packageContent || !record.packageContentUnit) return null;
  const base = UNIT_BASE[record.packageContentUnit];
  if (!base) return null;
  const value = (pricePerItem(record) / record.packageContent) * base;
  return { value, unit: record.packageContentUnit, label: `${base === 1 ? '1' : base}${record.packageContentUnit}あたり` };
}

/** 新しい順に並べるための比較（購入日 → 登録日時） */
export function newestFirst(a, b) {
  return b.purchasedAt.localeCompare(a.purchasedAt) || b.createdAt.localeCompare(a.createdAt);
}

/**
 * 店舗ごとの最新価格を比べ、最安店舗を決める（指示書 4-4）
 * - 各店舗の最新記録だけを使う
 * - 全店舗の最新記録に同じ種類（g / ml / 個）の内容量があれば単位価格で比較
 * - そうでなければ 1管理単位あたりの価格で比較
 * @param {Array} records その商品の全価格記録
 * @returns {{ mode: 'unit'|'item'|'none', rows: Array<{storeId:string, record:object,
 *            perItem:number, unit:ReturnType<typeof unitPrice>, cheapest:boolean}> }}
 *   rows は安い順
 */
export function compareStores(records) {
  const latest = new Map();
  for (const r of [...records].sort(newestFirst)) if (!latest.has(r.storeId)) latest.set(r.storeId, r);

  const rows = [...latest.values()].map((record) => ({
    storeId: record.storeId,
    record,
    perItem: pricePerItem(record),
    unit: unitPrice(record),
    cheapest: false,
  }));
  if (rows.length === 0) return { mode: 'none', rows };

  const units = new Set(rows.map((r) => r.unit?.unit ?? null));
  const mode = units.size === 1 && !units.has(null) ? 'unit' : 'item';
  const valueOf = (r) => (mode === 'unit' ? r.unit.value : r.perItem);

  rows.sort((a, b) => valueOf(a) - valueOf(b) || newestFirst(a.record, b.record));
  const min = valueOf(rows[0]);
  // 同額なら複数の店舗を最安にする（小数の誤差は無視）
  for (const r of rows) r.cheapest = Math.abs(valueOf(r) - min) < 0.005;
  return { mode, rows };
}

/**
 * 購入日から何日たったか
 * @param {string} date YYYY-MM-DD
 * @param {string} today YYYY-MM-DD
 */
export function daysSince(date, today) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/** これ以上前の価格は「古い」として目立たせる */
export const STALE_DAYS = 90;

/**
 * 価格入力の検証と整形
 * 価格は「税込の支払額（合計）」、数量は「何パック買ったか」
 * @returns {{ ok:true, value:object } | { ok:false, errors:Record<string,string> }}
 */
export function validatePriceInput(raw, today) {
  const errors = {};
  if (!raw.productId) errors.productId = '商品を選んでください';
  if (!raw.storeId) errors.storeId = '店舗を選んでください';

  const price = Number(String(raw.price ?? '').replace(/[,円\s]/g, ''));
  if (!String(raw.price ?? '').trim()) errors.price = '金額を入力してください';
  else if (!Number.isInteger(price) || price <= 0 || price > 1000000) errors.price = '1円以上の整数で入力してください';

  const quantity = Number(raw.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors.quantity = '1以上の整数で入力してください';

  const purchasedAt = String(raw.purchasedAt ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt) || Number.isNaN(Date.parse(purchasedAt)))
    errors.purchasedAt = '日付を入力してください';
  else if (today && purchasedAt > today) errors.purchasedAt = '未来の日付は入力できません';

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
      productId: raw.productId,
      storeId: raw.storeId,
      price,
      quantity,
      packageContent,
      packageContentUnit,
      purchasedAt,
    },
  };
}

/** 金額の表示（整数は「1,234円」、小数は1桁まで） */
export function yen(n) {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}円`;
}
