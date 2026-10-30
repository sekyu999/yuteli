// 店舗と売り場順の読み書き
import { db } from './db.js';
import { newId, nowIso } from '../lib/util.js';
import { nameKey } from '../domain/product.js';
import { orderCategories } from '../domain/shelf.js';
import { ValidationError } from './productRepo.js';

export function listStores() {
  return db.stores.toArray().then((l) => l.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

export function getStore(id) {
  return db.stores.get(id);
}

function checkName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) throw new ValidationError({ name: '店舗名を入力してください' });
  if (name.length > 30) throw new ValidationError({ name: '30文字以内にしてください' });
  return name;
}

async function assertUnique(name, exceptId) {
  const key = nameKey(name);
  const dup = await db.stores.filter((s) => s.id !== exceptId && nameKey(s.name) === key).first();
  if (dup) throw new ValidationError({ name: '同じ名前の店舗がすでにあります' });
}

export async function createStore(rawName) {
  const name = checkName(rawName);
  const store = { id: newId(), name, createdAt: nowIso() };
  await db.transaction('rw', db.stores, async () => {
    await assertUnique(name);
    await db.stores.add(store);
  });
  return store;
}

export async function renameStore(id, rawName) {
  const name = checkName(rawName);
  await db.transaction('rw', db.stores, async () => {
    await assertUnique(name, id);
    await db.stores.update(id, { name });
  });
}

/** 店舗を削除する。売り場順とその店舗の価格記録も削除する */
export async function deleteStore(id) {
  await db.transaction('rw', db.stores, db.storeShelfOrders, db.priceRecords, db.meta, async () => {
    await db.storeShelfOrders.where('storeId').equals(id).delete();
    await db.priceRecords.where('storeId').equals(id).delete();
    await db.stores.delete(id);
    const sel = await db.meta.get('selectedStoreId');
    if (sel?.value === id) await db.meta.delete('selectedStoreId');
  });
}

export function countPriceRecordsOfStore(id) {
  return db.priceRecords.where('storeId').equals(id).count();
}

/** その店舗の売り場順の生データ */
export function getShelfOrders(storeId) {
  if (!storeId) return Promise.resolve([]);
  return db.storeShelfOrders.where('storeId').equals(storeId).toArray();
}

/** その店舗の売り場順に並んだカテゴリ一覧 */
export async function getOrderedCategories(storeId) {
  const [cats, shelf] = await Promise.all([db.categories.toArray(), getShelfOrders(storeId)]);
  return orderCategories(cats, shelf);
}

/**
 * 売り場順を保存する（全カテゴリの並びを丸ごと置き換える）
 * @param {string} storeId
 * @param {string[]} categoryIds 並べたい順のカテゴリID
 */
export async function saveShelfOrder(storeId, categoryIds) {
  await db.transaction('rw', db.storeShelfOrders, async () => {
    await db.storeShelfOrders.where('storeId').equals(storeId).delete();
    await db.storeShelfOrders.bulkAdd(
      categoryIds.map((categoryId, i) => ({ id: newId(), storeId, categoryId, sortOrder: i + 1 }))
    );
  });
}
