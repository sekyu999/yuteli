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
import { compareStores, daysSince, STALE_DAYS, UNIT_BASE } from '../domain/pricing.js';
import { makeSortable, dragHandle } from '../ui/sortable.js';
import { openPriceSheet } from './priceSheet.js';
import { esc, todayLocal } from '../lib/util.js';
import { t, money, dateShort, dateLong } from '../lib/i18n.js';

export const title = '店舗・価格';

/** 表示中のタブ（画面を離れても覚えておく） */
let tab = 'compare';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-tab="compare">${t('価格比較')}</button>
        <button type="button" role="tab" data-tab="stores">${t('店舗')}</button>
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
    fab.textContent = tab === 'compare' ? t('＋ 価格を記録') : t('＋ 店舗');
    stop?.();
    stop = tab === 'compare' ? renderCompare(body) : renderStores(body);
  }

  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-tab], [data-action]');
    if (!target) return;
    if (target.dataset.tab) {
      tab = target.dataset.tab;
      showTab();
      return;
    }
    const id = target.dataset.id;
    switch (target.dataset.action) {
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
            <p>${t('まず、よく行くお店を登録してください。')}</p>
            <p style="margin-top:12px"><button type="button" class="btn" data-action="go-stores">${t('店舗を登録する')}</button></p>
          </div>`;
        return;
      }
      if (products.length === 0) {
        body.innerHTML = `<div class="placeholder">${t('「在庫」タブで商品を登録すると、ここで価格を比べられます。')}</div>`;
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
            <span class="grow">${esc(p.name)}</span><span class="note">${t('記録なし')} ›</span></button></li>`;
        }
        const best = cmp.rows.filter((r) => r.cheapest);
        const top = best[0];
        const days = daysSince(top.record.purchasedAt, today);
        const value =
          cmp.mode === 'unit'
            ? `${esc(unitLabel(top.unit))} ${money(top.unit.value)}`
            : `${esc(t('1{unit}', { unit: t(p.inventoryUnit) }))} ${money(top.perItem)}`;
        return `<li><button type="button" class="row-button" data-action="detail" data-id="${p.id}">
          <span class="grow">
            <span class="item-name item-name-sm">${esc(p.name)}</span>
            <span class="price-line">${t('最安')} <strong>${best.map((b) => esc(storeName.get(b.storeId) ?? t('削除された店舗'))).join(t('・'))}</strong> ${value}</span>
            <span class="note ${days > STALE_DAYS ? 'stale' : ''}">${esc(t('{date}・{n}店舗の比較', { date: dateLabel(top.record.purchasedAt, today), n: cmp.rows.length }))}</span>
          </span>
          <span class="note">›</span></button></li>`;
      };

      body.innerHTML = `
        ${withData.length ? `<section><h2 class="section-title">${t('記録あり')}</h2><ul class="list">${withData.map(rowHtml).join('')}</ul></section>` : ''}
        ${without.length ? `<section><h2 class="section-title">${t('まだ記録がない商品')}</h2><ul class="list">${without.map(rowHtml).join('')}</ul></section>` : ''}`;
    }
  );
}

/** 商品の価格詳細（店舗別比較＋履歴） */
async function openProductPriceSheet(productId) {
  const product = await getProduct(productId);
  if (!product) return;
  let stop = null;
  const sheet = openSheet({
    title: t('{name}の価格', { name: product.name }),
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
    if (del && window.confirm(t('この価格記録を削除しますか？') + '\n' + t('（入力ミスの修正用です。履歴として残す場合は削除しないでください）'))) {
      await deletePriceRecord(del.dataset.recordDel);
      toast(t('削除しました'));
    }
  });

  stop = watch(
    () => Promise.all([listByProduct(productId), listStores(), getProduct(productId)]),
    ([records, stores, p]) => {
      if (!p) return sheet.close();
      const unit = esc(t(p.inventoryUnit));
      const storeName = new Map(stores.map((s) => [s.id, s.name]));
      const cmp = compareStores(records);
      const today = todayLocal();

      const modeNote =
        cmp.mode === 'unit'
          ? t('内容量をもとに<strong>{unit}</strong>の価格で比べています。', { unit: esc(unitLabel(cmp.rows[0].unit)) })
          : cmp.mode === 'item'
            ? t('<strong>1{unit}あたり</strong>の価格で比べています。', { unit }) +
              (cmp.rows.length > 1 ? t('店舗で容量が違う場合は、内容量も記録すると実質の安さで比べられます。') : '')
            : '';

      box.innerHTML = `
        <button type="button" class="btn btn-primary btn-block" data-record-add>${t('＋ 価格を記録')}</button>
        ${
          cmp.mode === 'none'
            ? `<p class="placeholder">${t('まだ記録がありません。')}</p>`
            : `
          <section>
            <h3 class="section-title">${t('店舗ごとの最新価格')}</h3>
            <ul class="list">
              ${cmp.rows
                .map((r) => {
                  const days = daysSince(r.record.purchasedAt, today);
                  const main = cmp.mode === 'unit' ? money(r.unit.value) : money(r.perItem);
                  const mainLabel = cmp.mode === 'unit' ? esc(unitLabel(r.unit)) : t('1{unit}あたり', { unit });
                  return `<li class="compare-row ${r.cheapest ? 'is-cheapest' : ''}">
                    <span class="grow">
                      <span class="item-name item-name-sm">${esc(storeName.get(r.storeId) ?? t('削除された店舗'))}
                        ${r.cheapest ? `<span class="badge">${t('最安')}</span>` : ''}</span>
                      <span class="note">${recordLabel(r.record, unit)}</span>
                      <span class="note ${days > STALE_DAYS ? 'stale' : ''}">${esc(dateLabel(r.record.purchasedAt, today))}${
                        days > STALE_DAYS ? t('・古い価格です') : ''
                      }</span>
                    </span>
                    <span class="compare-price"><small>${mainLabel}</small>${main}</span>
                  </li>`;
                })
                .join('')}
            </ul>
            <p class="note" style="margin-top:6px">${modeNote}</p>
          </section>
          <section>
            <h3 class="section-title">${t('履歴（{n}件）', { n: records.length })}</h3>
            <ul class="list">
              ${records
                .map(
                  (r) => `<li>
                    <span class="grow">
                      <span>${esc(t('{date}　{store}', { date: dateLong(r.purchasedAt), store: storeName.get(r.storeId) ?? t('削除された店舗') }))}</span>
                      <span class="note" style="display:block">${recordLabel(r, unit)}</span>
                    </span>
                    <button type="button" class="icon-btn" data-record-del="${r.id}" aria-label="${t('この記録を削除')}">${t('削除')}</button>
                  </li>`
                )
                .join('')}
            </ul>
          </section>`
        }`;
    }
  );
}

