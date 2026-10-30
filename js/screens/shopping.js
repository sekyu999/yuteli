// ① 買い物リスト
// ・「リストを更新」で在庫から不足品を追加
// ・お店を選ぶと、そのお店の売り場順に並ぶ
// ・左の丸をタップで購入済み（リストから消える。取り消し可）
// ・右下の「＋ 追加」で商品マスタにない物も追加できる
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { stepperField, bindSteppers, bindErrorClear, showErrors, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { db } from '../data/db.js';
import { getMeta, setMeta, META } from '../data/metaRepo.js';
import { listStores, getOrderedCategories } from '../data/storeRepo.js';
import { listProducts } from '../data/productRepo.js';
import {
  listItems,
  refreshFromStock,
  addManualItem,
  updateItem,
  markPurchased,
  undoPurchased,
  removeItem,
} from '../data/shoppingRepo.js';
import { groupByCategory } from '../domain/shelf.js';
import { shortage } from '../domain/product.js';
import { openPriceSheet } from './priceSheet.js';
import { esc } from '../lib/util.js';

export const title = '買い物リスト';

/** これ以上バックアップしていないと催促する（日） */
const BACKUP_REMIND_DAYS = 14;

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div id="backup-notice"></div>
      <div class="toolbar">
        <label for="store-select" class="toolbar-label">お店</label>
        <select id="store-select" class="select"></select>
      </div>
      <button type="button" class="btn btn-primary btn-block" data-action="refresh">リストを更新</button>
      <div id="list-groups" class="stack"></div>
    </div>
    <button type="button" class="fab" data-action="add">＋ 追加</button>
  `;
  const groupsEl = el.querySelector('#list-groups');
  const storeSelect = el.querySelector('#store-select');
  const noticeEl = el.querySelector('#backup-notice');

  let state = { items: [], categories: [], storeId: null };

  storeSelect.addEventListener('change', () => setMeta(META.selectedStoreId, storeSelect.value || null));

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const id = t.dataset.id;
    switch (t.dataset.action) {
      case 'refresh': {
        const r = await refreshFromStock();
        if (r.added || r.updated) {
          const parts = [];
          if (r.added) parts.push(`${r.added}品目を追加`);
          if (r.updated) parts.push(`${r.updated}品目の数量を更新`);
          toast(parts.join('、') + 'しました');
        } else toast('追加する商品はありません');
        break;
      }
      case 'buy':
        buy(id, state);
        break;
      case 'edit':
        openItemSheet(state.items.find((i) => i.id === id), state);
        break;
      case 'add':
        openAddSheet(state);
        break;
    }
  });

  return watch(
    async () => {
      const storeId = await getMeta(META.selectedStoreId);
      const [items, stores, categories, products, lastBackupAt] = await Promise.all([
        listItems(),
        listStores(),
        getOrderedCategories(storeId),
        listProducts(),
        getMeta(META.lastBackupAt),
        db.storeShelfOrders.count(), // 売り場順が変わった時も描き直すため
      ]);
      return { items, stores, categories, products, storeId, lastBackupAt };
    },
    ({ items, stores, categories, products, storeId, lastBackupAt }) => {
      state = { items, categories, storeId };

      // バックアップの催促
      const days = lastBackupAt ? Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86400000) : null;
      noticeEl.innerHTML =
        products.length && (days === null || days >= BACKUP_REMIND_DAYS)
          ? `<a class="notice notice-link" href="#/settings">${
              days === null ? 'まだバックアップがありません' : `最後のバックアップから${days}日たっています`
            }。設定からバックアップを保存してください ›</a>`
          : '';

      // お店の選択肢
      storeSelect.innerHTML =
        '<option value="">指定なし（標準の並び）</option>' +
        stores.map((s) => `<option value="${s.id}" ${s.id === storeId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

      if (items.length === 0) {
        groupsEl.innerHTML = `
          <div class="placeholder">
            <p>リストは空です。</p>
            <p>在庫を見直してから「リストを更新」を押すと、足りない物が入ります。</p>
          </div>`;
        return;
      }

      const productById = new Map(products.map((p) => [p.id, p]));
      const groups = groupByCategory(items, categories, (a, b) => a.name.localeCompare(b.name, 'ja'));
      groupsEl.innerHTML =
        `<p class="note">${items.length}品目</p>` +
        groups
          .map(
            (g) => `
          <section>
            <h2 class="section-title">${esc(g.name)}</h2>
            <ul class="list">${g.items.map((it) => itemRowHtml(it, productById.get(it.productId))).join('')}</ul>
          </section>`
          )
          .join('');
    }
  );
}

