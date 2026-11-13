// ⑥ 家計：食材以外の「買いたい物」「やりたい事」を、金額と月で登録して、月ごとに出ていくお金の見込みを見る
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listPlans, getPlan, savePlan, deletePlan, restorePlan, setPlanMonth } from '../data/planRepo.js';
import { makeMovable } from '../ui/moveDrag.js';
import { ValidationError } from '../data/productRepo.js';
import { PLAN_KINDS, monthlyTotals, monthSections, thisMonth } from '../domain/plans.js';
import { esc } from '../lib/util.js';
import { t, money, monthText } from '../lib/i18n.js';
import { yearOptions, monthOptions } from '../ui/monthPick.js';

export const title = '家計';

/** 何か月先まで見込みを出すか（最初は SHOW_MONTHS か月だけ表示し、残りは折りたたむ） */
const MONTHS = 12;
const SHOW_MONTHS = 3;
let barsOpen = false;

/** 表示中の絞り込み（画面を離れても覚えておく） */
let filter = 'all';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section class="card">
        <h2 class="card-title">${t('月ごとの見込み')}</h2>
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
    const { plans } = state;
    el.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
    const now = thisMonth();

    // ---- 月ごとの見込み（今月から12か月。食費は含めない）----
    const rows = monthlyTotals(plans, now, MONTHS);
    const max = Math.max(1, ...rows.map((r) => r.total));
    const barRow = (r) => `<li>
          <span class="mb-month">${monthText(r.month, now)}</span>
          <span class="mb-bar">
            <span class="mb-buy" style="width:${(r.buy / max) * 100}%"></span><span class="mb-do" style="width:${(r.do / max) * 100}%"></span>
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
      `<li class="mb-legend"><span><i class="mb-buy"></i>${t('買いたい物')}</span><span><i class="mb-do"></i>${t('やりたい事')}</span></li>`
    );

    // ---- 一覧（月ごと）----
    const shown = filter === 'all' ? plans : plans.filter((p) => p.kind === filter);
    if (!shown.length) {
      listEl.innerHTML = `<div class="placeholder">${t('右下の「＋ 追加」から、買いたい物・やりたい事を金額と月で登録できます。')}</div>`;
      return;
    }
    // 今月から12か月は予定がなくても出す（ドラッグの移動先）
    listEl.innerHTML = monthSections(shown, now, MONTHS)
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
    async () => ({ plans: await listPlans() }),
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

/** URL は http/https の時だけリンクにする（バックアップから入った値も念のため確認） */
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');

function planRow(p) {
  const url = safeUrl(p.url);
  return `<li class="plan-row" data-id="${p.id}">
    <span class="drag-handle" role="button" aria-label="${esc(t('{name}の月を移動', { name: p.title }))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg></span>
    <button type="button" class="check-btn" data-action="done" data-id="${p.id}" role="checkbox" aria-checked="false"
            aria-label="${esc(t('{name}を済みにする', { name: p.title }))}"></button>
    <button type="button" class="row-button" data-action="edit" data-id="${p.id}">
      <span class="grow plan-main"><span class="plan-title"><span class="badge ${p.kind === 'do' ? 'badge-do' : 'badge-muted'}">${t(
        p.kind === 'do' ? 'やる' : '買う'
      )}</span>${esc(p.title)}<span class="visually-hidden">${money(p.price)}</span></span>${p.memo ? `<span class="plan-memo">${esc(p.memo)}</span>` : ''}</span>
    </button>
    <span class="plan-side">
      <span class="plan-price" data-action="edit" data-id="${p.id}" aria-hidden="true">${money(p.price)}</span>
      ${
        url
          ? `<a class="plan-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t('{name}のリンクを開く', { name: p.title }))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></a>`
          : ''
      }
    </span>
  </li>`;
}

/** 追加・編集シート */
async function openPlanSheet(id, defaultKind = 'buy') {
  const plan = id ? await getPlan(id) : null;
  const v = plan ?? { kind: defaultKind, title: '', price: '', month: thisMonth(), memo: '', url: '', done: false };
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
          <textarea id="f-memo" name="memo" class="input memo-input" rows="2" maxlength="200">${esc(v.memo)}</textarea>
          <p class="field-error" data-error-for="memo"></p>
        </div>
        <div class="field">
          <label for="f-url">URL <span class="optional">${t('任意')}</span></label>
          <input id="f-url" name="url" class="input" type="url" inputmode="url" value="${esc(v.url ?? '')}" placeholder="https://" autocomplete="off" autocapitalize="off" spellcheck="false">
          <p class="field-error" data-error-for="url"></p>
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
