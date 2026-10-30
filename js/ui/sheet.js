// 画面の下から出てくるパネル（シート）
// 使い方：
//   const sheet = openSheet({ title: '商品を登録', body: '<form>…</form>' });
//   sheet.el … シートの中身の要素（ここからフォームなどを探す）
//   sheet.close() … 閉じる
// 背景のタップ、「閉じる」ボタンでも閉じる。
import { esc } from '../lib/util.js';

/**
 * @param {{ title: string, body: string, onClose?: () => void }} opts
 */
export function openSheet({ title, body, onClose }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.innerHTML = `
    <div class="sheet-inner">
      <header class="sheet-header">
        <h2>${esc(title)}</h2>
        <button type="button" class="sheet-close" data-sheet-close aria-label="閉じる">閉じる</button>
      </header>
      <div class="sheet-body">${body}</div>
    </div>
  `;
  document.body.append(dialog);

  // 背景のスクロールを止める
  document.documentElement.classList.add('sheet-open');

  const close = () => {
    if (!dialog.open) return;
    dialog.close();
  };

  dialog.addEventListener('close', () => {
    dialog.remove();
    if (!document.querySelector('dialog.sheet[open]')) {
      document.documentElement.classList.remove('sheet-open');
    }
    onClose?.();
  });

  dialog.addEventListener('click', (e) => {
    // dialog 自体（＝背景部分）をタップしたら閉じる
    if (e.target === dialog || e.target.closest('[data-sheet-close]')) close();
  });

  dialog.showModal();
  return { el: dialog, close };
}
