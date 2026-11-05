// ④ 食事：毎日食べる物の栄養・食費／健康の悩みからの食材提案
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { listProducts } from '../data/productRepo.js';
import { listAllRecords } from '../data/priceRepo.js';
import { listStores } from '../data/storeRepo.js';
import { getMeta, META } from '../data/metaRepo.js';
import { MEALS, isDaily, intakeUnit } from '../domain/consumption.js';
import { NUTRIENTS, sumNutrients, nutrientsOf, targetsFor, evaluate, targetLabel, formatValue } from '../domain/nutrition.js';
import { dailyCost, DAYS_PER_MONTH } from '../domain/cost.js';
import { yen } from '../domain/pricing.js';
import { DRI_SOURCE } from '../content/dri2025.js';
import { openProductSheet } from './productSheet.js';
import { openProfileSheet, profileSummary } from './profileSheet.js';
import * as suggestions from './health.js';
import { esc } from '../lib/util.js';

export const title = '食事';

/** 表示中のタブと食事（画面を離れても覚えておく） */
let tab = 'daily';
let meal = 'all';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-tab="daily">栄養・食費</button>
        <button type="button" role="tab" data-tab="suggest">食材の提案</button>
      </div>
      <div id="tab-body"></div>
    </div>
  `;
  const body = el.querySelector('#tab-body');
  let stop = null;

  function showTab() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    stop?.();
    body.replaceChildren();
    const box = document.createElement('div');
    body.append(box);
    stop = tab === 'daily' ? mountDaily(box) : suggestions.mount(box);
  }
  el.querySelector('.segmented').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    tab = t.dataset.tab;
    showTab();
  });
  showTab();
  return () => stop?.();
}

// ====================== 栄養・食費 ======================

function mountDaily(el) {
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    switch (t.dataset.act) {
      case 'meal':
        meal = t.dataset.meal;
        render();
        break;
      case 'profile':
        openProfileSheet();
        break;
      case 'edit':
        openProductSheet(t.dataset.id);
        break;
      case 'add-daily':
        openPickSheet(state.products);
        break;
      case 'new':
        openProductSheet();
        break;
    }
  });

  let state = null;

  function render() {
    if (!state) return;
    const { products, records, stores, profile } = state;
    const daily = products.filter(isDaily);
    const targets = targetsFor(profile);

    if (!daily.length) {
      el.innerHTML = `
        <div class="placeholder">
          <p>毎日食べる物がまだありません。</p>
          <p>在庫の商品に「朝・昼・晩に食べる量」を入れると、栄養と食費がここに出ます。</p>
          <p style="margin-top:12px"><button type="button" class="btn btn-primary" data-act="add-daily">毎日食べる物を設定する</button></p>
        </div>
        ${profileCard(profile)}`;
      return;
    }

    const mealKey = meal === 'all' ? null : meal;
    const sum = sumNutrients(daily, mealKey);
    const recordsBy = new Map();
    for (const r of records) {
      if (!recordsBy.has(r.productId)) recordsBy.set(r.productId, []);
      recordsBy.get(r.productId).push(r);
    }
    const cost = dailyCost(daily, recordsBy);
    const storeName = new Map(stores.map((s) => [s.id, s.name]));

    el.innerHTML = `
      <div class="stack">
        <div class="segmented meal-tabs" role="tablist">
          ${[{ key: 'all', label: '1日' }, ...MEALS]
            .map((m) => `<button type="button" role="tab" data-act="meal" data-meal="${m.key}" aria-selected="${meal === m.key}">${m.label}</button>`)
            .join('')}
        </div>

        ${targets ? '' : profileCard(profile)}

        <section class="card">
          <h2 class="card-title">栄養${meal === 'all' ? '（1日の合計）' : `（${MEALS.find((m) => m.key === meal).label}）`}</h2>
          ${nutritionTable(sum, meal === 'all' ? targets : null, targets)}
          ${missingNote(sum)}
          <p class="note" style="margin-top:10px">登録した毎日の食品だけの合計です。外食・間食・調味料などは入っていません。${
            targets ? `目標：${esc(DRI_SOURCE)}（${esc(profileSummary(profile))}）` : ''
          }</p>
          ${targets ? '<button type="button" class="link-btn" data-act="profile">目標の条件を変える</button>' : ''}
        </section>

        <section class="card">
          <h2 class="card-title">食費</h2>
          <div class="cost-main">
            <div><span class="note">1か月（${DAYS_PER_MONTH}日）</span><strong class="cost-big">${yen(Math.round(cost.perMonth))}</strong></div>
            <div><span class="note">1日</span><strong>${yen(Math.round(cost.perDay))}</strong></div>
          </div>
          <div class="cost-meals">
            ${MEALS.map((m) => `<div><span class="note">${m.label}</span><span>${yen(Math.round(cost.perMeal[m.key]))}</span></div>`).join('')}
          </div>
          ${
            cost.noPrice.length
              ? `<p class="notice" style="margin-top:12px">価格の記録がないため計算に入っていない物：${cost.noPrice
                  .map((p) => esc(p.name))
                  .join('、')}<br><span class="note">「価格」タブで記録すると計算に入ります。</span></p>`
              : ''
          }
          <p class="note" style="margin-top:10px">各店舗の最新価格のうち一番安いものを使った目安です。</p>
        </section>

        <section>
          <h2 class="section-title">毎日食べる物</h2>
          ${dailyList(daily, cost, storeName)}
          <div class="form-actions" style="margin-top:12px">
            <button type="button" class="btn btn-block" data-act="add-daily">＋ 在庫の商品から追加・変更</button>
          </div>
        </section>
      </div>`;
  }

  return watch(
    async () => {
      const [products, records, stores, profile] = await Promise.all([
        listProducts(),
        listAllRecords(),
        listStores(),
        getMeta(META.profile),
      ]);
      return { products, records, stores, profile };
    },
    (s) => {
      state = s;
      render();
    }
  );
}

function profileCard(profile) {
  return `
    <section class="card notice-card">
      <p><strong>性別・年齢を設定すると、目標と比べて「足りている／多すぎる」を表示します。</strong></p>
      <p class="note" style="margin-top:4px">現在：${esc(profileSummary(profile))}</p>
      <button type="button" class="btn btn-block" data-act="profile" style="margin-top:10px">設定する</button>
    </section>`;
}

/** 栄養素の表。目標がある時は判定とバーを出す */
function nutritionTable(sum, targets, dailyTargets) {
  return `<ul class="nutri-list">
    ${NUTRIENTS.map((n) => {
      const value = sum.totals[n.key];
      const t = targets?.[n.key];
      const ev = t ? evaluate(value, t) : null;
      // 朝・昼・晩の表示では、1日の目標に対する割合を参考に出す
      const ref = !targets && dailyTargets?.[n.key] ? dailyTargets[n.key] : null;
      const refBase = ref ? (ref.kind === 'range' ? ref.low : ref.value) : null;
      const ratio = ev ? ev.ratio : refBase ? value / refBase : null;
      const unknown = sum.unknown[n.key].length;
      return `<li class="nutri-row ${ev ? `is-${ev.status}` : ''}">
        <div class="nutri-head">
          <span class="nutri-name">${n.label}</span>
          <span class="nutri-value">${formatValue(value, n)}<small>${n.unit}</small>${unknown ? '<sup title="一部不明">*</sup>' : ''}</span>
        </div>
        ${
          ratio !== null
            ? `<div class="nutri-bar"><span style="width:${Math.min(100, Math.round(ratio * 100 * (2 / 3)))}%"></span><i></i></div>`
            : ''
        }
        <div class="nutri-foot">
          ${t ? `<span class="note">目標 ${targetLabel(t, n)}</span><span class="nutri-status">${ev.label}${ratio !== null && t.kind !== 'max' ? `（${Math.round(ratio * 100)}%）` : ''}</span>` : ''}
          ${ref ? `<span class="note">1日の目標の${Math.round((value / refBase) * 100)}%</span>` : ''}
        </div>
      </li>`;
    }).join('')}
  </ul>
  ${
    NUTRIENTS.some((n) => sum.unknown[n.key].length)
      ? '<p class="note" style="margin-top:8px">* 値が分からない食品があり、その分は入っていません。</p>'
      : ''
  }`;
}

function missingNote(sum) {
  if (!sum.missing.length) return '';
  const noNut = sum.missing.filter((m) => m.reason === 'no-nutrition').map((m) => m.product);
  const noW = sum.missing.filter((m) => m.reason === 'no-weight').map((m) => m.product);
  const link = (p) => `<button type="button" class="link-btn" data-act="edit" data-id="${p.id}">${esc(p.name)}</button>`;
  return `<div class="notice" style="margin-top:12px">
    ${noNut.length ? `<p>栄養データが未設定：${noNut.map(link).join('、')}</p>` : ''}
    ${noW.length ? `<p>1個あたりの重さが未設定：${noW.map(link).join('、')}</p>` : ''}
    <p class="note">タップして設定すると、栄養の合計に入ります。</p>
  </div>`;
}

/** 朝・昼・晩ごとの「毎日食べる物」一覧 */
function dailyList(daily, cost, storeName) {
  const costBy = new Map(cost.items.map((i) => [i.product.id, i]));
  return MEALS.map((m) => {
    const items = daily.filter((p) => Number(p.consumption[m.key]) > 0);
    if (!items.length) return '';
    return `<h3 class="meal-heading">${m.label}</h3>
      <ul class="list">
        ${items
          .map((p) => {
            const n = nutrientsOf(p, m.key);
            const c = costBy.get(p.id);
            const amount = `${formatValue(Number(p.consumption[m.key]), { digits: 2 })}${esc(intakeUnit(p))}`;
            const kcal = n?.values.energy;
            return `<li><button type="button" class="row-button" data-act="edit" data-id="${p.id}">
              <span class="grow"><span class="item-name" style="font-size:17px">${esc(p.name)}</span>
              <span class="note">${amount}${kcal !== null && kcal !== undefined ? `・${Math.round(kcal)}kcal` : ''}${
                c?.perMeal ? `・${yen(Math.round(c.perMeal[m.key]))}` : ''
              }</span></span>
              <span class="note">›</span></button></li>`;
          })
          .join('')}
      </ul>`;
  }).join('');
}

/** 在庫の商品から、毎日食べる物を選んで設定するシート */
function openPickSheet(products) {
  const sorted = [...products].sort((a, b) => Number(isDaily(b)) - Number(isDaily(a)) || a.name.localeCompare(b.name, 'ja'));
  const sheet = openSheet({
    title: '毎日食べる物を設定',
    body: `
      <p class="note">商品を選んで、朝・昼・晩に食べる量を入れてください。在庫にない物は「新しく登録」から。</p>
      <ul class="list" style="margin-top:12px">
        ${sorted
          .map(
            (p) => `<li><button type="button" class="row-button" data-pick="${p.id}">
              <span class="grow">${esc(p.name)}</span>
              ${isDaily(p) ? '<span class="badge">設定済み</span>' : '<span class="note">設定する ›</span>'}</button></li>`
          )
          .join('')}
      </ul>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-block" data-new>＋ 新しく登録</button></div>`,
  });
  sheet.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) {
      sheet.close();
      openProductSheet(b.dataset.pick);
    }
    if (e.target.closest('[data-new]')) {
      sheet.close();
      openProductSheet();
    }
  });
}
