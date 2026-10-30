// 商品マスタの読み書き
// 購入済み抑制フラグ（autoAddSuppressed）の切り替えはこのファイルの中だけで行う。
import { db } from './db.js';
import { newId, nowIso } from '../lib/util.js';

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} categoryId
 * @property {string} inventoryUnit       管理単位（パック、本…）
 * @property {number} currentStock
 * @property {number} targetStock
 * @property {number|null} packageContent 内容量（任意）
 * @property {'g'|'ml'|'個'|null} packageContentUnit
 * @property {boolean} autoAddSuppressed  購入済みのため自動追加を止めている
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function listProducts() {
  return db.products.orderBy('name').toArray();
}

export function getProduct(id) {
  return db.products.get(id);
}

/** @param {Omit<Product,'id'|'createdAt'|'updatedAt'|'autoAddSuppressed'>} input */
export async function createProduct(input) {
  const t = nowIso();
  /** @type {Product} */
  const product = {
    id: newId(),
    name: input.name.trim(),
    categoryId: input.categoryId,
    inventoryUnit: input.inventoryUnit,
    currentStock: input.currentStock ?? 0,
    targetStock: input.targetStock ?? 0,
    packageContent: input.packageContent ?? null,
    packageContentUnit: input.packageContentUnit ?? null,
    autoAddSuppressed: false,
    createdAt: t,
    updatedAt: t,
  };
  await db.products.add(product);
  return product;
}

/**
 * 商品を更新する。在庫数か目標在庫が変わったら購入済み抑制を解除する。
 * @param {string} id
 * @param {Partial<Product>} changes
 */
export async function updateProduct(id, changes) {
  await db.transaction('rw', db.products, async () => {
    const cur = await db.products.get(id);
    if (!cur) throw new Error('商品が見つかりません');
    const stockChanged =
      ('currentStock' in changes && changes.currentStock !== cur.currentStock) ||
      ('targetStock' in changes && changes.targetStock !== cur.targetStock);
    const next = { ...changes, updatedAt: nowIso() };
    delete next.id;
    delete next.createdAt;
    if (stockChanged) next.autoAddSuppressed = false;
    await db.products.update(id, next);
  });
}

/** 在庫数を ±delta する（0未満にはしない） */
export async function changeStock(id, delta) {
  const cur = await db.products.get(id);
  if (!cur) return;
  await updateProduct(id, { currentStock: Math.max(0, cur.currentStock + delta) });
}

/** 「見直し完了」：全商品の購入済み抑制を解除する */
export async function clearAllSuppression() {
  await db.products.where('id').above('').modify({ autoAddSuppressed: false });
}

export async function deleteProduct(id) {
  await db.products.delete(id);
}