function itemRowHtml(it, product) {
  const badges = [];
  if (it.source === 'manual' && !it.productId) badges.push('<span class="badge badge-muted">手動</span>');
  if (it.source === 'health') badges.push('<span class="badge badge-muted">健康提案</span>');
  if (product && shortage(product) === 0) badges.push('<span class="badge">在庫は足りています</span>');
  return `
    <li class="item-row">
      <button type="button" class="check" data-action="buy" data-id="${it.id}" aria-label="${esc(it.name)}を購入済みにする"></button>
      <button type="button" class="item-main" data-action="edit" data-id="${it.id}">
        <span class="item-name">${esc(it.name)}</span>
        ${badges.length ? `<span class="stock-meta">${badges.join('')}</span>` : ''}
      </button>
      <span class="item-qty">${it.quantity}<small>${esc(it.unit ?? '')}</small></span>
    </li>`;
}

async function buy(id, state) {
  const row = document.querySelector(`.check[data-id="${id}"]`)?.closest('li');
  row?.classList.add('done');
  // チェックが付いたのが見えるよう少し待ってから消す
  await new Promise((r) => setTimeout(r, 180));
  const undo = await markPurchased(id);
  if (!undo) return;
  const actions = [];
  if (undo.item.productId) {
    actions.push({
      label: '価格を記録',
      onClick: () =>
        openPriceSheet({ productId: undo.item.productId, storeId: state.storeId ?? undefined, quantity: undo.item.quantity }),
    });
  }
  actions.push({ label: '元に戻す', onClick: () => undoPurchased(undo) });
  toast(`「${undo.item.name}」購入済み`, { actions });
}

/** リストの項目を編集するシート */
function openItemSheet(item, state) {
  if (!item) return;
  const isTemp = !item.productId;
  const body = `
    <form novalidate>
      ${stepperField({ name: 'quantity', label: '数量', value: item.quantity, suffix: item.unit ?? '' })}
      ${
        isTemp
          ? `
        <div class="field">
          <label for="f-unit">単位 <span class="optional">任意</span></label>
          <input id="f-unit" name="unit" class="input" value="${esc(item.unit ?? '')}" autocomplete="off">
        </div>
        ${categorySelect(state.categories, item.categoryId)}`
          : `<p class="note" style="margin-top:12px">「リストを更新」を押すと、数量は在庫から計算した数に戻ります。</p>`
      }
      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">保存</button>
        ${item.productId ? '<button type="button" class="btn btn-block" data-price>価格を記録</button>' : ''}
        <button type="button" class="btn-danger-text" data-remove>今回は買わない（リストから削除）</button>
      </div>
    </form>`;
  const sheet = openSheet({ title: item.name, body });
  const form = sheet.el.querySelector('form');
  bindSteppers(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    await updateItem(item.id, isTemp ? v : { quantity: v.quantity });
    sheet.close();
  });
  form.querySelector('[data-price]')?.addEventListener('click', () => {
    sheet.close();
    openPriceSheet({ productId: item.productId, storeId: state.storeId ?? undefined, quantity: item.quantity });
  });
  form.querySelector('[data-remove]').addEventListener('click', async () => {
    const undo = await removeItem(item.id);
    sheet.close();
    toast(`「${item.name}」を削除しました`, { actions: [{ label: '元に戻す', onClick: () => undoPurchased(undo) }] });
  });
}

/** 手動で追加するシート */
async function openAddSheet(state) {
  const products = await listProducts();
  const body = `
    <form novalidate>
      <div class="field">
        <label for="f-name">商品名</label>
        <input id="f-name" name="name" class="input" list="product-names" autocomplete="off" enterkeyhint="done">
        <datalist id="product-names">${products.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>
        <p class="note" style="margin-top:4px">在庫に登録した商品名なら、その商品として追加されます。それ以外は今回だけの項目です。</p>
        <p class="field-error" data-error-for="name"></p>
      </div>
      ${stepperField({ name: 'quantity', label: '数量', value: 1 })}
      <div class="field">
        <label for="f-unit">単位 <span class="optional">任意</span></label>
        <input id="f-unit" name="unit" class="input" placeholder="個、袋 など" autocomplete="off">
      </div>
      ${categorySelect(state.categories, '')}
      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">リストに追加</button>
      </div>
    </form>`;
  const sheet = openSheet({ title: 'リストに追加', body });
  const form = sheet.el.querySelector('form');
  bindSteppers(form);
  bindErrorClear(form);
  form.elements.namedItem('name').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    if (!v.name.trim()) {
      showErrors(form, { name: '商品名を入力してください' });
      return;
    }
    const r = await addManualItem({ ...v, source: 'manual' });
    if (r.status === 'exists') {
      showErrors(form, { name: `「${r.item.name}」はすでにリストにあります` });
      return;
    }
    sheet.close();
    toast(`「${r.item.name}」を追加しました`);
  });
}

function categorySelect(categories, selected) {
  return `
    <div class="field">
      <label for="f-categoryId">売り場（カテゴリ） <span class="optional">任意・並び順に使います</span></label>
      <select id="f-categoryId" name="categoryId" class="select">
        <option value="">指定なし</option>
        ${categories.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>`;
}
