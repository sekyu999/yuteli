// ⑤ 設定・バックアップ
// ・データ保護の状態と最終バックアップ日
// ・バックアップの保存／復元（復元前に確認画面）
// ・カテゴリの管理
// ・すべてのデータの初期化
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { isPersisted, isStandalone, requestPersistence } from '../data/storage.js';
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
import { move } from '../domain/shelf.js';
import { APP_VERSION } from '../lib/version.js';
import { esc } from '../lib/util.js';

export const title = '設定';

const TABLE_LABELS = {
  categories: 'カテゴリ',
  products: '商品',
  stores: '店舗',
  storeShelfOrders: '売り場順',
  shoppingListItems: '買い物リスト',
  priceRecords: '価格記録',
};

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section>
        <h2 class="section-title">バックアップ</h2>
        <ul class="list">
          <li><span class="grow">最後のバックアップ</span><span id="last-backup" class="num"></span></li>
        </ul>
        <div class="form-actions" style="margin-top:12px">
          <button type="button" class="btn btn-primary btn-block" data-action="backup">バックアップを保存</button>
          <button type="button" class="btn btn-block" data-action="restore">バックアップから復元</button>
          <input type="file" id="restore-file" accept="application/json,.json" hidden>
        </div>
        <p class="note" style="margin-top:8px">iPhone では「"ファイル"に保存」を選び、iCloud Drive などに保存してください。</p>
      </section>

      <section>
        <h2 class="section-title">データの保護</h2>
        <ul class="list">
          <li><span class="grow">ホーム画面から起動</span><span id="st-standalone"></span></li>
          <li><span class="grow">データ保護</span><span id="st-persist"></span></li>
        </ul>
        <p class="notice" style="margin-top:12px">
          データはこの端末の中だけに保存されます。Safari の履歴・Webサイトデータの削除、機種変更、端末の故障で消えてしまうため、定期的にバックアップを保存してください。
          ホーム画面に追加して使うと、しばらく開かなくても消えにくくなります。
        </p>
      </section>

      <section>
        <h2 class="section-title">カテゴリ</h2>
        <ul class="list">
          <li><button type="button" class="row-button" data-action="categories">
            <span class="grow">カテゴリの追加・名前変更・並び順</span><span class="note">›</span></button></li>
        </ul>
      </section>

      <section>
        <h2 class="section-title">保存されているデータ</h2>
        <ul class="list" id="counts"></ul>
      </section>

      <section>
        <h2 class="section-title">初期化</h2>
        <button type="button" class="btn btn-block btn-danger" data-action="reset">すべてのデータを消去</button>
      </section>

      <p class="note" style="text-align:center">YUTELI ${esc(APP_VERSION)}</p>
    </div>
  `;

  // ---- 状態表示 ----
  el.querySelector('#st-standalone').innerHTML = isStandalone()
    ? '<span class="badge">はい</span>'
    : '<span class="note">いいえ</span>';
  const persistEl = el.querySelector('#st-persist');
  (async () => {
    const ok = (await isPersisted()) || (await requestPersistence());
    persistEl.innerHTML = ok ? '<span class="badge">有効</span>' : '<span class="note">未許可</span>';
  })();

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
      case 'reset':
        if (!window.confirm('すべてのデータ（商品・在庫・買い物リスト・店舗・価格記録）を消去します。よろしいですか？')) return;
        if (!window.confirm('本当に消去しますか？この操作は取り消せません。\n必要なら先にバックアップを保存してください。')) return;
        await resetAll();
        toast('すべてのデータを消去しました');
        break;
    }
  });

  const lastEl = el.querySelector('#last-backup');
  const countsEl = el.querySelector('#counts');
  return watch(
    () => Promise.all([currentCounts(), getMeta(META.lastBackupAt)]),
    ([counts, last]) => {
      lastEl.innerHTML = last ? esc(formatDateTime(last)) : '<span class="stale">まだありません</span>';
      countsEl.innerHTML = Object.entries(TABLE_LABELS)
        .map(([k, label]) => `<li><span class="grow">${label}</span><span class="num">${counts[k]} 件</span></li>`)
        .join('');
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
        <h3 class="section-title">標準の並び順（お店を選ばない時の順番）</h3>
        <ol class="list shelf-list" id="cat-list"></ol>
        <p class="note" style="margin-top:6px">名前をタップすると変更・削除できます。お店ごとの順番は「価格」タブの「店舗」で設定します。</p>
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
  listEl.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const ids = move(cats.map((c) => c.id), Number(mv.dataset.index), Number(mv.dataset.move));
      await saveCategoryOrder(ids);
      return;
    }
    const ed = e.target.closest('[data-edit]');
    if (ed) openCategoryEdit(cats.find((c) => c.id === ed.dataset.edit));
  });
  stop = watch(listCategories, (list) => {
    cats = list;
    listEl.innerHTML = list
      .map(
        (c, i) => `<li>
          <span class="shelf-no">${i + 1}</span>
          <button type="button" class="row-button grow" data-edit="${c.id}" style="min-height:40px">${esc(c.name)}</button>
          <button type="button" class="icon-btn" data-move="-1" data-index="${i}" aria-label="${esc(c.name)}を上へ" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon-btn" data-move="1" data-index="${i}" aria-label="${esc(c.name)}を下へ" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
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