/** 単位価格の見出し（100gあたり・1個あたり）。英語では per 100g・per pc */
function unitLabel(u) {
  const base = UNIT_BASE[u.unit];
  return base === 1 ? t('1{unit}あたり', { unit: t(u.unit) }) : t('{amount}{unit}あたり', { amount: base, unit: t(u.unit) });
}

/** 「228円（2パック・500g）」。unit はエスケープ済みの管理単位 */
function recordLabel(r, unit) {
  const content = r.packageContent
    ? t('・{amount}{unit}', { amount: r.packageContent.toLocaleString('ja-JP'), unit: esc(t(r.packageContentUnit)) })
    : '';
  return t('{price}（{qty}{unit}{content}）', { price: money(r.price), qty: r.quantity, unit, content });
}

function dateLabel(date, today) {
  const d = daysSince(date, today);
  const date2 = dateShort(date);
  if (d === 0) return t('{date}（今日）', { date: date2 });
  if (d === 1) return t('{date}（昨日）', { date: date2 });
  return t('{date}（{n}日前）', { date: date2, n: d });
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
                <span class="grow">${esc(s.name)}<span class="note" style="display:block">${t('価格記録 {n}件', { n: s.records })}</span></span>
                <span class="note">›</span></button></li>`
            )
            .join('')}</ul>`
        : `<div class="placeholder">${t('右下の「＋ 店舗」から、よく行くお店を登録してください。')}</div>`;
    }
  );
}

function openAddStoreSheet() {
  const sheet = openSheet({
    title: t('店舗を登録'),
    body: `
      <form novalidate>
        <div class="field">
          <label for="f-name">${t('店舗名')}</label>
          <input id="f-name" name="name" class="input" placeholder="${t('例：〇〇スーパー 駅前店')}" autocomplete="off" enterkeyhint="done">
          <p class="field-error" data-error-for="name"></p>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-block">${t('登録')}</button></div>
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
      toast(t('「{name}」を登録しました', { name: store.name }));
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
          <label for="f-name">${t('店舗名')}</label>
          <div class="row">
            <input id="f-name" name="name" class="input grow" value="${esc(store.name)}" autocomplete="off">
            <button type="submit" class="btn">${t('変更')}</button>
          </div>
          <p class="field-error" data-error-for="name"></p>
        </div>
      </form>
      <section style="margin-top:24px">
        <h3 class="section-title">${t('売り場の順番（≡ を押さえて動かす）')}</h3>
        <ol class="list shelf-list" id="shelf"></ol>
      </section>
      <div class="form-actions"><button type="button" class="btn-danger-text" data-delete-store>${t('この店舗を削除')}</button></div>`,
    onClose: () => stop?.(),
  });

  const form = sheet.el.querySelector('#rename-form');
  bindErrorClear(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await renameStore(storeId, formValues(form).name);
      sheet.el.querySelector('.sheet-header h2').textContent = formValues(form).name.trim();
      toast(t('店舗名を変更しました'));
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });

  const shelfEl = sheet.el.querySelector('#shelf');
  makeSortable(shelfEl, { onSort: (ids) => saveShelfOrder(storeId, ids) });
  stop = watch(
    () => getOrderedCategories(storeId),
    (cats) => {
      shelfEl.innerHTML = cats
        .map(
          (c, i) => `<li data-id="${c.id}">
            ${dragHandle(esc(t(c.name)))}
            <span class="shelf-no">${i + 1}</span>
            <span class="grow">${esc(t(c.name))}</span>
          </li>`
        )
        .join('');
    }
  );

  sheet.el.querySelector('[data-delete-store]').addEventListener('click', async () => {
    const n = await countPriceRecordsOfStore(storeId);
    const msg =
      t('「{name}」を削除しますか？', { name: store.name }) +
      (n ? '\n' + t('この店舗の価格記録 {n}件も削除されます。', { n }) : '') +
      '\n' +
      t('この操作は取り消せません。');
    if (!window.confirm(msg)) return;
    await deleteStore(storeId);
    sheet.close();
    toast(t('店舗を削除しました'));
  });
}
