// ③ 店舗・価格
// 上部の切り替えで「価格比較」と「店舗」を行き来する。
// 価格比較：商品ごとの最安店舗 → タップで店舗別の比較と履歴
// 店舗：店舗の登録・名前変更・売り場順の設定・削除
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listProducts, getProduct, ValidationError } from '../data/productRepo.js';
import {
  listStores,
  getStore,
  createStore,
  renameStore,
  deleteStore,
  countPriceRecordsOfStore,
  getOrderedCategories,
  saveShelfOrder,
} from '../data/storeRepo.js';
import { listAllRecords, listByProduct, deletePriceRecord } from '../data/priceRepo.js';
import { compareStores, daysSince, STALE_DAYS, yen } from '../domain/pricing.js';
import { move } from '../domain/shelf.js';
import { openPriceSheet } from './priceSheet.js';
import { esc, todayLocal } from '../lib/util.js';

export const title = '店舗・価格';

/** 表示中のタブ（画面を離れても覚えておく） */
let tab = 'compare';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-tab="compare">価格比較</button>
        <button type="button" role="tab" data-tab="stores">店舗</button>
      </div>
      <div id="tab-body" class="stack"></div>
    </div>
    <button type="button" class="fab" data-action="fab"></button>
  `;
  const body = el.querySelector('#tab-body');
  const fab = el.querySelector('.fab');
  let stop = null;

  function showTab() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    fab.textContent = tab === 'compare' ? '＋ 価格を記録' : '＋ 店舗';
    stop?.();
    stop = tab === 'compare' ? renderCompare(body) : renderStores(body);
  }

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab], [data-action]');
    if (!t) return;
    if (t.dataset.tab) {
      tab = t.dataset.tab;
      showTab();
      return;
    }
    const id = t.dataset.id;
    switch (t.dataset.action) {
      case 'fab':
        if (tab === 'compare') openPriceSheet();
        else openAddStoreSheet();
        break;
      case 'go-stores':
        tab = 'stores';
        showTab();
        break;
      case 'detail':
        openProductPriceSheet(id);
        break;
      case 'store':
        openStoreSheet(id);
        break;
    }
  });

  showTab();
  return () => stop?.();
}

// ===================== 価格比較 =====================

function renderCompare(body) {
  return watch(
    () => Promise.all([listProducts(), listStores(), listAllRecords()]),
    ([products, stores, records]) => {
      if (stores.length === 0) {
        body.innerHTML = `
          <div class="placeholder">
            <p>まず、よく行くお店を登録してください。</p>
            <p style="margin-top:12px"><button type="button" class="btn" data-action="go-stores">店舗を登録する</button></p>
          </div>`;
        return;
      }
      if (products.length === 0) {
        body.innerHTML = '<div class="placeholder">「在庫」タブで商品を登録すると、ここで価格を比べられます。</div>';
        return;
      }

      const storeName = new Map(stores.map((s) => [s.id, s.name]));
      const byProduct = new Map();
      for (const r of records) {
        if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
        byProduct.get(r.productId).push(r);
      }
      const today = todayLocal();
      const rows = products.map((p) => ({ p, cmp: compareStores(byProduct.get(p.id) ?? []) }));
      const withData = rows.filter((r) => r.cmp.mode !== 'none');
      const without = rows.filter((r) => r.cmp.mode === 'none');

      const rowHtml = ({ p, cmp }) => {
        if (cmp.mode === 'none') {
          return `<li><button type="button" class="row-button" data-action="detail" data-id="${p.id}">
            <span class="grow">${esc(p.name)}</span><span class="note">記録なし ›</span></button></li>`;
        }
        const best = cmp.rows.filter((r) => r.cheapest);
        const top = best[0];
        const days = daysSince(top.record.purchasedAt, today);
        const value =
          cmp.mode === 'unit' ? `${top.unit.label} ${yen(top.unit.value)}` : `1${esc(p.inventoryUnit)} ${yen(top.perItem)}`;
        return `<li><button type="button" class="row-button" data-action="detail" data-id="${p.id}">
          <span class="grow">
            <span class="item-name" style="font-size:17px">${esc(p.name)}</span>
            <span class="price-line">最安 <strong>${best.map((b) => esc(storeName.get(b.storeId) ?? '削除された店舗')).join('・')}</strong> ${value}</span>
            <span class="note ${days > STALE_DAYS ? 'stale' : ''}">${dateLabel(top.record.purchasedAt, today)}・${cmp.rows.length}店舗の比較</span>
          </span>
          <span class="note">›</span></button></li>`;
      };

      body.innerHTML = `
        ${withData.length ? `<section><h2 class="section-title">記録あり</h2><ul class="list">${withData.map(rowHtml).join('')}</ul></section>` : ''}
        ${without.length ? `<section><h2 class="section-title">まだ記録がない商品</h2><ul class="list">${without.map(rowHtml).join('')}</ul></section>` : ''}
        <p class="note">価格は実際に買った時の記録です。今の店頭価格とは違うことがあります。</p>`;
    }
  );
}

/** 商品の価格詳細（店舗別比較＋履歴） */
async function openProductPriceSheet(productId) {
  const product = await getProduct(productId);
  if (!product) return;
  let stop = null;
  const sheet = openSheet({
    title: `${product.name}の価格`,
    body: '<div class="stack" id="price-detail"></div>',
    onClose: () => stop?.(),
  });
  const box = sheet.el.querySelector('#price-detail');

  box.addEventListener('click', async (e) => {
    if (e.target.closest('[data-record-add]')) {
      openPriceSheet({ productId });
      return;
    }
    const del = e.target.closest('[data-record-del]');
    if (del && window.confirm('この価格記録を削除しますか？\n（入力ミスの修正用です。履歴として残す場合は削除しないでください）')) {
      await deletePriceRecord(del.dataset.recordDel);
      toast('削除しました');
    }
  });

  stop = watch(
    () => Promise.all([listByProduct(productId), listStores(), getProduct(productId)]),
    ([records, stores, p]) => {
      if (!p) return sheet.close();
      const unit = esc(p.inventoryUnit);
      const storeName = new Map(stores.map((s) => [s.id, s.name]));
      const cmp = compareStores(records);
      const today = todayLocal();

      const modeNote =
        cmp.mode === 'unit'
          ? `内容量をもとに<strong>${esc(cmp.rows[0].unit.label)}</strong>の価格で比べています。`
          : cmp.mode === 'item'
            ? `<strong>1${unit}あたり</strong>の価格で比べています。${
                cmp.rows.length > 1 ? '店舗で容量が違う場合は、内容量も記録すると実質の安さで比べられます。' : ''
              }`
            : '';

      box.innerHTML = `
        <button type="button" class="btn btn-primary btn-block" data-record-add>＋ 価格を記録</button>
        ${
          cmp.mode === 'none'
            ? '<p class="placeholder">まだ記録がありません。</p>'
            : `
          <section>
            <h3 class="section-title">店舗ごとの最新価格</h3>
            <ul class="list">
              ${cmp.rows
                .map((r) => {
                  const days = daysSince(r.record.purchasedAt, today);
                  const main = cmp.mode === 'unit' ? yen(r.unit.value) : yen(r.perItem);
                  const mainLabel = cmp.mode === 'unit' ? r.unit.label : `1${unit}あたり`;
                  return `<li class="compare-row ${r.cheapest ? 'is-cheapest' : ''}">
                    <span class="grow">
                      <span class="item-name" style="font-size:17px">${esc(storeName.get(r.storeId) ?? '削除された店舗')}
                        ${r.cheapest ? '<span class="badge">最安</span>' : ''}</span>
                      <span class="note">${yen(r.record.price)}（${r.record.quantity}${unit}${contentLabel(r.record)}）</span>
                      <span class="note ${days > STALE_DAYS ? 'stale' : ''}">${dateLabel(r.record.purchasedAt, today)}${
                        days > STALE_DAYS ? '・古い価格です' : ''
                      }</span>
                    </span>
                    <span class="compare-price"><small>${esc(mainLabel)}</small>${main}</span>
                  </li>`;
                })
                .join('')}
            </ul>
            <p class="note" style="margin-top:6px">${modeNote}</p>
          </section>
          <section>
            <h3 class="section-title">履歴（${records.length}件）</h3>
            <ul class="list">
              ${records
                .map(
                  (r) => `<li>
                    <span class="grow">
                      <span>${esc(r.purchasedAt.replaceAll('-', '/'))}　${esc(storeName.get(r.storeId) ?? '削除された店舗')}</span>
                      <span class="note" style="display:block">${yen(r.price)}（${r.quantity}${unit}${contentLabel(r)}）</span>
                    </span>
                    <button type="button" class="icon-btn" data-record-del="${r.id}" aria-label="この記録を削除">削除</button>
                  </li>`
                )
                .join('')}
            </ul>
          </section>`
        }`;
    }
  );
}

function contentLabel(r) {
  return r.packageContent ? `・${r.packageContent.toLocaleString('ja-JP')}${r.packageContentUnit}` : '';
}

function dateLabel(date, today) {
  const d = daysSince(date, today);
  const md = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return `${md}（${d === 0 ? '今日' : d === 1 ? '昨日' : `${d}日前`}）`;
}

// ===================== 店舗 =====================

function renderStores(body) {
  return watch(
    async () => {
      const stores = await listStores();
      const counts = await Promise.all(stores.map((s) => countPriceRecordsOfStore(s.id)));
      return stores.map((s, i) => ({ ...s, records: counts[i] }));
    },
    (stores) => {
      body.innerHTML = stores.length
        ? `<ul class="list">${stores
            .map(
              (s) => `<li><button type="button" class="row-button" data-action="store" data-id="${s.id}">
                <span class="grow">${esc(s.name)}<span class="note" style="display:block">価格記録 ${s.records}件</span></span>
                <span class="note">売り場順・編集 ›</span></button></li>`
            )
            .join('')}</ul>
           <p class="note">お店をタップすると、売り場の順番を設定できます。買い物リストでお店を選ぶと、その順に並びます。</p>`
        : '<div class="placeholder">右下の「＋ 店舗」から、よく行くお店を登録してください。</div>';
    }
  );
}

function openAddStoreSheet() {
  const sheet = openSheet({
    title: '店舗を登録',
    body: `
      <form novalidate>
        <div class="field">
          <label for="f-name">店舗名</label>
          <input id="f-name" name="name" class="input" placeholder="例：〇〇スーパー 駅前店" autocomplete="off" enterkeyhint="done">
          <p class="field-error" data-error-for="name"></p>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-block">登録</button></div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);
  form.elements.namedItem('name').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const store = await createStore(formValues(form).name);
      sheet.close();
      toast(`「${store.name}」を登録しました`);
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
}

