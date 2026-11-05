// 商品の登録・編集シート（在庫画面と食事画面から開く）
// 項目：基本（名前・カテゴリ・単位・在庫・目標）／内容量／毎日の量（朝昼晩）／栄養データ
import { openSheet } from '../ui/sheet.js';
import { stepperField, bindSteppers, bindErrorClear, clearError, showErrors, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listCategories } from '../data/categoryRepo.js';
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
import { MEALS, effectiveStock, round2, formatStock } from '../domain/consumption.js';
import { openNutritionSheet, describeNutrition } from './nutritionSheet.js';
import { esc, todayLocal } from '../lib/util.js';

/**
 * @param {string} [id] 指定すると編集、省略すると新規登録
 */
export async function openProductSheet(id) {
  const [product, categories] = await Promise.all([id ? getProduct(id) : null, listCategories()]);
  if (id && !product) return;

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
  // 在庫は「今日の在庫（自動で減った後）」を表示する
  const stockNow = product ? round2(effectiveStock(product, todayLocal())) : v.currentStock;
  let nutrition = v.nutrition ?? null;
  const c = v.consumption ?? {};
  const showNum = (n) => (n ? String(n) : '');

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
            .map((x) => `<option value="${x.id}" ${x.id === v.categoryId ? 'selected' : ''}>${esc(x.name)}</option>`)
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

      ${stepperField({ name: 'currentStock', label: '今ある数', value: stockNow, suffix: v.inventoryUnit })}
      ${stepperField({ name: 'targetStock', label: '常に置いておきたい数（目標）', value: v.targetStock, suffix: v.inventoryUnit })}

      <div class="field">
        <label for="f-packageContent">1<span data-inv-unit>${esc(v.inventoryUnit || 'つ')}</span>に入っている量 <span class="optional">任意・価格比較と毎日の量に使います</span></label>
        <div class="row">
          <input id="f-packageContent" name="packageContent" class="input grow" inputmode="decimal"
                 value="${v.packageContent ?? ''}" placeholder="例：卵10個入り→10、牛乳→1000" autocomplete="off">
          <select name="packageContentUnit" class="select" style="width:96px" aria-label="内容量の単位">
            ${INPUT_UNITS.map((u) => `<option value="${u}" ${u === (v.packageContentUnit ?? 'g') ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
        <p class="field-error" data-error-for="packageContent"></p>
      </div>

      <fieldset class="form-section">
        <legend>毎日食べる（使う）量 <span class="optional">任意</span></legend>
        <p class="note">入れると、在庫が毎日自動で減り、栄養と食費が計算されます。毎日使わない物は空欄のままにします。</p>
        <div class="meal-grid">
          ${MEALS.map(
            (m) => `<div class="meal-input">
              <label for="f-c_${m.key}">${m.label}</label>
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
        <legend>栄養データ <span class="optional">任意</span></legend>
        <div class="row" style="align-items:center">
          <span class="grow" id="nut-desc"></span>
          <button type="button" class="btn" data-nutrition>選ぶ</button>
        </div>
        <input type="hidden" name="nutrition">
        <p class="field-error" data-error-for="nutrition"></p>
        <div class="field" id="weight-field" style="margin-top:14px">
          <label for="f-gramsPerUnit">1<span data-intake-unit></span>あたりの重さ</label>
          <div class="row" style="align-items:center">
            <input id="f-gramsPerUnit" name="gramsPerUnit" class="input grow" inputmode="decimal" value="${v.gramsPerUnit ?? ''}" placeholder="例：卵Mサイズ→50" autocomplete="off">
            <span class="unit-suffix">g</span>
          </div>
          <p class="note" style="margin-top:4px">栄養の計算に使います。食べる部分の重さを入れてください（パッケージに書かれた1個・1枚の重さなど）。</p>
          <p class="field-error" data-error-for="gramsPerUnit"></p>
        </div>
      </fieldset>

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
    form.querySelectorAll('[data-inv-unit]').forEach((s) => (s.textContent = inv || 'つ'));
    form.querySelectorAll('[data-intake-unit]').forEach((s) => (s.textContent = intake));
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
      `1日 ${round2(daily)}${intake} → 在庫は1日 ${formatStock(round2(perDayStock))}${inv} ずつ減ります` +
      (target ? `（目標 ${target}${inv} でおよそ${days}日分）` : '') +
      (!content && inv && intake === inv ? '' : '');
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
