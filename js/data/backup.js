// バックアップの書き出し・復元・初期化
import { db, DATA_TABLES, SCHEMA_VERSION, defaultCategoryRows } from './db.js';
import { setMeta, getMeta, META } from './metaRepo.js';
import { buildBackup, backupFileName } from '../domain/backupFormat.js';
import { nowIso } from '../lib/util.js';
import { t } from '../lib/i18n.js';

/** 今のデータからバックアップ用の文字列とファイル名を作る */
export async function createBackupFile() {
  const data = {};
  await db.transaction('r', DATA_TABLES.map((name) => db.table(name)), async () => {
    for (const name of DATA_TABLES) data[name] = await db.table(name).toArray();
  });
  const settings = { profile: await getMeta(META.profile), note: (await getMeta(META.note))?.text ?? '' };
  const json = JSON.stringify(buildBackup(data, nowIso(), settings), null, 2);
  return { json, filename: backupFileName() };
}

/**
 * バックアップを保存する。
 * iPhone では共有シート（「"ファイル"に保存」など）を出し、使えない環境ではダウンロードする。
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function saveBackup() {
  const { json, filename } = await createBackupFile();
  const file = new File([json], filename, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t('KESELA バックアップ') });
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      throw e;
    }
    await setMeta(META.lastBackupAt, nowIso());
    return 'shared';
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await setMeta(META.lastBackupAt, nowIso());
  return 'downloaded';
}

/** 今のデータ件数（復元確認の比較用） */
export async function currentCounts() {
  const counts = {};
  for (const name of DATA_TABLES) counts[name] = await db.table(name).count();
  return counts;
}

/**
 * 検証済みのバックアップで全データを置き換える（parseBackup の結果の backup を渡す）
 */
export async function restoreBackup(backup) {
  await db.transaction('rw', [...DATA_TABLES.map((name) => db.table(name)), db.meta], async () => {
    for (const name of DATA_TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(backup.data[name] ?? []);
    }
    await db.meta.delete(META.selectedStoreId);
    if (backup.settings?.profile) await db.meta.put({ key: META.profile, value: backup.settings.profile });
    // 目標メモ（v1.5 より前のバックアップには無いので、その時は今のメモを残す）
    if (typeof backup.settings?.note === 'string') await db.meta.put({ key: META.note, value: { text: backup.settings.note, updatedAt: nowIso() } });
    await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  });
}

/** すべてのデータを消して、最初の状態（初期カテゴリだけ）に戻す */
export async function resetAll() {
  await db.transaction('rw', [...DATA_TABLES.map((name) => db.table(name)), db.meta], async () => {
    for (const name of DATA_TABLES) await db.table(name).clear();
    // 最終バックアップ日は残す（バックアップファイル自体は手元に残っているため）
    const last = await db.meta.get(META.lastBackupAt);
    await db.meta.clear();
    if (last) await db.meta.put(last);
    await db.categories.bulkAdd(defaultCategoryRows());
    await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  });
}
