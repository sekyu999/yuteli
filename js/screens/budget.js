// ⑥ 家計：食材以外の「買いたい物」「やりたい事」を、金額と月で登録して、月ごとに出ていくお金の見込みを見る
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listPlans, getPlan, savePlan, deletePlan, restorePlan, setPlanMonth } from '../data/planRepo.js';
import { makeMovable } from '../ui/moveDrag.js';
import { listProducts, ValidationError } from '../data/productRepo.js';
import { listGroups } from '../data/groupRepo.js';
import { listAllRecords } from '../data/priceRepo.js';
import { PLAN_KINDS, monthlyTotals, monthSections, thisMonth } from '../domain/plans.js';
import { combineConsumption } from '../domain/groups.js';
import { isDaily } from '../domain/consumption.js';
import { dailyCost } from '../domain/cost.js';
import { esc } from '../lib/util.js';
import { t, money, monthText, yearText, monthOnlyText } from '../lib/i18n.js';

export const title = '家計';

/** 何か月先まで見込みを出すか（最初は SHOW_MONTHS か月だけ表示し、残りは折りたたむ） */
const MONTHS = 12;
const SHOW_MONTHS = 6;
let barsOpen = false;

/** 表示中の絞り込み（画面を離れても覚えておく） */
let filter = 'all';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section class="card">
        <div class="card-head"><h2 class="card-title">${t('月ごとの見込み')}</h2><span class="note" id="food-note"></span></div>
        <ul class="month-bars" id="month-bars"></ul>
      </section>
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-filter="all">${t('すべて')}</button>
        ${PLAN_KINDS.map((k) => `<button type="button" role="tab" data-filter="${k.key}">${t(k.label)}</button>`).join('')}
      </div>
      <div id="plan-list" class="stack"></div>
    </div>
    <button type="button" class="fab" data-action="add">${t('＋ 追加')}</button>
  `;
  const barsEl = el.querySelector('#month-bars');
  const listEl = el.querySelector('#plan-list');
  const foodNote = el.querySelector('#food-note');
  let state = null;

  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      filter = f.dataset.filter;
      render();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'add':
        openPlanSheet(null, filter === 'all' ? 'buy' : filter);
        break;
      case 'edit':
        openPlanSheet(btn.dataset.id);
        break;
      case 'done':
        finishPlan(btn);
        break;
    }
  });

  // ≡ を押さえて別の月へドラッグすると、その月に移る
  makeMovable(listEl, {
    label: (key) => monthText(key || null, thisMonth()),
    onDrop: async (id, key) => {
      await setPlanMonth(id, key);
      toast(t('{month}に移動しました', { month: monthText(key || null, thisMonth()) }));
    },
  });

  function render() {
    if (!state) return;
    const { plans, foodPerMonth } = state;
    el.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
    const now = thisMonth();

    // ---- 月ごとの見込み（今月から12か月）----
    const rows = monthlyTotals(plans, now, MONTHS, foodPerMonth);
    const max = Math.max(1, ...rows.map((r) => r.total));
    foodNote.textContent = foodPerMonth ? t('食費の目安 {amount}/月を含む', { amount: money(Math.round(foodPerMonth)) }) : '';
    const barRow = (r) => `<li>
          <span class="mb-month">${monthText(r.month, now)}</span>
          <span class="mb-bar">
            <span class="mb-food" style="width:${(r.food / max) * 100}%"></span><span class="mb-buy" style="width:${(r.buy / max) * 100}%"></span><span class="mb-do" style="width:${(r.do / max) * 100}%"></span>
          </span>
          <span class="mb-total">${money(r.total)}</span>
        </li>`;
    barsEl.innerHTML =
      rows.slice(0, SHOW_MONTHS).map(barRow).join('') +
      `<li class="mb-more"><details ${barsOpen ? 'open' : ''} class="more-nutri"><summary>${t('{n}か月分を見る', { n: MONTHS })}</summary>
        <ul class="month-bars">${rows.slice(SHOW_MONTHS).map(barRow).join('')}</ul></details></li>`;
    barsEl.querySelector('.mb-more details').addEventListener('toggle', (e) => (barsOpen = e.target.open));
    barsEl.insertAdjacentHTML(
      'beforeend',
      `<li class="mb-legend">${foodPerMonth ? `<span><i class="mb-food"></i>${t('食費')}</span>` : ''}<span><i class="mb-buy"></i>${t('買いたい物')}</span><span><i class="mb-do"></i>${t('やりたい事')}</span></li>`
    );

    // ---- 一覧（月ごと）----
    const shown = filter === 'all' ? plans : plans.filter((p) => p.kind === filter);
    if (!shown.length) {
      listEl.innerHTML = `<div class="placeholder">${t('右下の「＋ 追加」から、買いたい物・やりたい事を金額と月で登録できます。')}</div>`;
      return;
    }
    // 今月から12か月は予定がなくても出す（ドラッグの移動先）
    listEl.innerHTML =
      `<p class="note">${t('≡ を押さえて別の月へドラッグすると、月を変えられます。チェックすると一覧から消えます。')}</p>` +
      monthSections(shown, now, MONTHS)
        .map(
          (g) => `<section class="month-sec ${g.items.length ? '' : 'is-empty'}" data-drop="${g.month ?? ''}">
          <h2 class="section-title month-head ${g.month && g.month < now ? 'is-past' : ''}">
            <span>${monthText(g.month, now)}${g.month && g.month < now ? t('（過ぎた月）') : ''}</span><span>${g.items.length ? money(g.total) : '—'}</span>
          </h2>
          ${g.items.length ? `<ul class="list compact-list">${g.items.map(planRow).join('')}</ul>` : ''}
        </section>`
        )
        .join('');
  }

  return watch(
    async () => {
      const [plans, products, groups, records] = await Promise.all([listPlans(), listProducts(), listGroups(), listAllRecords()]);
      // 食費の目安（食事タブと同じ計算）
      const daily = combineConsumption(products, groups).products.filter(isDaily);
      const byProduct = new Map();
      for (const r of records) {
        if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
        byProduct.get(r.productId).push(r);
      }
      const foodPerMonth = daily.length ? dailyCost(daily, byProduct).perMonth : 0;
      return { plans, foodPerMonth };
    },
    (s) => {
      state = s;
      render();
    }
  );
}

/** チェック → 少し見せてから一覧から消す（「元に戻す」で戻せる） */
async function finishPlan(btn) {
  const plan = await getPlan(btn.dataset.id);
  if (!plan) return;
  btn.setAttribute('aria-checked', 'true');
  btn.closest('.plan-row')?.classList.add('is-done');
  setTimeout(async () => {
    await deletePlan(plan.id);
    toast(t('「{name}」を済みにしました', { name: plan.title }), {
      actions: [{ label: t('元に戻す'), onClick: () => restorePlan(plan) }],
    });
  }, 250);
}

function planRow(p) {
  return `<li class="plan-row" data-id="${p.id}">
    <span class="drag-handle" role="button" aria-label="${esc(t('{name}の月を移動', { name: p.title }))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg></span>
    <button type="button" class="check-btn" data-action="done" data-id="${p.id}" role="checkbox" aria-checked="false"
            aria-label="${esc(t('{name}を済みにする', { name: p.title }))}"></button>
    <button type="button" class="row-button" data-action="edit" data-id="${p.id}">
      <span class="grow plan-main"><span class="badge ${p.kind === 'do' ? 'badge-do' : 'badge-muted'}">${t(p.kind === 'do' ? 'やる' : '買う')}</span><span class="compact-name">${esc(p.title)}${
        p.memo ? `<span class="note">　${esc(p.memo)}</span>` : ''
      }</span></span>
      <span class="nowrap plan-price">${money(p.price)}</span>
    </button>
  </li>`;
}

/** 追加・編集シート */
async function openPlanSheet(id, defaultKind = 'buy') {
  const plan = id ? await getPlan(id) : null;
  const v = plan ?? { kind: defaultKind, title: '', price: '', month: thisMonth(), memo: '', done: false };
  const sheet = openSheet({
    title: t(plan ? '編集' : '追加'),
    body: `
      <form novalidate>
        <div class="choice-row">
          ${PLAN_KINDS.map(
            (k) => `<label class="choice"><input type="radio" name="kind" value="${k.key}" ${v.kind === k.key ? 'checked' : ''}><span>${t(k.label)}</span></label>`
          ).join('')}
        </div>
        <div class="field" style="margin-top:18px">
          <label for="f-title">${t('名前')}</label>
          <input id="f-title" name="title" class="input" value="${esc(v.title)}" placeholder="${t('例：冬のコート、温泉旅行')}" autocomplete="off">
          <p class="field-error" data-error-for="title"></p>
        </div>
        <div class="field">
          <label for="f-price">${t('金額')}</label>
          <div class="row" style="align-items:center">
            <input id="f-price" name="price" class="input grow" inputmode="numeric" value="${v.price === '' ? '' : v.price}" placeholder="${t('例：20000')}" autocomplete="off">
            <span class="unit-suffix">${t('円')}</span>
          </div>
          <p class="field-error" data-error-for="price"></p>
        </div>
        <div class="field">
          <label for="f-year">${t('いつ')}</label>
          <div class="row month-pick">
            <select id="f-year" name="year" class="select" aria-label="${t('年')}">${yearOptions(v.month)}</select>
            <select name="mon" class="select" aria-label="${t('月')}">${monthOptions(v.month)}</select>
          </div>
          <label class="check-row" style="margin-top:6px"><input type="checkbox" name="undecided" value="1" ${v.month ? '' : 'checked'}>${t('未定')}</label>
          <p class="field-error" data-error-for="month"></p>
        </div>
        <div class="field">
          <label for="f-memo">${t('メモ')} <span class="optional">${t('任意')}</span></label>
          <input id="f-memo" name="memo" class="input" value="${esc(v.memo)}" autocomplete="off">
          <p class="field-error" data-error-for="memo"></p>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-block">${t('保存')}</button>
          ${plan ? `<button type="button" class="btn-danger-text" data-delete>${t('削除')}</button>` : ''}
        </div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);
  const undecided = form.elements.namedItem('undecided');
  const pickers = form.querySelectorAll('.month-pick select');
  const sync = () => pickers.forEach((x) => (x.disabled = undecided.checked));
  undecided.addEventListener('change', sync);
  sync();
  if (!plan) form.elements.namedItem('title').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const v2 = formValues(form);
      v2.month = v2.year && v2.mon ? `${v2.year}-${v2.mon}` : '';
      await savePlan(plan?.id ?? null, v2);
      sheet.close();
      toast(t('保存しました'));
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!window.confirm(t('「{name}」を削除しますか？', { name: plan.title }))) return;
    await deletePlan(plan.id);
    sheet.close();
    toast(t('削除しました'));
  });
}

/** 年のプルダウン（去年〜5年後）。iPhone の月選択は言語によって横に広がるため、プルダウンにしている */
function yearOptions(month) {
  const now = new Date().getFullYear();
  const sel = Number((month ?? thisMonth()).slice(0, 4));
  const years = [];
  for (let y = Math.min(now - 1, sel); y <= Math.max(now + 5, sel); y++) years.push(y);
  return years.map((y) => `<option value="${y}" ${y === sel ? 'selected' : ''}>${yearText(y)}</option>`).join('');
}

function monthOptions(month) {
  const sel = (month ?? thisMonth()).slice(5, 7);
  return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
    .map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${monthOnlyText(Number(m))}</option>`)
    .join('');
}
