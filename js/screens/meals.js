// ④ 食事：毎日食べる物・グループの栄養と食費／健康の悩みからの食材提案
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { listProducts } from '../data/productRepo.js';
import { listAllRecords } from '../data/priceRepo.js';
import { listGroups } from '../data/groupRepo.js';
import { getMeta, META } from '../data/metaRepo.js';
import { MEALS, isDaily, intakeUnit } from '../domain/consumption.js';
import { combineConsumption, groupOnly, GROUP_UNITS } from '../domain/groups.js';
import {
  NUTRIENTS,
  sumNutrients,
  nutrientsOf,
  targetsFor,
  evaluate,
  targetLabel,
  formatValue,
  bodyStats,
} from '../domain/nutrition.js';
import { dailyCost, DAYS_PER_MONTH } from '../domain/cost.js';
import { openProductSheet } from './productSheet.js';
import { openGroupSheet } from './groupSheet.js';
import { openProfileSheet } from './profileSheet.js';
import * as suggestions from './health.js';
import { esc } from '../lib/util.js';
import { t, money } from '../lib/i18n.js';

export const title = '食事';

/** 主な栄養素（いつも表示）。それ以外は「ビタミン・ミネラル」に折りたたむ */
const MAIN = ['energy', 'protein', 'fat', 'carb', 'fiber', 'salt'];

