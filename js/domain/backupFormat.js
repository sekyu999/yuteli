// バックアップ JSON の形式・検証・移行。画面や DB には依存しない純粋な関数。
//
// 形式：
// {
//   "app": "yuteli",
//   "schemaVersion": 1,            … データ構造の版。構造を変えたら上げて MIGRATIONS に変換を書く
//   "exportedAt": "2026-10-30T…",
//   "data": { "categories": [...], "products": [...], … }
// }

export const APP_ID = 'yuteli';
export const CURRENT_SCHEMA_VERSION = 1;

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isStrOrNull = (v) => v === null || v === undefined || typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;

/** テーブルごとの必須項目チェック。問題があれば理由を返す */
const RULES = {
  categories: (r) => (!isStr(r.name) ? 'name' : !isNum(r.defaultOrder) ? 'defaultOrder' : null),
  products: (r) =>
    !isStr(r.name)
      ? 'name'
      : !isStrOrNull(r.categoryId)
        ? 'categoryId'
        : !isStr(r.inventoryUnit)
          ? 'inventoryUnit'
          : !isCount(r.currentStock)
            ? 'currentStock'
            : !isCount(r.targetStock)
              ? 'targetStock'
              : null,
  stores: (r) => (!isStr(r.name) ? 'name' : null),
  storeShelfOrders: (r) =>
    !isStr(r.storeId) ? 'storeId' : !isStr(r.categoryId) ? 'categoryId' : !isNum(r.sortOrder) ? 'sortOrder' : null,
  shoppingListItems: (r) =>
    !isStr(r.name) ? 'name' : !isNum(r.quantity) ? 'quantity' : !isStrOrNull(r.productId) ? 'productId' : null,
  priceRecords: (r) =>
    !isStr(r.productId)
      ? 'productId'
      : !isStr(r.storeId)
        ? 'storeId'
        : !isNum(r.price)
          ? 'price'
          : !isNum(r.quantity)
            ? 'quantity'
            : !isStr(r.purchasedAt)
              ? 'purchasedAt'
              : null,
};

export const BACKUP_TABLES = Object.keys(RULES);

/**
 * 古い版のバックアップを今の版に変換する関数。
 * 例：版2で項目を追加したら  2: (b) => { …版1→版2の変換… ; return b; }
 */
const MIGRATIONS = {};

/** バックアップ用のオブジェクトを作る */
export function buildBackup(data, exportedAt) {
  const out = { app: APP_ID, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt, data: {} };
  for (const t of BACKUP_TABLES) out.data[t] = data[t] ?? [];
  return out;
}

/**
 * 読み込んだ文字列を検証し、今の版に変換する。
 * @param {string} text
 * @returns {{ ok: true, backup: object, counts: Record<string, number> } | { ok: false, error: string }}
 */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読み込めませんでした。ファイルが壊れているか、別のファイルです。' };
  }
  if (!obj || typeof obj !== 'object' || obj.app !== APP_ID) {
    return { ok: false, error: 'YUTELI のバックアップファイルではありません。' };
  }
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) {
    return { ok: false, error: 'バックアップの版が読み取れません。' };
  }
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: 'このバックアップは新しい版のアプリで作られています。アプリを最新にしてから読み込んでください。' };
  }
  if (!obj.data || typeof obj.data !== 'object') {
    return { ok: false, error: 'データ部分がありません。' };
  }

  // 版を順に上げる
  let backup = structuredClone(obj);
  for (let v = backup.schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    backup = MIGRATIONS[v](backup);
    backup.schemaVersion = v;
  }

  const counts = {};
  for (const t of BACKUP_TABLES) {
    const rows = backup.data[t] ?? [];
    if (!Array.isArray(rows)) return { ok: false, error: `「${t}」の形式が正しくありません。` };
    const ids = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || typeof r !== 'object' || !isStr(r.id)) return { ok: false, error: `「${t}」の${i + 1}件目に ID がありません。` };
      if (ids.has(r.id)) return { ok: false, error: `「${t}」に同じ ID が重複しています。` };
      ids.add(r.id);
      const bad = RULES[t](r);
      if (bad) return { ok: false, error: `「${t}」の${i + 1}件目の「${bad}」が正しくありません。` };
    }
    backup.data[t] = rows;
    counts[t] = rows.length;
  }
  if (counts.categories === 0) return { ok: false, error: 'カテゴリが1件もありません。' };

  return { ok: true, backup, counts };
}

/** バックアップのファイル名（yuteli-backup-20261030-1953.json） */
export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `yuteli-backup-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}
