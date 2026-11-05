// 栄養の目標に使うプロフィール（性別・年齢・身体活動レベル）
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { getMeta, setMeta, META } from '../data/metaRepo.js';
import { esc } from '../lib/util.js';

export const ACTIVITY = [
  { key: 'I', label: '低い', note: '1日のほとんどを座って過ごす' },
  { key: 'II', label: 'ふつう', note: '座り仕事が中心だが、通勤・買い物・家事や軽い運動をする' },
  { key: 'III', label: '高い', note: '立ち仕事や移動が多い、または運動の習慣がある' },
];

export function profileSummary(p) {
  if (!p) return '未設定';
  const act = ACTIVITY.find((a) => a.key === p.activity)?.label ?? '';
  return `${p.sex === 'male' ? '男性' : '女性'}・${p.age}歳・活動量${act}`;
}

export async function openProfileSheet() {
  const p = (await getMeta(META.profile)) ?? { sex: '', age: '', activity: 'II', menstruation: false };
  const sheet = openSheet({
    title: '栄養の目標',
    body: `
      <form novalidate>
        <div class="field">
          <span class="label">性別</span>
          <div class="segmented" role="radiogroup">
            <label class="seg-radio"><input type="radio" name="sex" value="female" ${p.sex === 'female' ? 'checked' : ''}>女性</label>
            <label class="seg-radio"><input type="radio" name="sex" value="male" ${p.sex === 'male' ? 'checked' : ''}>男性</label>
          </div>
          <p class="field-error" data-error-for="sex"></p>
        </div>
        <div class="field">
          <label for="f-age">年齢</label>
          <div class="row" style="align-items:center">
            <input id="f-age" name="age" class="input" inputmode="numeric" value="${esc(p.age)}" style="width:120px" autocomplete="off">
            <span class="unit-suffix">歳</span>
          </div>
          <p class="field-error" data-error-for="age"></p>
        </div>
        <div class="field">
          <span class="label">ふだんの活動量</span>
          ${ACTIVITY.map(
            (a) => `<label class="radio-row"><input type="radio" name="activity" value="${a.key}" ${p.activity === a.key ? 'checked' : ''}>
              <span><strong>${a.label}</strong><span class="note" style="display:block">${a.note}</span></span></label>`
          ).join('')}
        </div>
        <div class="field" id="mens-field">
          <label class="radio-row"><input type="checkbox" name="menstruation" value="1" ${p.menstruation ? 'checked' : ''}>
            <span>月経がある<span class="note" style="display:block">鉄の目標が変わります</span></span></label>
        </div>
        <p class="note" style="margin-top:12px">目標は「日本人の食事摂取基準（2025年版）」（厚生労働省）の18歳以上の値です。妊娠中・授乳中の方の付加量は含みません。</p>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-block">保存</button></div>
      </form>`,
  });
  const form = sheet.el.querySelector('form');
  bindErrorClear(form);
  const syncMens = () => {
    const sex = form.querySelector('[name=sex]:checked')?.value;
    form.querySelector('#mens-field').hidden = sex !== 'female';
  };
  form.addEventListener('change', syncMens);
  syncMens();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    const errors = {};
    if (!v.sex) errors.sex = '選んでください';
    const age = Number(v.age);
    if (!Number.isInteger(age) || age < 18 || age > 120) errors.age = '18〜120の整数で入力してください（18歳未満は対象外です）';
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return;
    }
    await setMeta(META.profile, {
      sex: v.sex,
      age,
      activity: v.activity || 'II',
      menstruation: v.sex === 'female' && !!v.menstruation,
    });
    sheet.close();
    toast('保存しました');
  });
}
