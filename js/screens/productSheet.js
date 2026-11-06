// 商品の登録・編集シート（在庫画面と食事画面から開く）
// 項目：基本（名前・カテゴリ・単位・在庫・目標）／内容量／毎日の量（朝昼晩）／栄養データ
import { openSheet } from '../ui/sheet.js';
import { stepperField, bindSteppers, bindErrorClear, clearError, showErrors, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listCategories } from '../data/categoryRepo.js';
import { listGroups } from '../data/groupRepo.js';
import {
  getProduct,
  createProduct,
  saveProduct,
  deleteProduct,
  countRelated,
  ValidationError,
} from '../data/productRepo.js';
import { INVENTORY_UNITS } from '../domain/product.js';
import { INPUT_UNITS, normalizeContent } from '../domain/units.js';
import { MEALS, round2, formatStock } from '../domain/consumption.js';
import { openNutritionSheet, describeNutrition } from './nutritionSheet.js';
import { esc } from '../lib/util.js';
import { t } from '../lib/i18n.js';

/**
 * @param {string} [id] 指定すると編集、省略すると新規登録
 */
export async function openProductSheet(id) {
  const [product, categories, groups] = await Promise.all([id ? getProduct(id) : null, listCategories(), listGroups()]);
  if (id && !product) return;
  const myGroups = product ? groups.filter((g) => g.members.some((m) => m.productId === product.id)) : [];
  const groupNote = myGroups.length
    ? `<p class="note">${t('グループ「{names}」の分も足して計算します。', { names: myGroups.map((g) => esc(g.name)).join(t('」「')) })}</p>`
    : '';

  const v = product ?? {
    name: '',
    categoryId: '',
    inventoryUnit: '',
    currentStock: 0,
    targetStock: 1,
    packageContent: null,
    packageContentUnit: 'g',
    consumption: { breakfast: 0, lunch: 0, dinner: 0 },
    gramsPerUnit: null,
    nutrition: null,
  };
  const stockNow = v.currentStock;
  let nutrition = v.nutrition ?? null;
  const c = v.consumption ?? {};
  const showNum = (n) => (n ? String(n) : '');

  const body = `
    <form novalidate>
      <div class="field">
        <label for="f-name">${t('商品名')}</label>
        <input id="f-name" name="name" class="input" value="${esc(v.name)}" autocomplete="off" enterkeyhint="next">
        <p class="field-error" data-error-for="name"></p>
      </div>

      <div class="field">
        <label for="f-categoryId">${t('カテゴリ')}</label>
        <select id="f-categoryId" name="categoryId" class="select">
          <option value="">${t('選んでください')}</option>
          ${categories
            .map((x) => `<option value="${x.id}" ${x.id === v.categoryId ? 'selected' : ''}>${esc(t(x.name))}</option>`)
            .join('')}
        </select>
        <p class="field-error" data-error-for="categoryId"></p>
      </div>

      <div class="field">
        <label for="f-inventoryUnit">${t('数える単位')}</label>
        <input id="f-inventoryUnit" name="inventoryUnit" class="input" value="${esc(v.inventoryUnit)}"
               placeholder="${t('パック、本 など')}" autocomplete="off">
        <div class="chips">
          ${INVENTORY_UNITS.map((u) => `<button type="button" class="chip" data-unit="${esc(t(u))}">${esc(t(u))}</button>`).join('')}
        </div>
        <p class="field-error" data-error-for="inventoryUnit"></p>
      </div>

      ${stepperField({ name: 'currentStock', label: t('今ある数'), value: stockNow, suffix: v.inventoryUnit })}
      ${stepperField({ name: 'targetStock', label: t('常に置いておきたい数（目標）'), value: v.targetStock, suffix: v.inventoryUnit })}

      <div class="field">
        <label for="f-packageContent">${t('1{unit}に入っている量', { unit: `<span data-inv-unit>${esc(v.inventoryUnit || t('つ'))}</span>` })} <span class="optional">${t('任意')}</span></label>
        <div class="row">
          <input id="f-packageContent" name="packageContent" class="input grow" inputmode="decimal"
                 value="${v.packageContent ?? ''}" placeholder="${t('例：卵10個入り→10、牛乳→1000')}" autocomplete="off">
          <select name="packageContentUnit" class="select" style="width:96px" aria-label="${t('内容量の単位')}">
            ${INPUT_UNITS.map((u) => `<option value="${u}" ${u === (v.packageContentUnit ?? 'g') ? 'selected' : ''}>${t(u)}</option>`).join('')}
          </select>
        </div>
        <p class="field-error" data-error-for="packageContent"></p>
      </div>

      <fieldset class="form-section">
        <legend>${t('毎日食べる量')} <span class="optional">${t('任意')}</span></legend>
        ${groupNote}
        <div class="meal-grid">
          ${MEALS.map(
            (m) => `<div class="meal-input">
              <label for="f-c_${m.key}">${t(m.label)}</label>
              <div class="row" style="align-items:center">
                <input id="f-c_${m.key}" name="c_${m.key}" class="input" inputmode="decimal" value="${showNum(c[m.key])}" placeholder="0" autocomplete="off">
                <span class="unit-suffix" data-intake-unit></span>
              </div>
              <p class="field-error" data-error-for="c_${m.key}"></p>
            </div>`
          ).join('')}
        </div>
        <p class="note" id="daily-hint" style="margin-top:8px"></p>
      </fieldset>

      <fieldset class="form-section">
        <legend>${t('栄養データ')} <span class="optional">${t('任意')}</span></legend>
        <div class="row" style="align-items:center">
          <span class="grow" id="nut-desc"></span>
          <button type="button" class="btn" data-nutrition>${t('選ぶ')}</button>
        </div>
        <input type="hidden" name="nutrition">
        <p class="field-error" data-error-for="nutrition"></p>
        <div class="field" id="weight-field" style="margin-top:14px">
          <label for="f-gramsPerUnit">${t('1{unit}あたりの重さ', { unit: '<span data-intake-unit></span>' })}</label>
          <div class="row" style="align-items:center">
            <input id="f-gramsPerUnit" name="gramsPerUnit" class="input grow" inputmode="decimal" value="${v.gramsPerUnit ?? ''}" placeholder="${t('例：卵Mサイズ→50')}" autocomplete="off">
            <span class="unit-suffix">g</span>
          </div>
          <p class="field-error" data-error-for="gramsPerUnit"></p>
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">${t(product ? '保存' : '登録')}</button>
        ${product ? `<button type="button" class="btn-danger-text" data-delete>${t('この商品を削除')}</button>` : ''}
      </div>
    </form>
  `;

  const sheet = openSheet({ title: t(product ? '商品を編集' : '商品を登録'), body });
  const form = sheet.el.querySelector('form');
  bindSteppers(form);
  bindErrorClear(form);

  const el = (n) => form.elements.namedItem(n);
  const nutInput = el('nutrition');
  const nutDesc = form.querySelector('#nut-desc');
  const setNutrition = (n) => {
    nutrition = n;
    nutInput.value = n ? JSON.stringify(n) : '';
    nutDesc.textContent = describeNutrition(n);
    nutDesc.classList.toggle('note', !n);
    sync();
  };

  /** 単位の表示・ヒントを入力に合わせて更新 */
  function sync() {
    const inv = el('inventoryUnit').value.trim();
    const contentText = el('packageContent').value.trim();
    const content = contentText ? normalizeContent(Number(contentText), el('packageContentUnit').value) : null;
    const intake = content ? content.unit : inv || '個';
    form.querySelectorAll('.stepper-suffix').forEach((s) => (s.textContent = inv));
    form.querySelectorAll('[data-inv-unit]').forEach((s) => (s.textContent = inv || t('つ')));
    form.querySelectorAll('[data-intake-unit]').forEach((s) => (s.textContent = t(intake)));
    // 重さの欄は、個・パックなどで量を入れる場合に必要
    form.querySelector('#weight-field').hidden = intake === 'g' || intake === 'ml';

    const daily = MEALS.reduce((s, m) => s + (Number(el(`c_${m.key}`).value) || 0), 0);
    const hint = form.querySelector('#daily-hint');
    if (!daily) {
      hint.textContent = '';
      return;
    }
    const perDayStock = content ? daily / content.amount : daily;
    const target = Number(el('targetStock').value) || 0;
    const days = perDayStock ? Math.floor(target / perDayStock + 1e-9) : 0;
    hint.textContent =
      t('1日 {amount}{unit}（{stock}{inv}）', {
        amount: round2(daily),
        unit: t(intake),
        stock: formatStock(round2(perDayStock)),
        inv,
      }) + (target ? t('・目標 {target}{inv} で約{days}日分', { target, inv, days }) : '');
  }

  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  form.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-unit]');
    if (chip) {
      el('inventoryUnit').value = chip.dataset.unit;
      clearError(form, 'inventoryUnit');
      sync();
    }
    if (e.target.closest('[data-step]')) sync();
    if (e.target.closest('[data-nutrition]')) {
      openNutritionSheet({
        current: nutrition,
        initialQuery: nutrition?.source === 'mext' ? '' : el('name').value.trim(),
        onSelect: (n) => {
          setNutrition(n);
          clearError(form, 'nutrition');
        },
      });
    }
  });
  setNutrition(nutrition);

  if (!product) el('name').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = formValues(form);
    try {
      if (product) await saveProduct(product.id, values);
      else await createProduct(values);
      sheet.close();
      toast(product ? t('保存しました') : t('「{name}」を登録しました', { name: values.name.trim() }));
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else {
        console.error(err);
        toast(t('保存できませんでした'));
      }
    }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const rel = await countRelated(product.id);
    const extra = [];
    if (rel.listItems) extra.push(t('買い物リストの項目 {n}件', { n: rel.listItems }));
    if (rel.priceRecords) extra.push(t('価格の記録 {n}件', { n: rel.priceRecords }));
    const msg =
      t('「{name}」を削除しますか？', { name: product.name }) +
      (extra.length ? '\n' + t('{items}も一緒に削除されます。', { items: extra.join(t('、')) }) : '') +
      '\n' +
      t('この操作は取り消せません。');
    if (!window.confirm(msg)) return;
    await deleteProduct(product.id);
    sheet.close();
    toast(t('削除しました'));
  });
}
