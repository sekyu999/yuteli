// フォームまわりの小さな部品
import { esc } from '../lib/util.js';

/**
 * ± ボタン付きの数値入力の HTML。
 * ボタンの動きは bindSteppers() で付ける。
 */
export function stepperField({ name, label, value = 0, suffix = '' }) {
  return `
    <div class="field">
      <label for="f-${name}">${esc(label)}</label>
      <div class="stepper">
        <button type="button" class="stepper-btn" data-step="-1" data-target="${name}" aria-label="${esc(label)}を1減らす">−</button>
        <input id="f-${name}" name="${name}" type="text" inputmode="numeric" pattern="[0-9]*"
               value="${esc(value)}" autocomplete="off">
        <button type="button" class="stepper-btn" data-step="1" data-target="${name}" aria-label="${esc(label)}を1増やす">＋</button>
        ${suffix ? `<span class="stepper-suffix" data-suffix-for="${name}">${esc(suffix)}</span>` : ''}
      </div>
      <p class="field-error" data-error-for="${name}"></p>
    </div>
  `;
}

/** フォーム内の ± ボタンを動くようにする */
export function bindSteppers(form) {
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    const input = form.elements.namedItem(btn.dataset.target);
    const n = parseInt(input.value, 10);
    const next = Math.min(999, Math.max(0, (Number.isNaN(n) ? 0 : n) + Number(btn.dataset.step)));
    input.value = String(next);
    clearError(form, input.name);
  });
}

/** 項目を直したら、その項目のエラー表示を消す */
export function bindErrorClear(form) {
  const handler = (e) => e.target.name && clearError(form, e.target.name);
  form.addEventListener('input', handler);
  form.addEventListener('change', handler);
}

/** 1項目分のエラー表示を消す */
export function clearError(form, name) {
  const p = form.querySelector(`[data-error-for="${name}"]`);
  if (p) p.textContent = '';
  form.elements.namedItem(name)?.removeAttribute?.('aria-invalid');
}

/** 項目ごとのエラーメッセージを表示（errors が空なら全部消す） */
export function showErrors(form, errors = {}) {
  form.querySelectorAll('[data-error-for]').forEach((p) => {
    const msg = errors[p.dataset.errorFor] ?? '';
    p.textContent = msg;
    const input = form.elements.namedItem(p.dataset.errorFor);
    if (input && 'setAttribute' in input) {
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  });
  const first = form.querySelector('[aria-invalid="true"]');
  first?.focus();
}

/** フォームの値をオブジェクトにする */
export function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}