/** 店舗の編集：名前・売り場順・削除 */
async function openStoreSheet(storeId) {
  const store = await getStore(storeId);
  if (!store) return;
  let stop = null;
  const sheet = openSheet({
    title: store.name,
    body: `
      <form novalidate id="rename-form">
        <div class="field">
          <label for="f-name">店舗名</label>
          <div class="row">
            <input id="f-name" name="name" class="input grow" value="${esc(store.name)}" autocomplete="off">
            <button type="submit" class="btn">変更</button>
          </div>
          <p class="field-error" data-error-for="name"></p>
        </div>
      </form>
      <section style="margin-top:24px">
        <h3 class="section-title">売り場の順番（入口から回る順）</h3>
        <ol class="list shelf-list" id="shelf"></ol>
        <p class="note" style="margin-top:6px">↑↓で並べ替えると、すぐに保存されます。</p>
      </section>
      <div class="form-actions"><button type="button" class="btn-danger-text" data-delete-store>この店舗を削除</button></div>`,
    onClose: () => stop?.(),
  });

  const form = sheet.el.querySelector('#rename-form');
  bindErrorClear(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await renameStore(storeId, formValues(form).name);
      sheet.el.querySelector('.sheet-header h2').textContent = formValues(form).name.trim();
      toast('店舗名を変更しました');
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });

  const shelfEl = sheet.el.querySelector('#shelf');
  let ids = [];
  shelfEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-move]');
    if (!b) return;
    const next = move(ids, Number(b.dataset.index), Number(b.dataset.move));
    await saveShelfOrder(storeId, next);
  });
  stop = watch(
    () => getOrderedCategories(storeId),
    (cats) => {
      ids = cats.map((c) => c.id);
      shelfEl.innerHTML = cats
        .map(
          (c, i) => `<li>
            <span class="shelf-no">${i + 1}</span>
            <span class="grow">${esc(c.name)}</span>
            <button type="button" class="icon-btn" data-move="-1" data-index="${i}" aria-label="${esc(c.name)}を上へ" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon-btn" data-move="1" data-index="${i}" aria-label="${esc(c.name)}を下へ" ${i === cats.length - 1 ? 'disabled' : ''}>↓</button>
          </li>`
        )
        .join('');
    }
  );

  sheet.el.querySelector('[data-delete-store]').addEventListener('click', async () => {
    const n = await countPriceRecordsOfStore(storeId);
    const msg = `「${store.name}」を削除しますか？` + (n ? `\nこの店舗の価格記録 ${n}件も削除されます。` : '') + '\nこの操作は取り消せません。';
    if (!window.confirm(msg)) return;
    await deleteStore(storeId);
    sheet.close();
    toast('店舗を削除しました');
  });
}
