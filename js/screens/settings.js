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
import { noteOnLaunch, setNoteOnLaunch } from './goals.js';
import { esc } from '../lib/util.js';
import { t, dateLong, LANG_OPTIONS, getLangPref, setLangPref } from '../lib/i18n.js';

export const title = '設定';

const TABLE_LABELS = {
  categories: 'カテゴリ',
  products: '商品',
  stores: '店舗',
  storeShelfOrders: '売り場順',
  shoppingListItems: '買い物リスト',
  priceRecords: '価格記録',
  foodGroups: '食事グループ',
  plans: '家計',
};

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section>
        <h2 class="section-title">${t('バックアップ')}</h2>
        <ul class="list">
          <li><span class="grow">${t('最終バックアップ')}</span><span id="last-backup" class="num"></span></li>
        </ul>
        <div class="form-actions" style="margin-top:12px">
          <button type="button" class="btn btn-primary btn-block" data-action="backup">${t('バックアップを保存')}</button>
          <button type="button" class="btn btn-block" data-action="restore">${t('バックアップから復元')}</button>
          <input type="file" id="restore-file" accept="application/json,.json" hidden>
        </div>
        <p class="note" style="margin-top:8px">${t('「"ファイル"に保存」で iCloud Drive などへ')}</p>
      </section>

      <section>
        <h2 class="section-title">${t('目標')}</h2>
        <ul class="list">
          <li><label class="check-row grow"><input type="checkbox" id="note-launch">${t('起動時に表示する')}</label></li>
        </ul>
        <p class="note" style="margin-top:6px">${t('閉じずに30分以上ほかのアプリにいて戻った時も表示します')}</p>
      </section>

      <section>
        <h2 class="section-title">${t('言語')}</h2>
        <div class="segmented font-levels lang-options" role="radiogroup" aria-label="${t('言語')}">
          ${LANG_OPTIONS.map(
            (o) => `<button type="button" role="radio" data-lang="${o.key}"${
              o.title ? ` title="${esc(t(o.title))}" aria-label="${esc(t(o.title))}"` : ` lang="${o.key}"`
            }>${esc(o.key === 'auto' ? t(o.label) : o.label)}</button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h2 class="section-title">${t('テーマ')}</h2>
        <div class="theme-grid" role="radiogroup">
          <button type="button" role="radio" data-theme-key="" class="theme-swatch theme-auto"><span class="sw"><i style="background:#f6f5f1"></i><i style="background:#1b1c1a"></i></span><span class="th-name">${t('自動')}</span></button>
          ${THEMES.map(
            (th) => `<button type="button" role="radio" data-theme-key="${th.key}" class="theme-swatch">
              <span class="sw" style="background:${th.bg}"><i style="background:${th.accent}"></i><i style="background:${th.surface}"></i></span><span class="th-name">${esc(t(th.label))}</span></button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h2 class="section-title">${t('文字の大きさ')}</h2>
        <div class="segmented font-levels" role="radiogroup">
          ${FONT_LEVELS.map(
            (f, i) => `<button type="button" role="radio" data-font="${f.scale}" aria-label="${esc(t(f.label))}" style="font-size:${13 + i * 2.5}px">${t('あ')}</button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h2 class="section-title">${t('からだの情報')}</h2>
        <ul class="list">
          <li><button type="button" class="row-button" data-action="profile">
            <span class="grow" id="profile-summary"></span><span class="note">›</span></button></li>
        </ul>
      </section>

      <section>
        <h2 class="section-title">${t('カテゴリ')}</h2>
        <ul class="list">
          <li><button type="button" class="row-button" data-action="categories">
            <span class="grow">${t('追加・名前変更・並び順')}</span><span class="note">›</span></button></li>
        </ul>
      </section>

      <section>
        <h2 class="section-title">${t('初期化')}</h2>
        <button type="button" class="btn btn-block btn-danger" data-action="reset">${t('すべてのデータを消去')}</button>
      </section>

      <p class="note" style="text-align:center">KESELA ${esc(APP_VERSION)}<br>${t('健康 × 節約 × 楽')}<br>
        ${t('栄養データ：日本食品標準成分表（八訂）増補2023年（文部科学省）')}<br>
        ${t('栄養の目標：日本人の食事摂取基準（2025年版）（厚生労働省）')}</p>
    </div>
  `;

  // ---- 言語（選ぶと読み込み直して反映） ----
  const pref = getLangPref();
  el.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === pref)));
  el.querySelector('.lang-options').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b && b.dataset.lang !== pref) setLangPref(b.dataset.lang);
  });

  // ---- 文字の大きさ ----
  const markFont = () =>
    el.querySelectorAll('[data-font]').forEach((b) =>
      b.setAttribute('aria-checked', String(Number(b.dataset.font) === getFontScale()))
    );
  el.querySelector('.font-levels:not(.lang-options)').addEventListener('click', (e) => {
    const b = e.target.closest('[data-font]');
    if (!b) return;
    setFontScale(Number(b.dataset.font));
    markFont();
  });
  markFont();

  // ---- 目標メモ ----
  const launchTg = el.querySelector('#note-launch');
  launchTg.checked = noteOnLaunch();
  launchTg.addEventListener('change', () => setNoteOnLaunch(launchTg.checked));

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
  // 選んでいるテーマが見えるように、横スクロールの位置を合わせる
  requestAnimationFrame(() => {
    const grid = el.querySelector('.theme-grid');
    const cur = grid.querySelector('[aria-checked="true"]');
    if (cur && cur.offsetLeft + cur.offsetWidth > grid.clientWidth) grid.scrollLeft = cur.offsetLeft - grid.clientWidth / 2 + cur.offsetWidth / 2;
  });

  // ---- 操作 ----
  const fileInput = el.querySelector('#restore-file');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      openSheet({ title: t('読み込めませんでした'), body: `<p>${esc(t(result.key ?? result.error, result.params))}</p>` });
      return;
    }
    openRestoreConfirm(result, file.name);
  });

  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
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
        if (!window.confirm(t('すべてのデータ（商品・在庫・買い物リスト・店舗・価格記録）を消去します。よろしいですか？'))) return;
        if (!window.confirm(t('本当に消去しますか？この操作は取り消せません。') + '\n' + t('必要なら先にバックアップを保存してください。'))) return;
        await resetAll();
        toast(t('すべてのデータを消去しました'));
        break;
    }
  });

  const lastEl = el.querySelector('#last-backup');
  return watch(
    () => Promise.all([currentCounts(), getMeta(META.lastBackupAt), getMeta(META.profile)]),
    ([counts, last, profile]) => {
      el.querySelector('#profile-summary').textContent = profileSummary(profile);
      lastEl.innerHTML = last ? esc(formatDateTime(last)) : `<span class="stale">${t('まだありません')}</span>`;
    }
  );
}

