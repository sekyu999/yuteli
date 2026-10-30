// 買い物リストの更新ルール。画面や DB には依存しない純粋な関数。
import { shortage } from './product.js';

/**
 * 「リストを更新」で何をするかを計算する。
 *
 * ルール（指示書 4-2）
 * - 不足数 = 目標在庫 − 現在庫。不足がある商品だけ追加する
 * - すでにリストにある商品は追加しない（重複防止）。名前・単位・数量は最新にそろえる
 *   （不足がなくなった場合は数量を変えずに残す＝未購入は持ち越し）
 * - 購入済み抑制中（autoAddSuppressed）の商品は追加しない
 * - 手動追加・健康提案から追加した一時項目には触れない
 *
 * @param {Array} products 全商品
 * @param {Array} items    現在の買い物リスト
 * @returns {{ toAdd: Array<{productId:string,name:string,quantity:number,unit:string,categoryId:string}>,
 *             toUpdate: Array<{id:string, changes:object}> }}
 */
export function planRefresh(products, items) {
  const itemByProduct = new Map();
  for (const it of items) if (it.productId) itemByProduct.set(it.productId, it);

  const toAdd = [];
  const toUpdate = [];

  for (const p of products) {
    const need = shortage(p);
    const existing = itemByProduct.get(p.id);

    if (existing) {
      const changes = {};
      if (existing.name !== p.name) changes.name = p.name;
      if (existing.unit !== p.inventoryUnit) changes.unit = p.inventoryUnit;
      if (existing.categoryId !== p.categoryId) changes.categoryId = p.categoryId;
      if (need > 0 && existing.quantity !== need) changes.quantity = need;
      if (Object.keys(changes).length) toUpdate.push({ id: existing.id, changes });
      continue;
    }

    if (need > 0 && !p.autoAddSuppressed) {
      toAdd.push({
        productId: p.id,
        name: p.name,
        quantity: need,
        unit: p.inventoryUnit,
        categoryId: p.categoryId,
      });
    }
  }

  return { toAdd, toUpdate };
}
