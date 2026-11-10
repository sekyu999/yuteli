// 価格を記録するシート（買い物リスト・価格画面の両方から開く）
import { openSheet } from '../ui/sheet.js';
import { stepperField, bindSteppers, bindErrorClear, showErrors, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listProducts, getProduct, ValidationError } from '../data/productRepo.js';
import { listStores } from '../data/storeRepo.js';
import { addPriceRecord, latestFor, getPriceRecord, updatePriceRecord } from '../data/priceRepo.js';
import { INPUT_UNITS } from '../domain/units.js';
import { esc, todayLocal } from '../lib/util.js';
import { t, money } from '../lib/i18n.js';

/**
 * 価格の記録シート。recordId を渡すと、その記録を直すシートになる
 * @param {{ productId?: string, storeId?: string, quantity?: number, recordId?: string }} [preset]
 */
export async function openPriceSheet(preset = {}) {
  const [products, stores, editing] = await Promise.all([
    listProducts(),
    listStores(),
    preset.recordId ? getPriceRecord(preset.recordId) : null,
  ]);
  if (preset.recordId && !editing) return;
  if (editing) preset = { ...preset, productId: editing.productId, storeId: editing.storeId, quantity: editing.quantity };

  if (stores.length === 0) {
    toast(t('先に「価格」タブの「店舗」で店舗を登録してください'));
    return;
  }
  if (products.length === 0) {
    toast(t('先に「在庫」タブで商品を登録してください'));
    return;
  }

  const productId = preset.productId ?? '';
  const storeId = preset.storeId ?? stores[0].id;
  const product = productId ? await getProduct(productId) : null;

  const body = `
    <form novalidate>
      <div class="field">
        <label for="f-productId">${t('商品')}</label>
        <select id="f-productId" name="productId" class="select" ${product ? 'disabled' : ''}>
          <option value="">${t('選んでください')}</option>
          ${products.map((p) => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        ${product ? `<input type="hidden" name="productId" value="${product.id}">` : ''}
        <p class="field-error" data-error-for="productId"></p>
      </div>

      <div class="field">
        <label for="f-storeId">${t('店舗')}</label>
        <select id="f-storeId" name="storeId" class="select">
          ${stores.map((s) => `<option value="${s.id}" ${s.id === storeId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          ${
            // 店舗を削除した後の記録を直す場合は、元の店舗のままにできるようにする
            editing && !stores.some((s) => s.id === storeId) ? `<option value="${esc(storeId)}" selected>${t('削除された店舗')}</option>` : ''
          }
        </select>
        <p class="field-error" data-error-for="storeId"></p>
      </div>

      <div class="field">
        <label for="f-price">${t('支払った金額（税込・合計）')}</label>
        <div class="row" style="align-items:center">
          <input id="f-price" name="price" class="input grow" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="${t('例：228')}" value="${editing ? editing.price : ''}">
          <span>${t('円')}</span>
        </div>
        <p class="field-error" data-error-for="price"></p>
      </div>

      ${stepperField({ name: 'quantity', label: t('買った数'), value: preset.quantity ?? 1, suffix: product ? t(product.inventoryUnit) : '' })}

      <div class="field">
        <label for="f-packageContent">${t('1つあたりの内容量')} <span class="optional">${t('任意')}</span></label>
        <div class="row">
          <input id="f-packageContent" name="packageContent" class="input grow" inputmode="decimal" autocomplete="off" value="${esc(editing?.packageContent ?? '')}">
          <select name="packageContentUnit" class="select" style="width:96px" aria-label="${t('内容量の単位')}">
            ${INPUT_UNITS.map((u) => `<option value="${u}" ${editing?.packageContentUnit === u ? 'selected' : ''}>${esc(t(u))}</option>`).join('')}
          </select>
        </div>
        <p class="field-error" data-error-for="packageContent"></p>
      </div>

      <div class="field">
        <label for="f-purchasedAt">${t('購入日')}</label>
        <input id="f-purchasedAt" name="purchasedAt" type="date" class="input" value="${editing ? editing.purchasedAt : todayLocal()}" max="${todayLocal()}">
        <p class="field-error" data-error-for="purchasedAt"></p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">${editing ? t('保存') : t('記録する')}</button>
      </div>
    </form>
  `;

  const title = editing
    ? t('{name}の価格を直す', { name: product?.name ?? '' })
    : product
      ? t('{name}の価格を記録', { name: product.name })
      : t('価格を記録');
  const sheet = openSheet({ title, body });
  const form = sheet.el.querySelector('form');
  bindSteppers(form);
  bindErrorClear(form);

  const contentInput = form.elements.namedItem('packageContent');
  const contentUnit = form.elements.namedItem('packageContentUnit');
  const qtySuffix = form.querySelector('.stepper-suffix');

  // 内容量の初期値：同じ店舗の前回の記録 → 商品マスタの内容量 の順で入れる
  async function fillDefaults() {
    const pid = form.elements.namedItem('productId').value;
    const sid = form.elements.namedItem('storeId').value;
    if (!pid) return;
    const [p, last] = await Promise.all([getProduct(pid), sid ? latestFor(pid, sid) : null]);
    const src = last?.packageContent ? last : p;
    contentInput.value = src?.packageContent ?? '';
    contentUnit.value = src?.packageContentUnit ?? 'g';
    if (qtySuffix) qtySuffix.textContent = p ? t(p.inventoryUnit) : '';
    const priceInput = form.elements.namedItem('price');
    priceInput.placeholder = last
      ? t('前回 {price}（{qty}{unit}）', { price: money(last.price), qty: last.quantity, unit: p ? t(p.inventoryUnit) : '' })
      : t('例：228');
  }
  form.addEventListener('change', (e) => {
    // 直す時は入力済みの値を上書きしない
    if (!editing && (e.target.name === 'productId' || e.target.name === 'storeId')) fillDefaults();
  });
  if (!editing) fillDefaults();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updatePriceRecord(editing.id, formValues(form));
        sheet.close();
        toast(t('価格を直しました'));
        return;
      }
      await addPriceRecord(formValues(form));
      sheet.close();
      toast(t('価格を記録しました'));
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else {
        console.error(err);
        toast(t('記録できませんでした'));
      }
    }
  });
}
