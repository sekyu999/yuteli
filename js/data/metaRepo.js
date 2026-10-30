// アプリの設定値など（キーと値の組）の読み書き
import { db } from './db.js';

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value });
}

/** よく使うキー */
export const META = {
  selectedStoreId: 'selectedStoreId', // 買い物リストで選んでいる店舗
  lastBackupAt: 'lastBackupAt', // 最後にバックアップを保存した日時
};
