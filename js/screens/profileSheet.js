// 栄養の目標に使うプロフィール（性別・年齢・身長・体重・活動量）
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { getMeta, setMeta, META } from '../data/metaRepo.js';
import { bodyStats } from '../domain/nutrition.js';
import { esc } from '../lib/util.js';
import { t } from '../lib/i18n.js';

export const ACTIVITY = [
  { key: 'I', label: '低い', note: 'ほとんど座って過ごす' },
  { key: 'II', label: 'ふつう', note: '座り仕事中心＋通勤・家事・軽い運動' },
  { key: 'III', label: '高い', note: '立ち仕事・移動が多い／運動習慣あり' },
];

export function profileSummary(p) {
  if (!p) return t('未設定');
  const act = ACTIVITY.find((a) => a.key === p.activity)?.label ?? '';
  const sep = t('・');
  return [
    p.sex === 'male' ? t('男性') : t('女性'),
    t('{n}歳', { n: p.age }),
    p.height ? `${p.height}cm` : '',
    p.weight ? `${p.weight}kg` : '',
    t('活動量{level}', { level: act ? t(act) : '' }),
  ]
    .filter(Boolean)
    .join(sep);
}

export async function openProfileSheet() {
  const p = (await getMeta(META.profile)) ?? { sex: '', age: '', activity: 'II', menstruation: false };
  const choice = (name, value, label, checked, sub = '') =>
    `<label class="choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
      <span>${esc(t(label))}${sub ? `<small>${esc(t(sub))}</small>` : ''}</span></label>`;
  const num = (name, label, unit, value, mode = 'decimal') => `
    <div class="field">
      <label for="f-${name}">${esc(t(label))}</label>
      <div class="row" style="align-items:center">
        <input id="f-${name}" name="${name}" class="input" inputmode="${mode}" value="${esc(value ?? '')}" style="width:110px" autocomplete="off">
        <span class="unit-suffix">${esc(t(unit))}</span>
      </div>
      <p class="field-error" data-error-for="${name}"></p>
    </div>`;

  const sheet = openSheet({
    title: t('からだの情報'),
    body: `
      <form novalidate>
        <div class="field">
          <span class="label">${t('性別')}</span>
          <div class="choice-row">
            ${choice('sex', 'female', '女性', p.sex === 'female')}
            ${choice('sex', 'male', '男性', p.sex === 'male')}
          </div>
          <p class="field-error" data-error-for="sex"></p>
        </div>
        <div class="row-fields">
          ${num('age', '年齢', '歳', p.age, 'numeric')}
          ${num('height', '身長', 'cm', p.height)}
          ${num('weight', '体重', 'kg', p.weight)}
        </div>
        <div class="field">
          <span class="label">${t('活動量')}</span>
          <div class="choice-col">
            ${ACTIVITY.map((a) => choice('activity', a.key, a.label, p.activity === a.key, a.note)).join('')}
          </div>
        </div>
        <div class="field" id="mens-field">
          <label class="check-row"><input type="checkbox" name="menstruation" value="1" ${p.menstruation ? 'checked' : ''}>${t('月経がある（鉄の目標が変わります）')}</label>
        </div>
        <p class="body-preview" id="body-preview"></p>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-block">${t('保存')}</button></div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);

  const read = () => {
    const v = formValues(form);
    return {
      sex: v.sex,
      age: Number(v.age),
      height: v.height ? Number(v.height) : null,
      weight: v.weight ? Number(v.weight) : null,
      activity: v.activity || 'II',
      menstruation: v.sex === 'female' && !!v.menstruation,
    };
  };
  const sync = () => {
    const v = read();
    form.querySelector('#mens-field').hidden = v.sex !== 'female';
    const b = v.sex ? bodyStats(v) : null;
    form.querySelector('#body-preview').innerHTML = b
      ? [
          b.bmi
            ? t('BMI <strong>{bmi}</strong>（目標 {min}〜{max}）', { bmi: b.bmi.toFixed(1), min: b.bmiRange[0], max: b.bmiRange[1] })
            : '',
          t('基礎代謝 <strong>{kcal}</strong>kcal', { kcal: b.bmr.toLocaleString('en-US') }),
          t('1日に必要なエネルギー <strong>{kcal}</strong>kcal', { kcal: b.energy.toLocaleString('en-US') }),
        ]
          .filter(Boolean)
          .join('<br>')
      : '';
  };
  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = read();
    const errors = {};
    if (!v.sex) errors.sex = '選んでください';
    if (!Number.isInteger(v.age) || v.age < 18 || v.age > 120) errors.age = '18〜120歳';
    if (v.height !== null && !(v.height >= 100 && v.height <= 250)) errors.height = '100〜250cm';
    if (v.weight !== null && !(v.weight >= 20 && v.weight <= 300)) errors.weight = '20〜300kg';
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return;
    }
    await setMeta(META.profile, v);
    sheet.close();
    toast(t('保存しました'));
  });
}
