// カテゴリの読み書き
import { db } from './db.js';

/** 並び順どおりの全カテゴリ */
export function listCategories() {
  return db.categories.orderBy('defaultOrder').toArray();
}
