// ⑥ 家計：食材以外の「買いたい物」「やりたい事」を、金額と月で登録して、月ごとに出ていくお金の見込みを見る
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listPlans, getPlan, savePlan, setPlanDone, deletePlan } from '../data/planRepo.js';
import { listProducts, ValidationError } from '../data/productRepo.js';
import { listGroups } from '../data/groupRepo.js';
import { listAllRecords } from '../data/priceRepo.js';
import { PLAN_KINDS, monthlyTotals, groupByMonth, monthLabel, thisMonth } from '../domain/plans.js';
import { combineConsumption } from '../domain/groups.js';
import { isDaily } from '../domain/consumption.js';
import { dailyCost } from '../domain/cost.js';
import { yen } from '../domain/pricing.js';
import { esc } from '../lib/util.js';

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
        <div class="card-head"><h2 class="card-title">月ごとの見込み</h2><span class="note" id="food-note"></span></div>
        <ul class="month-bars" id="month-bars"></ul>
      </section>
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-filter="all">すべて</button>
        ${PLAN_KINDS.map((k) => `<button type="button" role="tab" data-filter="${k.key}">${k.label}</button>`).join('')}
      </div>
      <div id="plan-list" class="stack"></div>
    </div>
    <button type="button" class="fab" data-action="add">＋ 追加</button>
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
    const t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.dataset.action) {
      case 'add':
        openPlanSheet(null, filter === 'all' ? 'buy' : filter);
        break;
      case 'edit':
        openPlanSheet(t.dataset.id);
        break;
      case 'done':
        setPlanDone(t.dataset.id, t.getAttribute('aria-checked') !== 'true');
        break;
    }
  });

  function render() {
    if (!state) return;
    const { plans, foodPerMonth } = state;
    el.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
    const now = thisMonth();

    // ---- 月ごとの見込み（今月から12か月）----
    const rows = monthlyTotals(plans, now, MONTHS, foodPerMonth);
    const max = Math.max(1, ...rows.map((r) => r.total));
    foodNote.textContent = foodPerMonth ? `食費の目安 ${yen(Math.round(foodPerMonth))}/月を含む` : '';
    const barRow = (r) => `<li>
          <span class="mb-month">${monthLabel(r.month, now)}</span>
          <span class="mb-bar">
            <span class="mb-food" style="width:${(r.food / max) * 100}%"></span><span class="mb-buy" style="width:${(r.buy / max) * 100}%"></span><span class="mb-do" style="width:${(r.do / max) * 100}%"></span>
          </span>
          <span class="mb-total">${yen(r.total)}</span>
        </li>`;
    barsEl.innerHTML =
      rows.slice(0, SHOW_MONTHS).map(barRow).join('') +
      `<li class="mb-more"><details ${barsOpen ? 'open' : ''} class="more-nutri"><summary>${MONTHS}か月分を見る</summary>
        <ul class="month-bars">${rows.slice(SHOW_MONTHS).map(barRow).join('')}</ul></details></li>`;
    barsEl.querySelector('.mb-more details').addEventListener('toggle', (e) => (barsOpen = e.target.open));
    barsEl.insertAdjacentHTML(
      'beforeend',
      `<li class="mb-legend">${foodPerMonth ? '<span><i class="mb-food"></i>食費</span>' : ''}<span><i class="mb-buy"></i>買いたい物</span><span><i class="mb-do"></i>やりたい事</span></li>`
    );

    // ---- 一覧（月ごと）----
    const shown = filter === 'all' ? plans : plans.filter((p) => p.kind === filter);
    if (!shown.length) {
      listEl.innerHTML = `<div class="placeholder">右下の「＋ 追加」から、買いたい物・やりたい事を金額と月で登録できます。</div>`;
      return;
    }
    listEl.innerHTML = groupByMonth(shown)
      .map(
        (g) => `<section>
          <h2 class="section-title month-head ${g.month && g.month < now ? 'is-past' : ''}">
            <span>${monthLabel(g.month, now)}${g.month && g.month < now ? '（過ぎた月）' : ''}</span><span>${yen(g.total)}</span>
          </h2>
          <ul class="list compact-list">${g.items.map(planRow).join('')}</ul>
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

function planRow(p) {
  const kind = PLAN_KINDS.find((k) => k.key === p.kind);
  return `<li class="plan-row ${p.done ? 'is-done' : ''}">
    <button type="button" class="check-btn" data-action="done" data-id="${p.id}" role="checkbox" aria-checked="${p.done}"
            aria-label="${esc(p.title)}を${p.done ? '未完了に戻す' : '済みにする'}"></button>
    <button type="button" class="row-button" data-action="edit" data-id="${p.id}">
      <span class="grow plan-main"><span class="badge ${p.kind === 'do' ? 'badge-do' : 'badge-muted'}">${p.kind === 'do' ? 'やる' : '買う'}</span><span class="compact-name">${esc(p.title)}${
        p.memo ? `<span class="note">　${esc(p.memo)}</span>` : ''
      }</span></span>
      <span class="nowrap plan-price">${yen(p.price)}</span>
    </button>
  </li>`;
}

/** 追加・編集シート */
async function openPlanSheet(id, defaultKind = 'buy') {
  const plan = id ? await getPlan(id) : null;
  const v = plan ?? { kind: defaultKind, title: '', price: '', month: thisMonth(), memo: '', done: false };
  const sheet = openSheet({
    title: plan ? '編集' : '追加',
    body: `
      <form novalidate>
        <div class="choice-row">
          ${PLAN_KINDS.map(
            (k) => `<label class="choice"><input type="radio" name="kind" value="${k.key}" ${v.kind === k.key ? 'checked' : ''}><span>${k.label}</span></label>`
          ).join('')}
        </div>
        <div class="field" style="margin-top:18px">
          <label for="f-title">名前</label>
          <input id="f-title" name="title" class="input" value="${esc(v.title)}" placeholder="例：冬のコート、温泉旅行" autocomplete="off">
          <p class="field-error" data-error-for="title"></p>
        </div>
        <div class="row-fields" style="grid-template-columns: 1fr 1fr">
          <div class="field">
            <label for="f-price">金額</label>
            <div class="row" style="align-items:center">
              <input id="f-price" name="price" class="input" inputmode="numeric" value="${v.price === '' ? '' : v.price}" placeholder="例：20000" autocomplete="off">
              <span class="unit-suffix">円</span>
            </div>
            <p class="field-error" data-error-for="price"></p>
          </div>
          <div class="field">
            <label for="f-month">月</label>
            <input id="f-month" name="month" type="month" class="input" value="${v.month ?? ''}">
            <p class="field-error" data-error-for="month"></p>
          </div>
        </div>
        <label class="check-row" style="margin-top:6px"><input type="checkbox" name="undecided" value="1" ${v.month ? '' : 'checked'}>月は未定</label>
        <div class="field">
          <label for="f-memo">メモ <span class="optional">任意</span></label>
          <input id="f-memo" name="memo" class="input" value="${esc(v.memo)}" autocomplete="off">
          <p class="field-error" data-error-for="memo"></p>
        </div>
        <label class="check-row" style="margin-top:10px"><input type="checkbox" name="done" value="1" ${v.done ? 'checked' : ''}>済み（買った・やった）</label>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-block">保存</button>
          ${plan ? '<button type="button" class="btn-danger-text" data-delete>削除</button>' : ''}
        </div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);
  const monthInput = form.elements.namedItem('month');
  const undecided = form.elements.namedItem('undecided');
  const sync = () => (monthInput.disabled = undecided.checked);
  undecided.addEventListener('change', sync);
  sync();
  if (!plan) form.elements.namedItem('title').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await savePlan(plan?.id ?? null, formValues(form));
      sheet.close();
      toast('保存しました');
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!window.confirm(`「${plan.title}」を削除しますか？`)) return;
    await deletePlan(plan.id);
    sheet.close();
    toast('削除しました');
  });
}
