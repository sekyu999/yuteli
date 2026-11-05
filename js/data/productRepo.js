// 商品マスタの読み書き
// 購入済み抑制フラグ（autoAddSuppressed）の切り替えはこのファイルの中だけで行う。
import { db } from './db.js';
import { newId, nowIso } from '../lib/util.js';
import { round2 } from '../domain/consumption.js';
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

/** 並び順（ドラッグで決めた順）どおりの全商品 */
export function listProducts() {
  return db.products.toArray().then((list) => list.sort(byOrder));
}

/** 商品の並び順：sortOrder → 名前 */
export function byOrder(a, b) {
  return (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name, 'ja');
}

/**
 * 並べ替えを保存する（同じカテゴリ内の商品IDを新しい順で渡す）。
 * その商品たちが使っていた並び番号を、新しい順に配り直す（ほかのカテゴリの順は変わらない）
 */
export async function saveProductOrder(ids) {
  await db.transaction('rw', db.products, async () => {
    const list = (await db.products.bulkGet(ids)).filter(Boolean);
    const slots = list.map((p) => p.sortOrder ?? 1e9).sort((a, b) => a - b);
    // 番号が重複・未設定なら、末尾に続く番号を振り直す
    const unique = new Set(slots).size === slots.length && slots.every((x) => x < 1e9);
    const all = unique ? slots : await nextOrders(slots.length);
    for (let i = 0; i < ids.length; i++) await db.products.update(ids[i], { sortOrder: all[i] });
  });
}

async function nextOrders(n) {
  const max = (await db.products.toArray()).reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0);
  return Array.from({ length: n }, (_, i) => max + i + 1);
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
    sortOrder: 0, // 下で末尾の番号にする
    createdAt: t,
    updatedAt: t,
  };
  await db.transaction('rw', db.products, async () => {
    await assertUniqueName(product.name);
    product.sortOrder = (await nextOrders(1))[0];
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
    const next = Math.min(999, Math.max(0, round2(cur.currentStock + delta)));
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
  const { removeProductFromGroups } = await import('./groupRepo.js');
  await db.transaction('rw', db.products, db.shoppingListItems, db.priceRecords, db.foodGroups, async () => {
    await removeProductFromGroups(id);
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
 * ユーザーが在庫数か目標在庫を変えたら購入済み抑制を解除する。
 */
async function applyChanges(id, changes, { userChangedStock = false } = {}) {
  const cur = await db.products.get(id);
  if (!cur) throw new Error('商品が見つかりません');
  const stockChanged =
    userChangedStock ||
    ('currentStock' in changes && Math.abs(changes.currentStock - cur.currentStock) > 0.004) ||
    ('targetStock' in changes && changes.targetStock !== cur.targetStock);
  const next = { ...changes, updatedAt: nowIso() };
  delete next.id;
  delete next.createdAt;
  delete next.ownConsumption;
  delete next.groupIds;
  if (stockChanged) next.autoAddSuppressed = false;
  await db.products.update(id, next);
}

