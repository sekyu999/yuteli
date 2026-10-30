// カテゴリの読み書き
import { db } from './db.js';
import { newId } from '../lib/util.js';
import { nameKey } from '../domain/product.js';
import { ValidationError } from './productRepo.js';

/** 並び順どおりの全カテゴリ */
export function listCategories() {
  return db.categories.orderBy('defaultOrder').toArray();
}

function checkName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) throw new ValidationError({ name: 'カテゴリ名を入力してください' });
  if (name.length > 20) throw new ValidationError({ name: '20文字以内にしてください' });
  return name;
}

async function assertUnique(name, exceptId) {
  const key = nameKey(name);
  const dup = await db.categories.filter((c) => c.id !== exceptId && nameKey(c.name) === key).first();
  if (dup) throw new ValidationError({ name: '同じ名前のカテゴリがすでにあります' });
}

export async function addCategory(rawName) {
  const name = checkName(rawName);
  return db.transaction('rw', db.categories, async () => {
    await assertUnique(name);
    const last = await db.categories.orderBy('defaultOrder').last();
    const cat = { id: newId(), name, defaultOrder: (last?.defaultOrder ?? 0) + 1 };
    await db.categories.add(cat);
    return cat;
  });
}

export async function renameCategory(id, rawName) {
  const name = checkName(rawName);
  await db.transaction('rw', db.categories, async () => {
    await assertUnique(name, id);
    await db.categories.update(id, { name });
  });
}

/** 標準の並び順を保存する */
export async function saveCategoryOrder(ids) {
  await db.transaction('rw', db.categories, async () => {
    for (let i = 0; i < ids.length; i++) await db.categories.update(ids[i], { defaultOrder: i + 1 });
  });
}

export function countProductsInCategory(id) {
  return db.products.where('categoryId').equals(id).count();
}

/**
 * カテゴリを削除する。商品が使っている間は削除できない。
 * 売り場順からも外し、買い物リストの項目は「未分類」にする。
 */
export async function deleteCategory(id) {
  await db.transaction('rw', db.categories, db.products, db.storeShelfOrders, db.shoppingListItems, async () => {
    const n = await db.products.where('categoryId').equals(id).count();
    if (n) throw new ValidationError({ name: `このカテゴリの商品が${n}件あるため削除できません` });
    if ((await db.categories.count()) <= 1) throw new ValidationError({ name: 'カテゴリは最低1つ必要です' });
    await db.storeShelfOrders.filter((s) => s.categoryId === id).delete();
    await db.shoppingListItems.filter((i) => i.categoryId === id).modify({ categoryId: null });
    await db.categories.delete(id);
  });
}
