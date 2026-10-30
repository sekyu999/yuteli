// ② 在庫・商品管理
// ・カテゴリ別に商品を表示し、± で現在庫をその場で変える
// ・商品名をタップすると編集シート、右下の「＋ 商品」で登録シート
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import {
  stepperField,
  bindSteppers,
  bindErrorClear,
  clearError,
  showErrors,
  formValues,
} from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listCategories } from '../data/categoryRepo.js';
import {
  listProducts,
  getProduct,
  createProduct,
  saveProduct,
  changeStock,
  deleteProduct,
  countRelated,
  clearAllSuppression,
  ValidationError,
} from '../data/productRepo.js';
import { refreshFromStock } from '../data/shoppingRepo.js';
import { INVENTORY_UNITS, shortage } from '../domain/product.js';
import { INPUT_UNITS } from '../domain/units.js';
import { esc } from '../lib/util.js';

export const title = '在庫';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <div id="stock-summary" class="stock-summary"></div>
      <div id="stock-groups" class="stack"></div>
      <div id="review-done" hidden>
        <button type="button" class="btn btn-primary btn-block" data-action="review-done">見直し完了 → 買い物リストを更新</button>
        <p class="note" style="margin-top:6px">在庫を実物に合わせたら押してください。足りない物が買い物リストに入ります。</p>
      </div>
    </div>
    <button type="button" class="fab" data-action="add">＋ 商品</button>
  `;
  const summaryEl = el.querySelector('#stock-summary');
  const groupsEl = el.querySelector('#stock-groups');
  const reviewEl = el.querySelector('#review-done');

  /** 最新のカテゴリ一覧（シートで使う） */
  let categories = [];

  // ---- タップ操作（画面全体で1つのリスナーにまとめる） ----
  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const id = target.dataset.id;
    switch (target.dataset.action) {
      case 'add':
        openProductSheet(categories);
        break;
      case 'edit':
        openProductSheet(categories, id);
        break;
      case 'inc':
        changeStock(id, 1);
        break;
      case 'dec':
        changeStock(id, -1);
        break;
      case 'review-done':
        reviewDone();
        break;
    }
  });

  // ---- 表示（データが変わるたびに自動で呼ばれる） ----
  return watch(
    () => Promise.all([listCategories(), listProducts()]),
    ([cats, products]) => {
      categories = cats;

      reviewEl.hidden = products.length === 0;
      if (products.length === 0) {
        summaryEl.innerHTML = '';
        groupsEl.innerHTML = `
          <div class="placeholder">
            <p>まだ商品がありません。</p>
            <p>右下の「＋ 商品」から、いつも買う物を登録してください。</p>
          </div>`;
        return;
      }

      const shortCount = products.filter((p) => shortage(p) > 0).length;
      summaryEl.innerHTML = `
        <span class="badge badge-muted">${products.length} 品目</span>
        ${shortCount ? `<span class="badge badge-short">不足 ${shortCount} 品目</span>` : '<span class="badge">不足なし</span>'}
      `;

      // カテゴリ順にまとめる。カテゴリが消えた商品は「未分類」へ
      const known = new Set(cats.map((c) => c.id));
      const groups = cats
        .map((c) => ({ name: c.name, items: products.filter((p) => p.categoryId === c.id) }))
        .filter((g) => g.items.length);
      const orphans = products.filter((p) => !known.has(p.categoryId));
      if (orphans.length) groups.push({ name: '未分類', items: orphans });

      groupsEl.innerHTML = groups
        .map(
          (g) => `
          <section>
            <h2 class="section-title">${esc(g.name)}</h2>
            <ul class="list">${g.items.map(rowHtml).join('')}</ul>
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
function rowHtml(p) {
  const short = shortage(p);
  const unit = esc(p.inventoryUnit);
  return `
    <li class="stock-row">
      <button type="button" class="stock-main" data-action="edit" data-id="${p.id}">
        <div class="stock-name">${esc(p.name)}</div>
        <div class="stock-meta">
          <span>目標 ${p.targetStock}${unit}</span>
          ${short ? `<span class="badge badge-short">あと${short}${unit}</span>` : ''}
          ${p.autoAddSuppressed ? '<span class="badge badge-muted">購入済み・在庫未更新</span>' : ''}
        </div>
      </button>
      <div class="qty">
        <button type="button" class="stepper-btn" data-action="dec" data-id="${p.id}"
                aria-label="${esc(p.name)}を1減らす" ${p.currentStock <= 0 ? 'disabled' : ''}>−</button>
        <div class="qty-value" aria-label="現在庫 ${p.currentStock}${unit}">${p.currentStock}<small>${unit}</small></div>
        <button type="button" class="stepper-btn" data-action="inc" data-id="${p.id}"
                aria-label="${esc(p.name)}を1増やす">＋</button>
      </div>
    </li>`;
}

