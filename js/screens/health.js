// ④ 健康・食材提案
// 悩みを選ぶ → 栄養素・おすすめ食材・取り入れ方を表示 → 気に入った食材だけ手動でリストへ追加
import { watch } from '../ui/live.js';
import { toast } from '../ui/toast.js';
import { HEALTH_RECOMMENDATIONS, HEALTH_DISCLAIMER } from '../content/healthRecommendations.js';
import { listCategories } from '../data/categoryRepo.js';
import { listItems, addManualItem } from '../data/shoppingRepo.js';
import { nameKey } from '../domain/product.js';
import { esc } from '../lib/util.js';

export const title = '健康・食材';

/** 選んでいる悩み（画面を離れても覚えておく） */
let selectedId = null;

const COST_LABEL = { low: '安い', mid: 'ふつう' };

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section>
        <h2 class="section-title">気になることを選んでください</h2>
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
  let categories = [];
  let inList = new Set();

  function render() {
    el.querySelectorAll('[data-concern]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.concern === selectedId))
    );
    const rec = HEALTH_RECOMMENDATIONS.find((r) => r.id === selectedId);
    if (!rec) {
      recEl.innerHTML = '';
      return;
    }
    recEl.innerHTML = `
      <section class="card">
        <h2 class="rec-title">${esc(rec.concern)}</h2>
        <h3 class="section-title" style="margin-top:12px">関連する栄養素</h3>
        <div class="chips" style="margin-top:0">${rec.nutrients.map((n) => `<span class="badge badge-muted">${esc(n)}</span>`).join('')}</div>
        <p style="margin-top:12px">${esc(rec.explanation)}</p>
      </section>

      <section>
        <h2 class="section-title">おすすめ食材</h2>
        <ul class="list">
          ${rec.foods
            .map((f, i) => {
              const added = inList.has(nameKey(f.name));
              return `<li class="food-row">
                <span class="grow">
                  <span class="item-name" style="font-size:17px">${esc(f.name)}</span>
                  <span class="badge ${f.cost === 'low' ? '' : 'badge-muted'}" style="margin-left:6px">${COST_LABEL[f.cost]}</span>
                  <span class="note" style="display:block;margin-top:2px">${esc(f.point)}</span>
                  <span class="food-howto">食べ方：${esc(f.howTo)}</span>
                </span>
                <button type="button" class="icon-btn add-food" data-food="${i}" ${added ? 'disabled' : ''}>
                  ${added ? 'リストにあり' : '＋ リスト'}
                </button>
              </li>`;
            })
            .join('')}
        </ul>
      </section>

      <section class="card">
        <h2 class="section-title">手軽な取り入れ方</h2>
        <ul class="tips">${rec.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </section>
    `;
  }

  el.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-concern]');
    if (c) {
      selectedId = c.dataset.concern;
      render();
      recEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const add = e.target.closest('[data-food]');
    if (add) {
      const rec = HEALTH_RECOMMENDATIONS.find((r) => r.id === selectedId);
      const food = rec.foods[Number(add.dataset.food)];
      const cat = categories.find((x) => x.name === food.category);
      const r = await addManualItem({
        name: food.name,
        quantity: 1,
        unit: food.unit,
        categoryId: cat?.id ?? null,
        source: 'health',
      });
      toast(r.status === 'exists' ? `「${r.item.name}」はすでにリストにあります` : `「${food.name}」をリストに追加しました`);
    }
  });

  render();

  // 買い物リストの中身が変わったら「リストにあり」表示を更新する
  return watch(
    () => Promise.all([listCategories(), listItems()]),
    ([cats, items]) => {
      categories = cats;
      inList = new Set(items.map((i) => nameKey(i.name)));
      render();
    }
  );
}
