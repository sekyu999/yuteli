// ② 在庫・商品管理
// ・カテゴリ別に商品を表示し、± で現在庫をその場で変える
// ・🛒ボタンでその商品を買い物リストへ入れる
// ・商品名をタップすると編集シート、右下の「＋ 商品」で登録シート
import { watch } from '../ui/live.js';
import { toast } from '../ui/toast.js';
import { listCategories } from '../data/categoryRepo.js';
import { listProducts, changeStock, clearAllSuppression } from '../data/productRepo.js';
import { refreshFromStock, listItems, addProductToList, removeProductFromList } from '../data/shoppingRepo.js';
import { shortage } from '../domain/product.js';
import { formatStock } from '../domain/consumption.js';
import { openProductSheet } from './productSheet.js';
import { esc } from '../lib/util.js';

export const title = '在庫';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div id="stock-groups" class="stack"></div>
      <div id="review-done" hidden>
        <button type="button" class="btn btn-primary btn-block" data-action="review-done">見直し完了 → 買い物リストを更新</button>
      </div>
    </div>
    <button type="button" class="fab" data-action="add">＋ 商品</button>
  `;
  const groupsEl = el.querySelector('#stock-groups');
  const reviewEl = el.querySelector('#review-done');
  let inList = new Set();

  el.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const id = target.dataset.id;
    switch (target.dataset.action) {
      case 'add':
        openProductSheet();
        break;
      case 'edit':
        openProductSheet(id);
        break;
      case 'inc':
        changeStock(id, 1);
        break;
      case 'dec':
        changeStock(id, -1);
        break;
      case 'to-list': {
        if (inList.has(id)) {
          await removeProductFromList(id);
          toast('リストから外しました');
        } else {
          const r = await addProductToList(id);
          toast(`「${r.item.name}」${r.item.quantity}${r.item.unit ?? ''}をリストに入れました`);
        }
        break;
      }
      case 'review-done':
        reviewDone();
        break;
    }
  });

  return watch(
    () => Promise.all([listCategories(), listProducts(), listItems()]),
    ([cats, products, items]) => {
      inList = new Set(items.filter((i) => i.productId).map((i) => i.productId));
      const view = products;

      reviewEl.hidden = products.length === 0;
      if (products.length === 0) {
        groupsEl.innerHTML = `
          <div class="placeholder">
            <p>まだ商品がありません。</p>
            <p>右下の「＋ 商品」から、いつも買う物を登録してください。</p>
          </div>`;
        return;
      }


      const known = new Set(cats.map((c) => c.id));
      const groups = cats
        .map((c) => ({ name: c.name, items: view.filter((p) => p.categoryId === c.id) }))
        .filter((g) => g.items.length);
      const orphans = view.filter((p) => !known.has(p.categoryId));
      if (orphans.length) groups.push({ name: '未分類', items: orphans });

      groupsEl.innerHTML = groups
        .map(
          (g) => `
          <section>
            <h2 class="section-title">${esc(g.name)}</h2>
            <ul class="list">${g.items.map((p) => rowHtml(p, inList.has(p.id))).join('')}</ul>
          </section>`
        )
        .join('');
    }
  );
}

/** 見直し完了：購入済みの印をすべて外し、リストを更新して買い物リストへ移動 */
async function reviewDone() {
  await clearAllSuppression();
  const r = await refreshFromStock();
  location.hash = '#/list';
  toast(r.added || r.updated ? `リストを更新しました（追加 ${r.added}品目）` : '足りない物はありません');
}

/** 商品1行分の HTML */
function rowHtml(p, listed) {
  const short = shortage(p);
  const unit = esc(p.inventoryUnit);
  const meta = [`<span>目標 ${p.targetStock}${unit}</span>`];
  if (short) meta.push(`<span class="badge badge-short">あと${short}${unit}</span>`);
  if (p.autoAddSuppressed) meta.push('<span class="badge badge-muted">購入済み・在庫未更新</span>');
  return `
    <li class="stock-row">
      <button type="button" class="stock-main" data-action="edit" data-id="${p.id}">
        <div class="stock-name">${esc(p.name)}</div>
        <div class="stock-meta">${meta.join('')}</div>
      </button>
      <div class="qty">
        <button type="button" class="stepper-btn" data-action="dec" data-id="${p.id}"
                aria-label="${esc(p.name)}を1減らす" ${p.currentStock <= 0 ? 'disabled' : ''}>−</button>
        <div class="qty-value" aria-label="現在庫 ${formatStock(p.currentStock)}${unit}">${formatStock(p.currentStock)}<small>${unit}</small></div>
        <button type="button" class="stepper-btn" data-action="inc" data-id="${p.id}"
                aria-label="${esc(p.name)}を1増やす">＋</button>
      </div>
      <button type="button" class="cart-btn ${listed ? 'is-listed' : ''}" data-action="to-list" data-id="${p.id}"
              aria-pressed="${listed}" aria-label="${esc(p.name)}を${listed ? '買い物リストから外す' : '買い物リストに入れる'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>${
          listed ? '<path d="M10 10.5l2 2 3.5-3.5" class="cart-check"/>' : ''
        }</svg>
        <span>${listed ? 'リスト済' : 'リストへ'}</span>
      </button>
    </li>`;
}
