// 画面下に短いメッセージを出す
// toast('保存しました')
// toast('購入済みにしました', { actions: [{ label: '元に戻す', onClick: () => … }] })
import { esc } from '../lib/util.js';

let timer = null;

/**
 * @param {string} message
 * @param {{ actions?: Array<{label:string, onClick:()=>void}>, duration?: number }} [opts]
 */
export function toast(message, opts = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  const actions = opts.actions ?? [];
  el.innerHTML =
    `<span class="toast-text">${esc(message)}</span>` +
    actions.map((a, i) => `<button type="button" class="toast-action" data-i="${i}">${esc(a.label)}</button>`).join('');
  el.classList.toggle('has-actions', actions.length > 0);
  el.onclick = (e) => {
    const btn = e.target.closest('.toast-action');
    if (!btn) return;
    hide();
    actions[Number(btn.dataset.i)].onClick();
  };
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(hide, opts.duration ?? (actions.length ? 6000 : 2200));
}

function hide() {
  document.getElementById('toast')?.classList.remove('show');
}
