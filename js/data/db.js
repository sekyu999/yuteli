// データベース定義。Dexie を直接使うのは data/ フォルダの中だけ。
import Dexie from '../../vendor/dexie.mjs';
import { newId } from '../lib/util.js';
import { CURRENT_SCHEMA_VERSION } from '../domain/backupFormat.js';

/** データ構造の版（バックアップにも記録する） */
export const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

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

/** 初回起動時に入れるカテゴリ（設定画面で変更できる） */
export const DEFAULT_CATEGORIES = [
  '野菜・果物',
  '肉・魚',
  '乳製品',
  '卵',
  '納豆・豆腐',
  'パン・米・麺',
  '調味料',
  '飲料',
  '日用品',
  'その他',
];

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
];

/** 全テーブル名 */
export const TABLES = [
  'categories',
  'products',
  'stores',
  'storeShelfOrders',
  'shoppingListItems',
  'priceRecords',
  'meta',
];