async function doBackup() {
  try {
    const r = await saveBackup();
    if (r === 'shared') toast(t('バックアップを保存しました'));
    else if (r === 'downloaded') toast(t('バックアップをダウンロードしました'));
  } catch (err) {
    console.error(err);
    toast(t('バックアップを保存できませんでした'));
  }
}

/** 復元前の確認画面 */
async function openRestoreConfirm(result, fileName) {
  const now = await currentCounts();
  const sheet = openSheet({
    title: t('バックアップから復元'),
    body: `
      <p>${esc(t('ファイル：{name}', { name: fileName }))}</p>
      <p class="note">${esc(t('作成日時：{date}', { date: formatDateTime(result.backup.exportedAt) }))}</p>
      <table class="compare-table">
        <thead><tr><th></th><th>${t('今のデータ')}</th><th>${t('バックアップ')}</th></tr></thead>
        <tbody>
          ${BACKUP_TABLES.map(
            (name) => `<tr><th>${t(TABLE_LABELS[name] ?? name)}</th><td>${now[name] ?? 0}</td><td>${result.counts[name]}</td></tr>`
          ).join('')}
        </tbody>
      </table>
      <p class="notice" style="margin-top:12px">${t('復元すると、今のデータはすべて消えてバックアップの内容に置き換わります。この操作は取り消せません。')}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-block" data-backup-first>${t('先に今のデータをバックアップ')}</button>
        <button type="button" class="btn btn-block btn-danger" data-restore>${t('上書きして復元する')}</button>
      </div>`,
  });
  sheet.el.querySelector('[data-backup-first]').addEventListener('click', doBackup);
  sheet.el.querySelector('[data-restore]').addEventListener('click', async () => {
    try {
      await restoreBackup(result.backup);
      sheet.close();
      toast(t('復元しました'));
    } catch (err) {
      console.error(err);
      toast(t('復元できませんでした。データは変更されていません'));
    }
  });
}

/** カテゴリの管理 */
function openCategorySheet() {
  let stop = null;
  const sheet = openSheet({
    title: t('カテゴリ'),
    body: `
      <form novalidate id="cat-add">
        <div class="field">
          <label for="f-name">${t('カテゴリを追加')}</label>
          <div class="row">
            <input id="f-name" name="name" class="input grow" placeholder="${t('例：冷凍食品')}" autocomplete="off">
            <button type="submit" class="btn">${t('追加')}</button>
          </div>
          <p class="field-error" data-error-for="name"></p>
        </div>
      </form>
      <section style="margin-top:20px">
        <h3 class="section-title">${t('並び順（≡ を押さえて動かす）')}</h3>
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
      toast(t('「{name}」を追加しました', { name: c.name }));
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
          ${dragHandle(esc(t(c.name)))}
          <button type="button" class="row-button grow" data-edit="${c.id}" style="min-height:40px">${esc(t(c.name))}</button>
        </li>`
      )
      .join('');
  });
}

async function openCategoryEdit(cat) {
  if (!cat) return;
  const used = await countProductsInCategory(cat.id);
  const sheet = openSheet({
    title: t('カテゴリを編集'),
    body: `
      <form novalidate>
        <div class="field">
          <label for="f-cname">${t('カテゴリ名')}</label>
          <input id="f-cname" name="name" class="input" value="${esc(cat.name)}" autocomplete="off">
          <p class="field-error" data-error-for="name"></p>
        </div>
        <p class="note" style="margin-top:8px">${t('このカテゴリの商品：{n}件', { n: used })}</p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-block">${t('保存')}</button>
          <button type="button" class="btn-danger-text" data-del>${t('このカテゴリを削除')}</button>
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
      toast(t('変更しました'));
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
  form.querySelector('[data-del]').addEventListener('click', async () => {
    if (!window.confirm(t('「{name}」を削除しますか？', { name: t(cat.name) }))) return;
    try {
      await deleteCategory(cat.id);
      sheet.close();
      toast(t('削除しました'));
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t('不明');
  const p = (n) => String(n).padStart(2, '0');
  return `${dateLong(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
