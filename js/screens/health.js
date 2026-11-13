// ④ 健康・食材提案
// 悩みを選ぶ → 栄養素・おすすめ食材・取り入れ方を表示 → 気に入った食材だけ手動でリスト・在庫へ追加
// 上には「栄養からのおすすめ」：毎日食べる物の栄養（食事タブの1日）が目標から外れている項目を出し、選ぶと同じ形で表示
// 在庫に追加する時は、成分表の栄養データも一緒に入れる（毎日食べる量は在庫画面で設定）
import { watch } from '../ui/live.js';
import { toast } from '../ui/toast.js';
import * as contentJa from '../content/healthRecommendations.js';
import * as contentEn from '../content/healthRecommendations.en.js';
import { listCategories } from '../data/categoryRepo.js';
import { listItems, addManualItem } from '../data/shoppingRepo.js';
import { listProducts, createProduct } from '../data/productRepo.js';
import { loadFoods } from '../data/foodDb.js';
import { nameKey } from '../domain/product.js';
import { listGroups } from '../data/groupRepo.js';
import { getMeta, META } from '../data/metaRepo.js';
import { combineConsumption } from '../domain/groups.js';
import { isDaily } from '../domain/consumption.js';
import { sumNutrients, targetsFor, evaluate, SHOWN_NUTRIENTS, NUTRIENTS } from '../domain/nutrition.js';
import { openProfileSheet } from './profileSheet.js';
import { esc } from '../lib/util.js';
import { t, lang } from '../lib/i18n.js';

/** 表示する言語の提案データ（英語の時は英語版。食材の番号・売り場のカテゴリ名は同じ） */
function content() {
  return lang === 'en' ? contentEn : contentJa;
}
const { HEALTH_RECOMMENDATIONS, HEALTH_DISCLAIMER, NUTRIENT_ADVICE } = content();

/** 選んでいる提案（気になること、または「栄養素-low/high」） */
function findRec(id) {
  return HEALTH_RECOMMENDATIONS.find((r) => r.id === id) ?? (NUTRIENT_ADVICE[id] ? { id, ...NUTRIENT_ADVICE[id] } : null);
}

export const title = '食材の提案';

/** 選んでいる悩み（画面を離れても覚えておく） */
let selectedId = null;

