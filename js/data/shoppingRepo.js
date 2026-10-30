// 買い物リストの読み書き
import { db } from './db.js';
import { newId, nowIso } from '../lib/util.js';
import { planRefresh } from '../domain/shoppingList.js';
import { nameKey } from '../domain/product.js';
import { setSuppressed } from './productRepo.js';

/**
 * @typedef {Object} ShoppingListItem
 * @property {string} id
 * @property {string|null} productId   一時項目は null
 * @property {string} name
 * @property {number} quantity
 * @property {string|null} unit
 * @property {string|null} categoryId
 * @property {'master'|'temporary'} type
 * @property {'auto'|'manual'|'health'} source  どこから追加されたか
 * @property {'pending'} status                 購入済みは削除するので常に pending
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function listItems() {
  return db.shoppingListItems.toArray();
}

/**
 * 「リストを更新」。在庫を見て不足品を追加する。
 * @returns {Promise<{added:number, updated:number}>}
 */
export async function refreshFromStock() {
  return db.transaction('rw', db.products, db.shoppingListItems, async () => {
    const [products, items] = await Promise.all([db.products.toArray(), db.shoppingListItems.toArray()]);
    const { toAdd, toUpdate } = planRefresh(products, items);
    const t = nowIso();
    await db.shoppingListItems.bulkAdd(
      toAdd.map((a) => ({
        id: newId(),
        ...a,
        type: 'master',
        source: 'auto',
        status: 'pending',
        createdAt: t,
        updatedAt: t,
      }))
    );
    for (const u of toUpdate) await db.shoppingListItems.update(u.id, { ...u.changes, updatedAt: t });
    return { added: toAdd.length, updated: toUpdate.filter((u) => 'quantity' in u.changes).length };
  });
}

/**
 * 手動で追加する（健康提案からの追加もこれを使う）。
 * 商品マスタに同じ名前の商品があれば、その商品として追加する（価格記録や購入済み抑制が効くように）。
 * 商品マスタには登録しない。
 * @param {{name:string, quantity?:number, unit?:string|null, categoryId?:string|null, source?:'manual'|'health'}} input
 * @returns {Promise<{status:'added'|'exists', item:ShoppingListItem}>}
 */
export async function addManualItem(input) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('商品名を入力してください');
  const quantity = Math.min(999, Math.max(1, Math.floor(Number(input.quantity) || 1)));

  return db.transaction('rw', db.products, db.shoppingListItems, async () => {
    const key = nameKey(name);
    const items = await db.shoppingListItems.toArray();
    const dup = items.find((i) => nameKey(i.name) === key);
    if (dup) return { status: 'exists', item: dup };

    const product = await db.products.filter((p) => nameKey(p.name) === key).first();
    const t = nowIso();
    /** @type {ShoppingListItem} */
    const item = product
      ? {
          id: newId(),
          productId: product.id,
          name: product.name,
          quantity,
          unit: product.inventoryUnit,
          categoryId: product.categoryId,
          type: 'master',
          source: input.source ?? 'manual',
          status: 'pending',
          createdAt: t,
          updatedAt: t,
        }
      : {
          id: newId(),
          productId: null,
          name,
          quantity,
          unit: String(input.unit ?? '').trim() || null,
          categoryId: input.categoryId || null,
          type: 'temporary',
          source: input.source ?? 'manual',
          status: 'pending',
          createdAt: t,
          updatedAt: t,
        };
    await db.shoppingListItems.add(item);
    return { status: 'added', item };
  });
}

/** 数量・単位・カテゴリを変更する */
export async function updateItem(id, changes) {
  const next = { updatedAt: nowIso() };
  if ('quantity' in changes) next.quantity = Math.min(999, Math.max(1, Math.floor(Number(changes.quantity) || 1)));
  if ('unit' in changes) next.unit = String(changes.unit ?? '').trim() || null;
  if ('categoryId' in changes) next.categoryId = changes.categoryId || null;
  await db.shoppingListItems.update(id, next);
}

/**
 * 購入済みにする。
 * - リストから削除する（一時項目もここで消える）
 * - 在庫数は変えない
 * - 商品マスタの品は、次の在庫変更（または見直し完了）まで自動追加の対象から外す
 * @returns {Promise<{item:ShoppingListItem, prevSuppressed:boolean}|null>} 取り消し用の情報
 */
export async function markPurchased(id) {
  return db.transaction('rw', db.products, db.shoppingListItems, async () => {
    const item = await db.shoppingListItems.get(id);
    if (!item) return null;
    let prevSuppressed = false;
    if (item.productId) {
      const p = await db.products.get(item.productId);
      if (p) {
        prevSuppressed = !!p.autoAddSuppressed;
        await setSuppressed(p.id, true);
      }
    }
    await db.shoppingListItems.delete(id);
    return { item, prevSuppressed };
  });
}

/** 購入済みの取り消し（markPurchased の戻り値を渡す） */
export async function undoPurchased(undo) {
  if (!undo) return;
  await db.transaction('rw', db.products, db.shoppingListItems, async () => {
    await db.shoppingListItems.put(undo.item);
    if (undo.item.productId && (await db.products.get(undo.item.productId))) {
      await setSuppressed(undo.item.productId, undo.prevSuppressed);
    }
  });
}

/**
 * リストから削除する（今回は買わない時）。
 * 商品マスタの品は、すぐ次の更新で復活しないよう購入済みと同じく自動追加を止める。
 * @returns 取り消し用の情報（undoPurchased に渡せる）
 */
export async function removeItem(id) {
  return markPurchased(id);
}