/**
 * 商品の登録・編集シートを開く。
 * @param {Array} categories
 * @param {string} [id] 指定すると編集、省略すると新規登録
 */
async function openProductSheet(categories, id) {
  const product = id ? await getProduct(id) : null;
  if (id && !product) return;

  const v = product ?? {
    name: '',
    categoryId: '',
    inventoryUnit: '',
    currentStock: 0,
    targetStock: 1,
    packageContent: null,
    packageContentUnit: 'g',
  };

  const body = `
    <form novalidate>
      <div class="field">
        <label for="f-name">商品名</label>
        <input id="f-name" name="name" class="input" value="${esc(v.name)}" autocomplete="off" enterkeyhint="next">
        <p class="field-error" data-error-for="name"></p>
      </div>

      <div class="field">
        <label for="f-categoryId">カテゴリ</label>
        <select id="f-categoryId" name="categoryId" class="select">
          <option value="">選んでください</option>
          ${categories
            .map((c) => `<option value="${c.id}" ${c.id === v.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`)
            .join('')}
        </select>
        <p class="field-error" data-error-for="categoryId"></p>
      </div>

      <div class="field">
        <label for="f-inventoryUnit">数える単位</label>
        <input id="f-inventoryUnit" name="inventoryUnit" class="input" value="${esc(v.inventoryUnit)}"
               placeholder="パック、本 など" autocomplete="off">
        <div class="chips">
          ${INVENTORY_UNITS.map((u) => `<button type="button" class="chip" data-unit="${esc(u)}">${esc(u)}</button>`).join('')}
        </div>
        <p class="field-error" data-error-for="inventoryUnit"></p>
      </div>

      ${stepperField({ name: 'currentStock', label: '今ある数', value: v.currentStock, suffix: v.inventoryUnit })}
      ${stepperField({ name: 'targetStock', label: '常に置いておきたい数（目標）', value: v.targetStock, suffix: v.inventoryUnit })}

      <div class="field">
        <label for="f-packageContent">1つあたりの内容量 <span class="optional">任意・価格比較に使います</span></label>
        <div class="row">
          <input id="f-packageContent" name="packageContent" class="input grow" inputmode="decimal"
                 value="${v.packageContent ?? ''}" placeholder="例：1000" autocomplete="off">
          <select name="packageContentUnit" class="select" style="width:96px" aria-label="内容量の単位">
            ${INPUT_UNITS.map(
              (u) => `<option value="${u}" ${u === (v.packageContentUnit ?? 'g') ? 'selected' : ''}>${u}</option>`
            ).join('')}
          </select>
        </div>
        <p class="field-error" data-error-for="packageContent"></p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">${product ? '保存' : '登録'}</button>
        ${product ? '<button type="button" class="btn-danger-text" data-delete>この商品を削除</button>' : ''}
      </div>
    </form>
  `;

  const sheet = openSheet({ title: product ? '商品を編集' : '商品を登録', body });
  const form = sheet.el.querySelector('form');
  bindSteppers(form);
  bindErrorClear(form);

  // 単位の候補をタップしたら入力欄に入れる。± の横の単位表示も合わせて変える
  const unitInput = form.elements.namedItem('inventoryUnit');
  const syncSuffix = () =>
    form.querySelectorAll('.stepper-suffix').forEach((s) => (s.textContent = unitInput.value));
  form.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-unit]');
    if (!chip) return;
    unitInput.value = chip.dataset.unit;
    syncSuffix();
    clearError(form, 'inventoryUnit');
  });
  unitInput.addEventListener('input', syncSuffix);

  if (!product) form.elements.namedItem('name').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = formValues(form);
    try {
      if (product) await saveProduct(product.id, values);
      else await createProduct(values);
      sheet.close();
      toast(product ? '保存しました' : `「${values.name.trim()}」を登録しました`);
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else {
        console.error(err);
        toast('保存できませんでした');
      }
    }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const rel = await countRelated(product.id);
    const extra = [];
    if (rel.listItems) extra.push(`買い物リストの項目 ${rel.listItems}件`);
    if (rel.priceRecords) extra.push(`価格の記録 ${rel.priceRecords}件`);
    const msg =
      `「${product.name}」を削除しますか？` +
      (extra.length ? `\n${extra.join('、')}も一緒に削除されます。` : '') +
      '\nこの操作は取り消せません。';
    if (!window.confirm(msg)) return;
    await deleteProduct(product.id);
    sheet.close();
    toast('削除しました');
  });
}