const COST_LABEL = { low: '安い', mid: 'ふつう' };

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section id="nutri-advice"></section>
      <section>
        <h2 class="section-title">${t('気になること')}</h2>
        <div class="concern-grid" role="radiogroup">
          ${HEALTH_RECOMMENDATIONS.map(
            (r) => `<button type="button" class="concern" role="radio" data-concern="${r.id}">${esc(r.concern)}</button>`
          ).join('')}
        </div>
      </section>
      <div id="recommendation" class="stack"></div>
      <p class="note disclaimer">${esc(HEALTH_DISCLAIMER)}</p>
    </div>
  `;
  const recEl = el.querySelector('#recommendation');
  const adviceEl = el.querySelector('#nutri-advice');
  /** 栄養の状態：null＝計算できない理由、配列＝目標から外れている項目 */
  let nutriState = null;
  let categories = [];
  let inList = new Set();
  let inStock = new Set();

  function render() {
    renderAdvice();
    el.querySelectorAll('[data-concern]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.concern === selectedId))
    );
    const rec = findRec(selectedId);
    if (!rec) {
      recEl.innerHTML = '';
      return;
    }
    recEl.innerHTML = `
      <section class="card">
        <div class="chips" style="margin-top:0">${rec.nutrients.map((n) => `<span class="badge badge-muted">${esc(n)}</span>`).join('')}</div>
        <details class="more-nutri"><summary>${t('考え方')}</summary><p style="margin-top:6px">${esc(rec.explanation)}</p></details>
      </section>

      <section>
        <h2 class="section-title">${t('おすすめ食材')}</h2>
        <ul class="list">
          ${rec.foods
            .map((f, i) => {
              const added = inList.has(nameKey(f.name));
              const stocked = inStock.has(nameKey(f.name));
              return `<li class="food-row">
                <span class="grow">
                  <span class="item-name item-name-sm">${esc(f.name)}</span>
                  <span class="badge ${f.cost === 'low' ? '' : 'badge-muted'}" style="margin-left:6px">${t(COST_LABEL[f.cost])}</span>
                  <span class="note" style="display:block;margin-top:2px">${t('{point}／{howTo}', { point: esc(f.point), howTo: esc(f.howTo) })}</span>
                </span>
                <span class="food-actions">
                  <button type="button" class="icon-btn add-food" data-food="${i}" ${added ? 'disabled' : ''}>${added ? t('リスト済') : t('＋リスト')}</button>
                  <button type="button" class="icon-btn add-food" data-stock="${i}" ${stocked ? 'disabled' : ''}>${stocked ? t('在庫済') : t('＋在庫')}</button>
                </span>
              </li>`;
            })
            .join('')}
        </ul>
      </section>

      <details class="card more-nutri">
        <summary>${t('手軽な取り入れ方')}</summary>
        <ul class="tips" style="margin-top:6px">${rec.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </details>
    `;
  }

  /** 栄養からのおすすめ（気になることの上） */
  function renderAdvice() {
    let inner;
    if (!nutriState) {
      inner = '';
    } else if (nutriState.reason === 'no-profile') {
      inner = `<p class="note">${t('からだの情報を設定すると、毎日食べる物の栄養からおすすめを出します。')}</p>
        <button type="button" class="chip-btn" data-act="profile" style="margin-top:6px">${t('からだの情報')}</button>`;
    } else if (nutriState.reason === 'no-daily') {
      inner = `<p class="note">${t('食事タブで毎日食べる物を登録すると、栄養からおすすめを出します。')}</p>`;
    } else if (!nutriState.off.length) {
      inner = `<p class="note">${t('エネルギー・たんぱく質・脂質・炭水化物は目標の範囲です。')}</p>`;
    } else {
      inner = `<div class="advice-list">${nutriState.off
        .map(
          (o) => `<button type="button" class="advice-btn" data-concern="${o.id}" role="radio">
            <span>${esc(findRec(o.id).concern)}</span><span class="note">${esc(t('目標の{pct}%', { pct: o.pct }))}</span></button>`
        )
        .join('')}</div>`;
    }
    adviceEl.innerHTML = inner ? `<h2 class="section-title">${t('栄養からのおすすめ')}</h2>${inner}` : '';
  }

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-act="profile"]')) {
      openProfileSheet();
      return;
    }
    const c = e.target.closest('[data-concern]');
    if (c) {
      selectedId = c.dataset.concern;
      render();
      recEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const toStock = e.target.closest('[data-stock]');
    if (toStock) {
      const rec = findRec(selectedId);
      await addToStock(rec.foods[Number(toStock.dataset.stock)]);
      return;
    }
    const add = e.target.closest('[data-food]');
    if (add) {
      const rec = findRec(selectedId);
      const food = rec.foods[Number(add.dataset.food)];
      const cat = findCategory(food.category);
      const r = await addManualItem({
        name: food.name,
        quantity: 1,
        unit: food.unit,
        categoryId: cat?.id ?? null,
        source: 'health',
      });
      toast(
        r.status === 'exists'
          ? t('「{name}」はすでにリストにあります', { name: r.item.name })
          : t('「{name}」をリストに追加しました', { name: food.name })
      );
    }
  });

  /**
   * 売り場のカテゴリを探す。名前が一致しなければ「・」区切りの一部で探す
   * （「野菜」⇔「野菜・果物」のように、カテゴリ名を変えた場合にも合うように）
   */
  function findCategory(name) {
    const parts = name.split('・'); // i18n-ignore（カテゴリ名の区切り。表示しない）
    return (
      categories.find((x) => x.name === name) ??
      categories.find((x) => x.name.split('・').some((n) => parts.includes(n))) ?? // i18n-ignore
      null
    );
  }

  /** 在庫（商品マスタ）に追加。成分表の栄養データも入れる */
  async function addToStock(food) {
    const cat = findCategory(food.category) ?? categories.find((c) => c.name === 'その他') ?? categories[0];
    let nutrition = null;
    try {
      const f = (await loadFoods()).foods.find((x) => x.code === food.code);
      if (f) nutrition = { source: 'mext', code: f.code, name: f.name, per100g: f.per100g };
    } catch {
      /* 成分表が読めなくても在庫には追加する */
    }
    try {
      await createProduct({
        name: food.name,
        categoryId: cat?.id,
        inventoryUnit: food.unit,
        currentStock: 0,
        targetStock: 1,
        nutrition,
      });
      toast(t('「{name}」を在庫に追加しました', { name: food.name }));
    } catch (err) {
      toast(err.errors?.name ? t(err.errors.name) : t('追加できませんでした'));
    }
  }

  render();

  // 買い物リスト・在庫が変わったら「リスト済」「在庫済」の表示を更新する
  // 毎日食べる物・からだの情報が変わったら「栄養からのおすすめ」も更新する
  return watch(
    () => Promise.all([listCategories(), listItems(), listProducts(), listGroups(), getMeta(META.profile)]),
    ([cats, items, products, groups, profile]) => {
      categories = cats;
      inList = new Set(items.map((i) => nameKey(i.name)));
      inStock = new Set(products.map((p) => nameKey(p.name)));
      nutriState = nutritionOff(products, groups, profile);
      render();
    }
  );
}

/**
 * 1日の栄養が目標から外れている項目（エネルギー・たんぱく質・脂質・炭水化物）。食事タブと同じ計算
 * @returns {{reason:'no-profile'|'no-daily'} | {off:Array<{id:string, pct:number}>}}
 */
function nutritionOff(products, groups, profile) {
  const targets = targetsFor(profile);
  if (!targets) return { reason: 'no-profile' };
  const daily = combineConsumption(products, groups).products.filter(isDaily);
  if (!daily.length) return { reason: 'no-daily' };
  const sum = sumNutrients(daily, null);
  const off = [];
  for (const key of SHOWN_NUTRIENTS) {
    if (!NUTRIENTS.some((n) => n.key === key) || !targets[key]) continue;
    const ev = evaluate(sum.totals[key], targets[key]);
    if (ev.status === 'ok') continue;
    // 少ない時は下限、多い時は上限に対して何%か
    const tg = targets[key];
    const base = ev.status === 'low' ? (tg.low ?? tg.value) : (tg.high ?? tg.upper ?? tg.value * 1.1);
    off.push({ id: `${key}-${ev.status}`, pct: Math.round((sum.totals[key] / base) * 100) });
  }
  return { off };
}
