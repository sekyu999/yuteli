// 価格を記録するシート（買い物リスト・価格画面の両方から開く）
// v1.11：店舗ごとに1件。1個（管理単位）あたりの金額を入れる（日付・買った数は入れない）
import { openSheet } from '../ui/sheet.js';
import { bindErrorClear, showErrors, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listProducts, getProduct, ValidationError } from '../data/productRepo.js';
import { listStores } from '../data/storeRepo.js';
import { setStorePrice, latestFor } from '../data/priceRepo.js';
import { INPUT_UNITS } from '../domain/units.js';
import { esc } from '../lib/util.js';
import { t } from '../lib/i18n.js';

/**
 * 価格の記録シート。その店舗の記録があれば、その内容で開く（直す）
 * @param {{ productId?: string, storeId?: string }} [preset]
 */
export async function openPriceSheet(preset = {}) {
  const [products, stores] = await Promise.all([listProducts(), listStores()]);

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
        </select>
        <p class="field-error" data-error-for="storeId"></p>
      </div>

      <div class="field">
        <label for="f-price" id="price-label">${t('1つあたりの金額（税込）')}</label>
        <div class="row" style="align-items:center">
          <input id="f-price" name="price" class="input grow" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="${t('例：228')}">
          <span>${t('円')}</span>
        </div>
        <p class="field-error" data-error-for="price"></p>
      </div>

      <div class="field">
        <label for="f-packageContent">${t('1つあたりの内容量')} <span class="optional">${t('任意')}</span></label>
        <div class="row">
          <input id="f-packageContent" name="packageContent" class="input grow" inputmode="decimal" autocomplete="off">
          <select name="packageContentUnit" class="select" style="width:96px" aria-label="${t('内容量の単位')}">
            ${INPUT_UNITS.map((u) => `<option value="${u}">${esc(t(u))}</option>`).join('')}
          </select>
        </div>
        <p class="field-error" data-error-for="packageContent"></p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">${t('記録する')}</button>
      </div>
    </form>
  `;

  const title = product ? t('{name}の価格', { name: product.name }) : t('価格を記録');
  const sheet = openSheet({ title, body });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);

  const priceInput = form.elements.namedItem('price');
  const contentInput = form.elements.namedItem('packageContent');
  const contentUnit = form.elements.namedItem('packageContentUnit');
  const priceLabel = form.querySelector('#price-label');
  const submitBtn = form.querySelector('button[type="submit"]');

  // その店舗の記録があれば入れる。なければ内容量だけ商品マスタから
  async function fill() {
    // 商品が決まっている時は select（無効）と hidden の2つがあるので hidden を優先
    const pid = (form.querySelector('input[name="productId"]') ?? form.querySelector('select[name="productId"]')).value;
    const sid = form.elements.namedItem('storeId').value;
    if (!pid) return;
    const [p, last] = await Promise.all([getProduct(pid), sid ? latestFor(pid, sid) : null]);
    priceLabel.textContent = p ? t('1{unit}あたりの金額（税込）', { unit: t(p.inventoryUnit) }) : t('1つあたりの金額（税込）');
    // v1.10 までの記録は合計額＋数量なので、1つあたりに直して出す
    priceInput.value = last ? Math.round(last.price / (last.quantity || 1)) : '';
    const src = last?.packageContent ? last : p;
    contentInput.value = src?.packageContent ?? '';
    contentUnit.value = src?.packageContentUnit ?? 'g';
    submitBtn.textContent = last ? t('保存') : t('記録する');
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'productId' || e.target.name === 'storeId') fill();
  });
  fill();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await setStorePrice(formValues(form));
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