/** 画面を離れても覚えておく表示状態 */
let tab = 'daily';
let meal = 'all';
let moreOpen = false;

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-tab="daily">${t('栄養・食費')}</button>
        <button type="button" role="tab" data-tab="suggest">${t('食材の提案')}</button>
      </div>
      <div id="tab-body"></div>
    </div>
  `;
  const body = el.querySelector('#tab-body');
  let stop = null;

  function showTab() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    stop?.();
    const box = document.createElement('div');
    body.replaceChildren(box);
    stop = tab === 'daily' ? mountDaily(box) : suggestions.mount(box);
  }
  el.querySelector('.segmented').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    tab = btn.dataset.tab;
    showTab();
  });
  showTab();
  return () => stop?.();
}

// ====================== 栄養・食費 ======================

function mountDaily(el) {
  let state = null;

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    switch (btn.dataset.act) {
      case 'meal':
        meal = btn.dataset.meal;
        render();
        break;
      case 'profile':
        openProfileSheet();
        break;
      case 'edit':
        openProductSheet(btn.dataset.id);
        break;
      case 'group':
        openGroupSheet(btn.dataset.id);
        break;
      case 'new-group':
        openGroupSheet();
        break;
      case 'add-food':
        openPickSheet(state.raw);
        break;
    }
  });
  el.addEventListener('toggle', (e) => {
    if (e.target.matches('.more-nutri')) moreOpen = e.target.open;
  }, true);

  function render() {
    if (!state) return;
    const { raw, groups, records, profile } = state;
    const { products, issues } = combineConsumption(raw, groups);
    const daily = products.filter(isDaily);
    const targets = targetsFor(profile);
    const body = profile ? bodyStats(profile) : null;

    const actions = `
      <div class="btn-row">
        <button type="button" class="btn" data-act="add-food">${t('＋ 食品')}</button>
        <button type="button" class="btn" data-act="new-group">${t('＋ グループ')}</button>
      </div>`;

    if (!daily.length) {
      el.innerHTML = `
        <div class="stack">
          <div class="placeholder">
            <p>${t('毎日食べる物を登録すると、栄養と食費が出ます。')}</p>
          </div>
          ${actions}
          ${groups.length ? groupListHtml(groups, raw) : ''}
        </div>`;
      return;
    }

    // 食べる物が登録されている食事だけタブを出す
    const usedMeals = MEALS.filter((m) => daily.some((p) => Number(p.consumption[m.key]) > 0));
    if (meal !== 'all' && !usedMeals.some((m) => m.key === meal)) meal = 'all';
    const mealKey = meal === 'all' ? null : meal;
    const sum = sumNutrients(daily, mealKey);
    const recordsBy = new Map();
    for (const r of records) {
      if (!recordsBy.has(r.productId)) recordsBy.set(r.productId, []);
      recordsBy.get(r.productId).push(r);
    }
    const cost = dailyCost(daily, recordsBy);
    const showTargets = meal === 'all' ? targets : null;

    el.innerHTML = `
      <div class="stack">
        <div class="segmented meal-tabs" role="tablist">
          ${[{ key: 'all', label: '1日' }, ...usedMeals]
            .map((m) => `<button type="button" role="tab" data-act="meal" data-meal="${m.key}" aria-selected="${meal === m.key}">${t(m.label)}</button>`)
            .join('')}
        </div>

        <section class="card">
          <div class="card-head">
            <h2 class="card-title">${t('栄養')}</h2>
            <button type="button" class="chip-btn" data-act="profile">${
              targets
                ? body
                  ? t('基礎代謝 {kcal}kcal', { kcal: body.bmr.toLocaleString() }) + (body.bmi ? t('・BMI {bmi}', { bmi: body.bmi.toFixed(1) }) : '')
                  : t('からだの情報')
                : t('目標を設定')
            }</button>
          </div>
          ${nutriRows(MAIN, sum, showTargets, targets)}
          <details class="more-nutri" ${moreOpen ? 'open' : ''}>
            <summary>${t('ビタミン・ミネラル')}</summary>
            ${nutriRows(NUTRIENTS.map((n) => n.key).filter((k) => !MAIN.includes(k)), sum, showTargets, targets)}
          </details>
          ${problemsHtml(sum, issues)}
        </section>

        <section class="card">
          <h2 class="card-title">${t('食費')}</h2>
          <div class="cost-main">
            <div><span class="note">${t('1か月')}</span><strong class="cost-big">${money(Math.round(cost.perMonth))}</strong></div>
            <div><span class="note">${t('1日')}</span><strong>${money(Math.round(cost.perDay))}</strong></div>
            ${usedMeals.map((m) => `<div><span class="note">${t(m.label)}</span><span>${money(Math.round(cost.perMeal[m.key]))}</span></div>`).join('')}
          </div>
          ${cost.noPrice.length ? `<p class="note warn-text">${t('価格なし：{names}', { names: cost.noPrice.map((p) => esc(p.name)).join(t('、')) })}</p>` : ''}
        </section>

        <section>
          ${mealListHtml(products, groups, raw, cost)}
          ${actions}
        </section>
      </div>`;
  }

  return watch(
    async () => {
      const [raw, groups, records, profile] = await Promise.all([
        listProducts(),
        listGroups(),
        listAllRecords(),
        getMeta(META.profile),
      ]);
      return { raw, groups, records, profile };
    },
    (s) => {
      state = s;
      render();
    }
  );
}

/** 栄養素の行（2行：名前と量／バーと判定） */
function nutriRows(keys, sum, targets, dailyTargets) {
  return `<ul class="nutri-list">${keys
    .map((key) => {
      const n = NUTRIENTS.find((x) => x.key === key);
      const value = sum.totals[key];
      const target = targets?.[key];
      const ev = target ? evaluate(value, target) : null;
      const ref = !targets ? dailyTargets?.[key] : null;
      const refBase = ref ? (ref.kind === 'range' ? ref.low : ref.value) : null;
      const ratio = ev ? ev.ratio : refBase ? value / refBase : null;
      const unknown = sum.unknown[key].length ? '<sup>*</sup>' : '';
      let foot = '';
      if (ev) foot = `<span class="note">${targetLabel(target, n, t)}</span><span class="nutri-status">${t(ev.label)}</span>`;
      else if (ref) foot = `<span class="note">${t('1日の目標の{pct}%', { pct: Math.round(ratio * 100) })}</span>`;
      return `<li class="nutri-row ${ev ? `is-${ev.status}` : ''}">
        <span class="nutri-name">${t(n.label)}</span>
        <span class="nutri-value">${formatValue(value, n)}<small>${n.unit}</small>${unknown}</span>
        ${
          ratio !== null
            ? `<span class="nutri-bar"><span style="width:${Math.min(100, Math.round(ratio * 100 * (2 / 3)))}%"></span><i></i></span>`
            : ''
        }
        ${foot ? `<span class="nutri-foot">${foot}</span>` : ''}
      </li>`;
    })
    .join('')}</ul>`;
}

/** 計算に入らなかった物 */
function problemsHtml(sum, issues) {
  const names = new Map();
  const add = (p, why) => names.set(p.id, { p, why });
  for (const m of sum.missing) add(m.product, m.reason === 'no-nutrition' ? t('栄養なし') : t('重さなし'));
  for (const i of issues) add(i.product, i.reason === 'no-serving' ? t('1回の量なし') : t('重さなし'));
  if (!names.size) return '';
  const list = [...names.values()]
    .map(({ p, why }) => `<button type="button" class="link-btn" data-act="edit" data-id="${p.id}">${esc(p.name)}</button>${t('（{text}）', { text: why })}`)
    .join(t('、'));
  return `<p class="note warn-text">${t('計算に入っていない：{list}', { list })}</p>`;
}

/** 朝・昼・晩ごとの一覧（食品とグループ） */
function mealListHtml(products, groups, raw, cost) {
  const costBy = new Map(cost.items.map((i) => [i.product.id, i]));
  const own = products.filter((p) => p.ownConsumption && Object.values(p.ownConsumption).some((v) => Number(v) > 0));
  return MEALS.map((m) => {
    const ownItems = own.filter((p) => Number(p.ownConsumption[m.key]) > 0);
    const groupItems = groups.filter((g) => Number(g.consumption[m.key]) > 0);
    if (!ownItems.length && !groupItems.length) return '';
    const rows = [
      ...ownItems.map((p) => {
        // 自分の分だけの栄養・食費
        const solo = { ...p, consumption: p.ownConsumption };
        const kcal = nutrientsOf(solo, m.key)?.values.energy;
        const unitPrice = costBy.get(p.id)?.unitPrice?.price;
        const amount = Number(p.ownConsumption[m.key]);
        return row('edit', p.id, esc(p.name), `${formatValue(amount, { digits: 2 })}${esc(t(intakeUnit(p)))}`, kcal, unitPrice ? unitPrice * amount : null);
      }),
      ...groupItems.map((g) => {
        const members = groupOnly(g, raw);
        const s = sumNutrients(members, m.key);
        // グループの食費：メンバーの単価 × 分けた量
        let yenSum = 0;
        let priced = true;
        for (const p of members) {
          const up = costBy.get(p.id)?.unitPrice?.price;
          const amt = Number(p.consumption[m.key]) || 0;
          if (!amt) continue;
          if (up === undefined || up === null) priced = false;
          else yenSum += up * amt;
        }
        const unit = t(GROUP_UNITS.find((u) => u.key === g.unit).short);
        return row(
          'group',
          g.id,
          `${esc(g.name)}<span class="note">${t('（{text}）', { text: members.map((p) => esc(p.name)).join(t('・')) || t('食品なし') })}</span>`,
          `${formatValue(Number(g.consumption[m.key]), { digits: 2 })}${unit}`,
          s.totals.energy,
          priced ? yenSum : null
        );
      }),
    ];
    return `<h3 class="meal-heading">${t(m.label)}</h3><ul class="list compact-list">${rows.join('')}</ul>`;
  }).join('');
}

function row(act, id, name, amount, kcal, price) {
  const bits = [amount];
  if (kcal !== null && kcal !== undefined) bits.push(`${Math.round(kcal)}kcal`);
  if (price !== null && price !== undefined) bits.push(money(Math.round(price)));
  return `<li><button type="button" class="row-button" data-act="${act}" data-id="${id}">
    <span class="grow compact-name">${name}</span><span class="note nowrap">${bits.join(t('・'))}</span></button></li>`;
}

/** グループ一覧（毎日の量がまだない時に表示） */
function groupListHtml(groups, raw) {
  return `<ul class="list compact-list">${groups
    .map((g) => {
      const members = groupOnly(g, raw);
      return row(
        'group',
        g.id,
        `${esc(g.name)}<span class="note">${t('（{text}）', { text: members.map((p) => esc(p.name)).join(t('・')) })}</span>`,
        t('量を設定'),
        null,
        null
      );
    })
    .join('')}</ul>`;
}

/** 在庫の商品から、毎日食べる物を選んで設定するシート */
function openPickSheet(products) {
  const sorted = [...products].sort((a, b) => Number(isDaily(b)) - Number(isDaily(a)) || a.name.localeCompare(b.name, 'ja'));
  const sheet = openSheet({
    title: t('毎日食べる物'),
    body: `
      <ul class="list compact-list">
        ${sorted
          .map(
            (p) => `<li><button type="button" class="row-button" data-pick="${p.id}">
              <span class="grow">${esc(p.name)}</span>
              ${isDaily(p) ? `<span class="badge">${t('設定済み')}</span>` : '<span class="note">›</span>'}</button></li>`
          )
          .join('')}
      </ul>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-block" data-new>${t('＋ 新しく登録')}</button></div>`,
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
