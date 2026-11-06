// データベース定義。Dexie を直接使うのは data/ フォルダの中だけ。
import Dexie from '../../vendor/dexie.mjs';
import { newId, todayLocal } from '../lib/util.js';
import { CURRENT_SCHEMA_VERSION } from '../domain/backupFormat.js';
import { DEFAULT_CATEGORIES, splitCategories, mergeCategories } from '../domain/categories.js';

/** データ構造の版（バックアップにも記録する） */
export const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

// データベース名は旧名（yuteli）のまま。変えると端末に保存済みのデータが読めなくなるため
export const db = new Dexie('yuteli');

// 「主キー, 検索に使う項目…」の形で書く。ここに無い項目も保存はできる。
db.version(1).stores({
  categories: 'id, defaultOrder',
  products: 'id, categoryId, name',
  stores: 'id, name',
  storeShelfOrders: 'id, storeId, [storeId+categoryId]',
  shoppingListItems: 'id, productId',
  priceRecords: 'id, productId, storeId, [productId+storeId], purchasedAt',
  meta: 'key',
});

// 版2：毎日の量（朝昼晩）・栄養データ・1個の重さ・在庫を確定した日 を商品に追加
db.version(2)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('products')
      .toCollection()
      .modify((p) => {
        p.consumption ??= { breakfast: 0, lunch: 0, dinner: 0 };
        p.gramsPerUnit ??= null;
        p.nutrition ??= null;
        p.stockUpdatedOn ??= todayLocal();
      })
  );

// 版3：食事グループを追加。「野菜・果物」などの「・」区切りカテゴリを分け、「缶詰」を追加
db.version(3)
  .stores({ foodGroups: 'id' })
  .upgrade(async (tx) => {
    const categories = await tx.table('categories').toArray();
    const storeShelfOrders = await tx.table('storeShelfOrders').toArray();
    const r = splitCategories({ categories, storeShelfOrders }, newId);
    if (!r.changed) return;
    await tx.table('categories').clear();
    await tx.table('categories').bulkAdd(r.categories);
    await tx.table('storeShelfOrders').clear();
    await tx.table('storeShelfOrders').bulkAdd(r.storeShelfOrders);
  });

// 版4：家計（買いたい物・やりたい事）を追加。商品に並び順を追加。分けたカテゴリを「・」でまとめ直す
db.version(4)
  .stores({ plans: 'id, month' })
  .upgrade(async (tx) => {
    const [categories, storeShelfOrders, products, shoppingListItems] = await Promise.all(
      ['categories', 'storeShelfOrders', 'products', 'shoppingListItems'].map((t) => tx.table(t).toArray())
    );
    const r = mergeCategories({ categories, storeShelfOrders, products, shoppingListItems });
    const prods = withSortOrder(r.products);
    for (const [name, rows] of [
      ['categories', r.categories],
      ['storeShelfOrders', r.storeShelfOrders],
      ['products', prods],
      ['shoppingListItems', r.shoppingListItems],
    ]) {
      await tx.table(name).clear();
      await tx.table(name).bulkAdd(rows);
    }
  });

/** 並び順のない商品に、カテゴリごと名前順の sortOrder を付ける */
export function withSortOrder(products) {
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return sorted.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i + 1 }));
}

export { DEFAULT_CATEGORIES };

/** 初期カテゴリのデータを作る（初回起動・初期化で使う） */
export function defaultCategoryRows() {
  return DEFAULT_CATEGORIES.map((name, i) => ({ id: newId(), name, defaultOrder: i + 1 }));
}

// データベースが初めて作られた時だけ実行される
db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(defaultCategoryRows());
  tx.table('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
});

/** ユーザーのデータが入るテーブル（バックアップ対象） */
export const DATA_TABLES = [
  'categories',
  'products',
  'stores',
  'storeShelfOrders',
  'shoppingListItems',
  'priceRecords',
  'foodGroups',
  'plans',
];

/** 全テーブル名 */
export const TABLES = [
  'categories',
  'products',
  'stores',
  'storeShelfOrders',
  'shoppingListItems',
  'priceRecords',
  'foodGroups',
  'plans',
  'meta',
];
