// ⑤ 設定・バックアップ
// ・文字の大きさ、からだの情報
// ・バックアップの保存／復元（復元前に確認画面）
// ・カテゴリの管理
// ・すべてのデータの初期化
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { FONT_LEVELS, getFontScale, setFontScale, getTheme, setTheme } from '../ui/fontSize.js';
import { THEMES } from '../ui/themeList.js';
import { getMeta, META } from '../data/metaRepo.js';
import { saveBackup, currentCounts, restoreBackup, resetAll } from '../data/backup.js';
import {
  listCategories,
  addCategory,
  renameCategory,
  deleteCategory,
  saveCategoryOrder,
  countProductsInCategory,
} from '../data/categoryRepo.js';
import { ValidationError } from '../data/productRepo.js';
import { parseBackup, BACKUP_TABLES } from '../domain/backupFormat.js';
import { makeSortable, dragHandle } from '../ui/sortable.js';
import { APP_VERSION } from '../lib/version.js';
import { openProfileSheet, profileSummary } from './profileSheet.js';
import { esc } from '../lib/util.js';

export const title = '設定';

const TABLE_LABELS = {
  categories: 'カテゴリ',
  products: '商品',
  stores: '店舗',
  storeShelfOrders: '売り場順',
  shoppingListItems: '買い物リスト',
  priceRecords: '価格記録',
  foodGroups: '食事グループ',
};

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section>
        <h2 class="section-title">バックアップ</h2>
        <ul class="list">
          <li><span class="grow">最終バックアップ</span><span id="last-backup" class="num"></span></li>
        </ul>
        <div class="form-actions" style="margin-top:12px">
          <button type="button" class="btn btn-primary btn-block" data-action="backup">バックアップを保存</button>
          <button type="button" class="btn btn-block" data-action="restore">バックアップから復元</button>
          <input type="file" id="restore-file" accept="application/json,.json" hidden>
        </div>
        <p class="note" style="margin-top:8px">「"ファイル"に保存」で iCloud Drive などへ</p>
      </section>

      <section>
        <h2 class="section-title">テーマ</h2>
        <div class="theme-grid" role="radiogroup">
          <button type="button" role="radio" data-theme-key="" class="theme-swatch theme-auto"><span class="sw"><i style="background:#f6f5f1"></i><i style="background:#1b1c1a"></i></span>自動</button>
          ${THEMES.map(
            (t) => `<button type="button" role="radio" data-theme-key="${t.key}" class="theme-swatch">
              <span class="sw" style="background:${t.bg}"><i style="background:${t.accent}"></i><i style="background:${t.surface}"></i></span>${t.label}</button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h2 class="section-title">文字の大きさ</h2>
        <div class="segmented font-levels" role="radiogroup">
          ${FONT_LEVELS.map(
            (f, i) => `<button type="button" role="radio" data-font="${f.scale}" aria-label="${f.label}" style="font-size:${13 + i * 2.5}px">あ</button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h2 class="section-title">からだの情報</h2>
        <ul class="list">
          <li><button type="button" class="row-button" data-action="profile">
            <span class="grow" id="profile-summary"></span><span class="note">›</span></button></li>
        </ul>
      </section>

      <section>
        <h2 class="section-title">カテゴリ</h2>
        <ul class="list">
          <li><button type="button" class="row-button" data-action="categories">
            <span class="grow">追加・名前変更・並び順</span><span class="note">›</span></button></li>
        </ul>
      </section>

      <section>
        <h2 class="section-title">初期化</h2>
        <button type="button" class="btn btn-block btn-danger" data-action="reset">すべてのデータを消去</button>
      </section>

      <p class="note" style="text-align:center">YUTELI ${esc(APP_VERSION)}<br>
        栄養データ：日本食品標準成分表（八訂）増補2023年（文部科学省）<br>
        栄養の目標：日本人の食事摂取基準（2025年版）（厚生労働省）</p>
    </div>
  `;

  // ---- 文字の大きさ ----
  const markFont = () =>
    el.querySelectorAll('[data-font]').forEach((b) =>
      b.setAttribute('aria-checked', String(Number(b.dataset.font) === getFontScale()))
    );
  el.querySelector('.font-levels').addEventListener('click', (e) => {
    const b = e.target.closest('[data-font]');
    if (!b) return;
    setFontScale(Number(b.dataset.font));
    markFont();

  // ---- テーマ ----
  const markTheme = () =>
    el.querySelectorAll('[data-theme-key]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeKey === getTheme())));
  el.querySelector('.theme-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-key]');
    if (!b) return;
    setTheme(b.dataset.themeKey);
    markTheme();
  });
  markTheme();
  });
  markFont();

  // ---- テーマ ----
  const markTheme = () =>
    el.querySelectorAll('[data-theme-key]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeKey === getTheme())));
  el.querySelector('.theme-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-key]');
    if (!b) return;
    setTheme(b.dataset.themeKey);
    markTheme();
  });
  markTheme();

  // ---- 操作 ----
  const fileInput = el.querySelector('#restore-file');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      openSheet({ title: '読み込めませんでした', body: `<p>${esc(result.error)}</p>` });
      return;
    }
    openRestoreConfirm(result, file.name);
  });

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.dataset.action) {
      case 'backup':
        await doBackup();
        break;
      case 'restore':
        fileInput.click();
        break;
      case 'categories':
        openCategorySheet();
        break;
      case 'profile':
        openProfileSheet();
        break;
      case 'reset':
        if (!window.confirm('すべてのデータ（商品・在庫・買い物リスト・店舗・価格記録）を消去します。よろしいですか？')) return;
        if (!window.confirm('本当に消去しますか？この操作は取り消せません。\n必要なら先にバックアップを保存してください。')) return;
        await resetAll();
        toast('すべてのデータを消去しました');
        break;
    }
  });

  const lastEl = el.querySelector('#last-backup');
  return watch(
    () => Promise.all([currentCounts(), getMeta(META.lastBackupAt), getMeta(META.profile)]),
    ([counts, last, profile]) => {
      el.querySelector('#profile-summary').textContent = profileSummary(profile);
      lastEl.innerHTML = last ? esc(formatDateTime(last)) : '<span class="stale">まだありません</span>';
    }
  );
}

async function doBackup() {
  try {
    const r = await saveBackup();
    if (r === 'shared') toast('バックアップを保存しました');
    else if (r === 'downloaded') toast('バックアップをダウンロードしました');
  } catch (err) {
    console.error(err);
    toast('バックアップを保存できませんでした');
  }
}

/** 復元前の確認画面 */
async function openRestoreConfirm(result, fileName) {
  const now = await currentCounts();
  const sheet = openSheet({
    title: 'バックアップから復元',
    body: `
      <p>ファイル：${esc(fileName)}</p>
      <p class="note">作成日時：${esc(formatDateTime(result.backup.exportedAt))}</p>
      <table class="compare-table">
        <thead><tr><th></th><th>今のデータ</th><th>バックアップ</th></tr></thead>
        <tbody>
          ${BACKUP_TABLES.map(
            (t) => `<tr><th>${TABLE_LABELS[t]}</th><td>${now[t]}</td><td>${result.counts[t]}</td></tr>`
          ).join('')}
        </tbody>
      </table>
      <p class="notice" style="margin-top:12px">復元すると、今のデータはすべて消えてバックアップの内容に置き換わります。この操作は取り消せません。</p>
      <div class="form-actions">
        <button type="button" class="btn btn-block" data-backup-first>先に今のデータをバックアップ</button>
        <button type="button" class="btn btn-block btn-danger" data-restore>上書きして復元する</button>
      </div>`,
  });
  sheet.el.querySelector('[data-backup-first]').addEventListener('click', doBackup);
  sheet.el.querySelector('[data-restore]').addEventListener('click', async () => {
    try {
      await restoreBackup(result.backup);
      sheet.close();
      toast('復元しました');
    } catch (err) {
      console.error(err);
      toast('復元できませんでした。データは変更されていません');
    }
  });
}

/** カテゴリの管理 */
function openCategorySheet() {
  let stop = null;
  const sheet = openSheet({
    title: 'カテゴリ',
    body: `
      <form novalidate id="cat-add">
        <div class="field">
          <label for="f-name">カテゴリを追加</label>
          <div class="row">
            <input id="f-name" name="name" class="input grow" placeholder="例：冷凍食品" autocomplete="off">
            <button type="submit" class="btn">追加</button>
          </div>
          <p class="field-error" data-error-for="name"></p>
        </div>
      </form>
      <section style="margin-top:20px">
        <h3 class="section-title">並び順（≡ を押さえて動かす）</h3>
        <ol class="list shelf-list" id="cat-list"></ol>
      </section>`,
    onClose: () => stop?.(),
  });

  const form = sheet.el.querySelector('#cat-add');
  bindErrorClear(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const c = await addCategory(formValues(form).name);
      form.reset();
      toast(`「${c.name}」を追加しました`);
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });

  const listEl = sheet.el.querySelector('#cat-list');
  let cats = [];
  makeSortable(listEl, { onSort: (ids) => saveCategoryOrder(ids) });
  listEl.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) openCategoryEdit(cats.find((c) => c.id === ed.dataset.edit));
  });
  stop = watch(listCategories, (list) => {
    cats = list;
    listEl.innerHTML = list
      .map(
        (c) => `<li data-id="${c.id}">
          ${dragHandle(esc(c.name))}
          <button type="button" class="row-button grow" data-edit="${c.id}" style="min-height:40px">${esc(c.name)}</button>
        </li>`
      )
      .join('');
  });
}

async function openCategoryEdit(cat) {
  if (!cat) return;
  const used = await countProductsInCategory(cat.id);
  const sheet = openSheet({
    title: 'カテゴリを編集',
    body: `
      <form novalidate>
        <div class="field">
          <label for="f-cname">カテゴリ名</label>
          <input id="f-cname" name="name" class="input" value="${esc(cat.name)}" autocomplete="off">
          <p class="field-error" data-error-for="name"></p>
        </div>
        <p class="note" style="margin-top:8px">このカテゴリの商品：${used}件</p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-block">保存</button>
          <button type="button" class="btn-danger-text" data-del>このカテゴリを削除</button>
        </div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await renameCategory(cat.id, formValues(form).name);
      sheet.close();
      toast('変更しました');
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
  form.querySelector('[data-del]').addEventListener('click', async () => {
    if (!window.confirm(`「${cat.name}」を削除しますか？`)) return;
    try {
      await deleteCategory(cat.id);
      sheet.close();
      toast('削除しました');
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '不明';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
