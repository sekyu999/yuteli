// 価格記録の読み書き（履歴は残し続ける）
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

/** 価格を記録する。入力が不正なら ValidationError */
export async function addPriceRecord(raw) {
  const r = validatePriceInput(raw, todayLocal());
  if (!r.ok) throw new ValidationError(r.errors);
  /** @type {PriceRecord} */
  const record = { id: newId(), ...r.value, rawName: null, createdAt: nowIso() };
  await db.priceRecords.add(record);
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

/** 入力ミスの記録を削除する */
export async function deletePriceRecord(id) {
  await db.priceRecords.delete(id);
}

/** その商品・店舗の最新の記録（入力欄の初期値に使う） */
export async function latestFor(productId, storeId) {
  const list = await db.priceRecords.where('[productId+storeId]').equals([productId, storeId]).toArray();
  return list.sort(newestFirst)[0] ?? null;
}
