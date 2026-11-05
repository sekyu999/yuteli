// 商品マスタの読み書き
// 購入済み抑制フラグ（autoAddSuppressed）の切り替えはこのファイルの中だけで行う。
import { db } from './db.js';
import { newId, nowIso, todayLocal } from '../lib/util.js';
import { effectiveStock, round2 } from '../domain/consumption.js';
import { validateProductInput, nameKey } from '../domain/product.js';

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} categoryId
 * @property {string} inventoryUnit       管理単位（パック、本…）
 * @property {number} currentStock
 * @property {number} targetStock
 * @property {number|null} packageContent 内容量（任意。g / ml / 個 に正規化済み）
 * @property {'g'|'ml'|'個'|null} packageContentUnit
 * @property {boolean} autoAddSuppressed  購入済みのため自動追加を止めている
 * @property {{breakfast:number, lunch:number, dinner:number}} consumption 毎日の量（入力単位）
 * @property {number|null} gramsPerUnit   入力単位1つの重さ g（個・パックで入力する場合の栄養計算用）
 * @property {{source:'mext'|'label', code?:string, name:string, per100g:object, basisGrams?:number}|null} nutrition
 * @property {string} stockUpdatedOn      currentStock を確定した日（ここから毎日の量ぶん自動で減る）
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** 入力エラー。画面側で項目ごとのメッセージを表示するのに使う */
export class ValidationError extends Error {
  /** @param {Record<string,string>} errors */
  constructor(errors) {
    super(Object.values(errors)[0]);
    this.errors = errors;
  }
}

export function listProducts() {
  return db.products.toArray().then((list) => list.sort((a, b) => a.name.localeCompare(b.name, 'ja')));
}

export function getProduct(id) {
  return db.products.get(id);
}

async function assertUniqueName(name, exceptId) {
  const key = nameKey(name);
  const dup = await db.products.filter((p) => p.id !== exceptId && nameKey(p.name) === key).first();
  if (dup) throw new ValidationError({ name: '同じ名前の商品がすでにあります' });
}

/**
 * 商品を登録する。入力が不正なら ValidationError を投げる。
 * @returns {Promise<Product>}
 */
export async function createProduct(raw) {
  const r = validateProductInput(raw);
  if (!r.ok) throw new ValidationError(r.errors);
  const t = nowIso();
  /** @type {Product} */
  const product = {
    id: newId(),
    ...r.value,
    autoAddSuppressed: false,
    stockUpdatedOn: todayLocal(),
    createdAt: t,
    updatedAt: t,
  };
  await db.transaction('rw', db.products, async () => {
    await assertUniqueName(product.name);
    await db.products.add(product);
  });
  return product;
}

/**
 * 編集フォームの内容で商品を更新する。入力が不正なら ValidationError。
 * 在庫数か目標在庫が変わったら購入済み抑制を解除する。
 */
export async function saveProduct(id, raw) {
  const r = validateProductInput(raw);
  if (!r.ok) throw new ValidationError(r.errors);
  await db.transaction('rw', db.products, async () => {
    await assertUniqueName(r.value.name, id);
    await applyChanges(id, r.value);
  });
}

/** 在庫数を ±delta する（0〜999 の範囲に収める） */
export async function changeStock(id, delta) {
  // 読み出しと書き込みを1つのトランザクションにまとめ、連打しても数がずれないようにする
  await db.transaction('rw', db.products, async () => {
    const cur = await db.products.get(id);
    if (!cur) return;
    // 自動で減った分を反映した「今日の在庫」から増減する
    const next = Math.min(999, Math.max(0, round2(effectiveStock(cur, todayLocal()) + delta)));
    await applyChanges(id, { currentStock: next }, { userChangedStock: true });
  });
}

/**
 * 購入済み抑制フラグを設定する（買い物リストで購入済みにした時・取り消した時に使う）。
 * updatedAt は変えない（ユーザーが商品を編集したわけではないため）。
 */
export async function setSuppressed(id, flag) {
  await db.products.update(id, { autoAddSuppressed: !!flag });
}

/** 「見直し完了」：全商品の購入済み抑制を解除する */
export async function clearAllSuppression() {
  await db.products.toCollection().modify({ autoAddSuppressed: false });
}

/**
 * 商品を削除する。その商品の買い物リスト項目と価格記録も一緒に削除する
 * （商品がなくなると価格記録は表示できないため）。画面側で件数を見せて確認してから呼ぶ。
 */
export async function deleteProduct(id) {
  await db.transaction('rw', db.products, db.shoppingListItems, db.priceRecords, async () => {
    await db.shoppingListItems.where('productId').equals(id).delete();
    await db.priceRecords.where('productId').equals(id).delete();
    await db.products.delete(id);
  });
}

/** 商品に関連するデータの件数（削除確認で表示する） */
export async function countRelated(id) {
  const [listItems, priceRecords] = await Promise.all([
    db.shoppingListItems.where('productId').equals(id).count(),
    db.priceRecords.where('productId').equals(id).count(),
  ]);
  return { listItems, priceRecords };
}

// ---- 内部用 ----

/**
 * 変更を書き込む共通処理。必ずトランザクションの中から呼ぶ。
 * - 在庫は「今日の在庫（自動で減った後）」で確定し直す（毎日の量を変えても過去の分がずれないように）
 * - ユーザーが在庫数か目標在庫を変えたら購入済み抑制を解除する
 */
async function applyChanges(id, changes, { userChangedStock = false } = {}) {
  const cur = await db.products.get(id);
  if (!cur) throw new Error('商品が見つかりません');
  const today = todayLocal();
  const nowStock = effectiveStock(cur, today);
  const nextStock = 'currentStock' in changes ? changes.currentStock : nowStock;
  const stockChanged =
    userChangedStock ||
    Math.abs(nextStock - nowStock) > 0.004 ||
    ('targetStock' in changes && changes.targetStock !== cur.targetStock);
  const next = { ...changes, currentStock: nextStock, stockUpdatedOn: today, updatedAt: nowIso() };
  delete next.id;
  delete next.createdAt;
  if (stockChanged) next.autoAddSuppressed = false;
  await db.products.update(id, next);
}
