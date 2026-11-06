// バックアップ JSON の形式・検証・移行。画面や DB には依存しない純粋な関数。
//
// 形式：
// {
//   "app": "kesela",            … 旧名 yuteli のバックアップも読める
//   "schemaVersion": 1,            … データ構造の版。構造を変えたら上げて MIGRATIONS に変換を書く
//   "exportedAt": "2026-10-30T…",
//   "data": { "categories": [...], "products": [...], … }
// }

import { splitCategories, mergeCategories } from './categories.js';
import { newId } from '../lib/util.js';

export const APP_ID = 'kesela';
/** 以前のアプリ名（この名前のバックアップも読み込める） */
export const OLD_APP_IDS = ['yuteli'];
export const CURRENT_SCHEMA_VERSION = 4;

/**
 * 読み込み失敗の結果。error は日本語の文（テスト・ログ用）、
 * key と params は画面で今の言語にする用（t(key, params)）
 */
function fail(key, params) {
  const error = params ? key.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : key;
  return { ok: false, error, key, params };
}

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isStrOrNull = (v) => v === null || v === undefined || typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isAmount = (v) => isNum(v) && v >= 0;

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
          : !isAmount(r.currentStock)
            ? 'currentStock'
            : !isCount(r.targetStock)
              ? 'targetStock'
              : null,
  stores: (r) => (!isStr(r.name) ? 'name' : null),
  storeShelfOrders: (r) =>
    !isStr(r.storeId) ? 'storeId' : !isStr(r.categoryId) ? 'categoryId' : !isNum(r.sortOrder) ? 'sortOrder' : null,
  shoppingListItems: (r) =>
    !isStr(r.name) ? 'name' : !isNum(r.quantity) ? 'quantity' : !isStrOrNull(r.productId) ? 'productId' : null,
  foodGroups: (r) =>
    !isStr(r.name)
      ? 'name'
      : !Array.isArray(r.members) || r.members.some((m) => !m || !isStr(m.productId))
        ? 'members'
        : !r.consumption || typeof r.consumption !== 'object'
          ? 'consumption'
          : null,
  plans: (r) =>
    !isStr(r.title)
      ? 'title'
      : r.kind !== 'buy' && r.kind !== 'do'
        ? 'kind'
        : !isAmount(r.price)
          ? 'price'
          : !(r.month === null || r.month === undefined || /^\d{4}-\d{2}$/.test(r.month))
            ? 'month'
            : null,
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
const MIGRATIONS = {
  // 版1 → 版2：商品に毎日の量・栄養データなどを追加。設定（プロフィール）欄を追加
  2: (b) => {
    for (const p of b.data.products ?? []) {
      p.consumption ??= { breakfast: 0, lunch: 0, dinner: 0 };
      p.gramsPerUnit ??= null;
      p.nutrition ??= null;
      p.stockUpdatedOn ??= (b.exportedAt ?? '').slice(0, 10) || null;
    }
    b.settings ??= {};
    return b;
  },
  // 版2 → 版3：食事グループを追加。「・」区切りの初期カテゴリを分け、缶詰を追加
  3: (b) => {
    b.data.foodGroups ??= [];
    if (Array.isArray(b.data.categories) && Array.isArray(b.data.storeShelfOrders ?? [])) {
      const r = splitCategories({ categories: b.data.categories, storeShelfOrders: b.data.storeShelfOrders ?? [] }, newId);
      b.data.categories = r.categories;
      b.data.storeShelfOrders = r.storeShelfOrders;
    }
    return b;
  },
  // 版3 → 版4：家計を追加。分けたカテゴリをまとめ直す。商品に並び順を付ける
  4: (b) => {
    b.data.plans ??= [];
    const r = mergeCategories({
      categories: b.data.categories ?? [],
      storeShelfOrders: b.data.storeShelfOrders ?? [],
      products: b.data.products ?? [],
      shoppingListItems: b.data.shoppingListItems ?? [],
    });
    Object.assign(b.data, {
      categories: r.categories,
      storeShelfOrders: r.storeShelfOrders,
      shoppingListItems: r.shoppingListItems,
    });
    const sorted = [...r.products].sort((x, y) => String(x.name).localeCompare(String(y.name), 'ja'));
    b.data.products = sorted.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i + 1 }));
    return b;
  },
};

/** バックアップ用のオブジェクトを作る（settings：プロフィールなどの設定） */
export function buildBackup(data, exportedAt, settings = {}) {
  const out = { app: APP_ID, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt, settings, data: {} };
  for (const t of BACKUP_TABLES) out.data[t] = data[t] ?? [];
  return out;
}

/**
 * 読み込んだ文字列を検証し、今の版に変換する。
 * @param {string} text
 * @returns {{ ok: true, backup: object, counts: Record<string, number> } | { ok: false, error: string, key: string, params?: object }}
 */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return fail('JSON として読み込めませんでした。ファイルが壊れているか、別のファイルです。');
  }
  if (!obj || typeof obj !== 'object' || (obj.app !== APP_ID && !OLD_APP_IDS.includes(obj.app))) {
    return fail('KESELA のバックアップファイルではありません。');
  }
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) {
    return fail('バックアップの版が読み取れません。');
  }
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return fail('このバックアップは新しい版のアプリで作られています。アプリを最新にしてから読み込んでください。');
  }
  if (!obj.data || typeof obj.data !== 'object') {
    return fail('データ部分がありません。');
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
    if (!Array.isArray(rows)) return fail('「{table}」の形式が正しくありません。', { table: t });
    const ids = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || typeof r !== 'object' || !isStr(r.id)) return fail('「{table}」の{n}件目に ID がありません。', { table: t, n: i + 1 });
      if (ids.has(r.id)) return fail('「{table}」に同じ ID が重複しています。', { table: t });
      ids.add(r.id);
      const bad = RULES[t](r);
      if (bad) return fail('「{table}」の{n}件目の「{field}」が正しくありません。', { table: t, n: i + 1, field: bad });
    }
    backup.data[t] = rows;
    counts[t] = rows.length;
  }
  if (counts.categories === 0) return fail('カテゴリが1件もありません。');
  if (backup.settings !== undefined && (typeof backup.settings !== 'object' || backup.settings === null)) {
    return fail('設定の形式が正しくありません。');
  }
  backup.settings ??= {};

  return { ok: true, backup, counts };
}

/** バックアップのファイル名（kesela-backup-20261030-1953.json） */
export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `kesela-backup-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}
