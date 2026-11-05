// 食事グループの作成・編集シート
// 例：「主菜」サバ缶と鶏むねを交互に晩1回／「野菜」4種類から昼晩100gずつ
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { listProducts, ValidationError } from '../data/productRepo.js';
import { getGroup, saveGroup, deleteGroup } from '../data/groupRepo.js';
import { MEALS, intakeUnit } from '../domain/consumption.js';
import { esc } from '../lib/util.js';

/** @param {string} [id] 指定すると編集 */
export async function openGroupSheet(id) {
  const [group, products] = await Promise.all([id ? getGroup(id) : null, listProducts()]);
  const g = group ?? { name: '', unit: 'g', consumption: { breakfast: 0, lunch: 0, dinner: 0 }, members: [] };
  const memberOf = new Map(g.members.map((m) => [m.productId, m]));
  const show = (n) => (n ? String(n) : '');

  const sheet = openSheet({
    title: group ? 'グループを編集' : 'グループを作る',
    body: `
      <form novalidate>
        <div class="field">
          <label for="f-name">名前</label>
          <input id="f-name" name="name" class="input" value="${esc(g.name)}" placeholder="例：野菜、主菜" autocomplete="off">
          <p class="field-error" data-error-for="name"></p>
        </div>
        <div class="field">
          <span class="label">量の決め方</span>
          <div class="choice-row">
            <label class="choice"><input type="radio" name="unit" value="g" ${g.unit === 'g' ? 'checked' : ''}><span>重さ<small>例：合わせて200g</small></span></label>
            <label class="choice"><input type="radio" name="unit" value="serving" ${g.unit === 'serving' ? 'checked' : ''}><span>回数<small>例：どれか1つを1回</small></span></label>
          </div>
        </div>
        <div class="meal-grid">
          ${MEALS.map(
            (m) => `<div class="meal-input">
              <label for="f-c_${m.key}">${m.label}</label>
              <div class="row" style="align-items:center">
                <input id="f-c_${m.key}" name="c_${m.key}" class="input" inputmode="decimal" value="${show(g.consumption[m.key])}" placeholder="0" autocomplete="off">
                <span class="unit-suffix" data-group-unit></span>
              </div>
            </div>`
          ).join('')}
        </div>
        <div class="field">
          <span class="label">入れる食品 <span class="optional">均等に食べたとして計算</span></span>
          <ul class="list member-list">
            ${products
              .map((p) => {
                const m = memberOf.get(p.id);
                return `<li>
                  <label class="check-row grow"><input type="checkbox" name="member" value="${p.id}" ${m ? 'checked' : ''}>${esc(p.name)}</label>
                  <span class="serving" data-serving-for="${p.id}">
                    <input name="serve_${p.id}" class="input" inputmode="decimal" value="${show(m?.servingAmount)}" placeholder="1回" aria-label="${esc(p.name)}の1回の量">
                    <span class="unit-suffix">${esc(intakeUnit(p))}</span>
                  </span>
                </li>`;
              })
              .join('')}
          </ul>
          <p class="field-error" data-error-for="members"></p>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-block">保存</button>
          ${group ? '<button type="button" class="btn-danger-text" data-delete>このグループを削除</button>' : ''}
        </div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);

  const sync = () => {
    const unit = form.querySelector('[name=unit]:checked')?.value ?? 'g';
    form.querySelectorAll('[data-group-unit]').forEach((s) => (s.textContent = unit === 'g' ? 'g' : '回'));
    form.querySelectorAll('[data-serving-for]').forEach((s) => {
      const checked = form.querySelector(`[name=member][value="${s.dataset.servingFor}"]`).checked;
      s.hidden = unit !== 'serving' || !checked;
    });
  };
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    const members = [...form.querySelectorAll('[name=member]:checked')].map((c) => ({
      productId: c.value,
      servingAmount: form.elements.namedItem(`serve_${c.value}`).value,
    }));
    try {
      await saveGroup(group?.id ?? null, { ...v, members });
      sheet.close();
      toast('保存しました');
    } catch (err) {
      if (err instanceof ValidationError) showErrors(form, err.errors);
      else throw err;
    }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!window.confirm(`「${group.name}」を削除しますか？（食品自体は消えません）`)) return;
    await deleteGroup(group.id);
    sheet.close();
    toast('削除しました');
  });
}
