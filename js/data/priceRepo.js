// 価格記録の読み書き。v1.11 から「商品×店舗ごとに1件」（日付で分けない）。価格は1個（管理単位）あたり
import { db } from './db.js';
import { newId, nowIso, todayLocal } from '../lib/util.js';
import { validatePriceInput, newestFirst } from '../domain/pricing.js';
import { ValidationError } from './productRepo.js';

/**
 * @typedef {Object} PriceRecord
 * @property {string} id
 * @property {string} productId
 * @property {string} storeId
 * @property {number} price          税込の支払額（合計）
 * @property {number} quantity       購入数量（管理単位）
 * @property {number|null} packageContent
 * @property {'g'|'ml'|'個'|null} packageContentUnit
 * @property {string} purchasedAt    YYYY-MM-DD
 * @property {string|null} rawName   将来のレシート読み取り用（今は null）
 * @property {string} createdAt
 */

/**
 * その店舗の価格を記録する（すでにあれば置き換える）。入力が不正なら ValidationError
 * price は1個（管理単位）あたりの税込金額。数量は1、購入日は今日として保存する（計算・バックアップの形は今までどおり）
 */
export async function setStorePrice(raw) {
  const r = validatePriceInput({ ...raw, quantity: 1, purchasedAt: todayLocal() }, todayLocal());
  if (!r.ok) throw new ValidationError(r.errors);
  const t = nowIso();
  /** @type {PriceRecord} */
  const record = { id: newId(), ...r.value, rawName: null, createdAt: t, updatedAt: t };
  await db.transaction('rw', db.priceRecords, async () => {
    // 同じ商品・店舗の古い記録（v1.10 までの履歴も）は消して1件にする
    await db.priceRecords.where('[productId+storeId]').equals([record.productId, record.storeId]).delete();
    await db.priceRecords.add(record);
  });
  return record;
}

/** その商品の全記録（新しい順） */
export async function listByProduct(productId) {
  const list = await db.priceRecords.where('productId').equals(productId).toArray();
  return list.sort(newestFirst);
}

export function listAllRecords() {
  return db.priceRecords.toArray();
}

/** その商品・店舗の記録を削除する（古い履歴も含めて） */
export async function deleteStorePrice(productId, storeId) {
  await db.priceRecords.where('[productId+storeId]').equals([productId, storeId]).delete();
}

/** その商品・店舗の最新の記録（入力欄の初期値に使う） */
export async function latestFor(productId, storeId) {
  const list = await db.priceRecords.where('[productId+storeId]').equals([productId, storeId]).toArray();
  return list.sort(newestFirst)[0] ?? null;
}
