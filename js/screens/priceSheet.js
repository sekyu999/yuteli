// 価格を記録するシート（買い物リスト・価格画面の両方から開く）
import { openSheet } from '../ui/sheet.js';
import { stepperField, bindSteppers, bindErrorClear, showErrors, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listProducts, getProduct, ValidationError } from '../data/productRepo.js';
import { listStores } from '../data/storeRepo.js';
import { addPriceRecord, latestFor } from '../data/priceRepo.js';
import { INPUT_UNITS } from '../domain/units.js';
import { esc, todayLocal } from '../lib/util.js';

/**
 * @param {{ productId?: string, storeId?: string, quantity?: number }} [preset]
 */
export async function openPriceSheet(preset = {}) {
  const [products, stores] = await Promise.all([listProducts(), listStores()]);

  if (stores.length === 0) {
    toast('先に「価格」タブの「店舗」で店舗を登録してください');
    return;
  }
  if (products.length === 0) {
    toast('先に「在庫」タブで商品を登録してください');
    return;
  }

  const productId = preset.productId ?? '';
  const storeId = preset.storeId ?? stores[0].id;
  const product = productId ? await getProduct(productId) : null;

  const body = `
    <form novalidate>
      <div class="field">
        <label for="f-productId">商品</label>
        <select id="f-productId" name="productId" class="select" ${product ? 'disabled' : ''}>
          <option value="">選んでください</option>
          ${products.map((p) => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        ${product ? `<input type="hidden" name="productId" value="${product.id}">` : ''}
        <p class="field-error" data-error-for="productId"></p>
      </div>

      <div class="field">
        <label for="f-storeId">店舗</label>
        <select id="f-storeId" name="storeId" class="select">
          ${stores.map((s) => `<option value="${s.id}" ${s.id === storeId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <p class="field-error" data-error-for="storeId"></p>
      </div>

      <div class="field">
        <label for="f-price">支払った金額（税込・合計）</label>
        <div class="row" style="align-items:center">
          <input id="f-price" name="price" class="input grow" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="例：228">
          <span>円</span>
        </div>
        <p class="field-error" data-error-for="price"></p>
      </div>

      ${stepperField({ name: 'quantity', label: '買った数', value: preset.quantity ?? 1, suffix: product?.inventoryUnit ?? '' })}

      <div class="field">
        <label for="f-packageContent">1つあたりの内容量 <span class="optional">任意</span></label>
        <div class="row">
          <input id="f-packageContent" name="packageContent" class="input grow" inputmode="decimal" autocomplete="off">
          <select name="packageContentUnit" class="select" style="width:96px" aria-label="内容量の単位">
            ${INPUT_UNITS.map((u) => `<option value="${u}">${u}</option>`).join('')}
          </select>
        </div>
        <p class="note" style="margin-top:4px">店舗によって容量が違う時は、ここを正しく入れると実質の安さで比べられます。</p>
        <p class="field-error" data-error-for="packageContent"></p>
      </div>

      <div class="field">
        <label for="f-purchasedAt">購入日</label>
        <input id="f-purchasedAt" name="purchasedAt" type="date" class="input" value="${todayLocal()}" max="${todayLocal()}">
        <p class="field-error" data-error-for="purchasedAt"></p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">記録する</button>
      </div>
    </form>
  `;

  const sheet = openSheet({ title: product ? `${product.name}の価格を記録` : '価格を記録', body });
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
    if (qtySuffix) qtySuffix.textContent = p?.inventoryUnit ?? '';
    const priceInput = form.elements.namedItem('price');
    priceInput.placeholder = last ? `前回 ${last.price}円（${last.quantity}${p?.inventoryUnit ?? ''}）` : '例：228';
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'productId' || e.target.name === 'storeId') fillDefaults();
  });
  fillDefaults();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await addPriceRecord(formValues(form));
      sheet.close();
      toast('価格を記録しました');
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else {
        console.error(err);
        toast('記録できませんでした');
      }
    }
  });
}
