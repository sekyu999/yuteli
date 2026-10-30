// データ保護とデータ量の確認
import { db, TABLES } from './db.js';

/**
 * ブラウザに「このサイトのデータを勝手に消さないで」と頼む。
 * iPhone ではホーム画面に追加した状態で効果がある。
 * @returns {Promise<boolean>} 保護されていれば true
 */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function isPersisted() {
  return (await navigator.storage?.persisted?.()) ?? false;
}

/** ホーム画面から起動しているか */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  );
}

/** 各テーブルの件数 */
export async function countAll() {
  const result = {};
  for (const name of TABLES) result[name] = await db.table(name).count();
  return result;
}
