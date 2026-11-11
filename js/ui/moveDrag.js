// 行を別のまとまり（月など）へドラッグ＆ドロップで移す共通部品（指・マウス両対応）
// 使い方：
//   <section data-drop="2026-12"><ul><li data-id="a">…<span class="drag-handle">…</span></li></ul></section>
//   makeMovable(root, { onDrop: (id, key) => 保存処理, label: (key) => '12月' })
// ・行の「≡」（drag-handle）を押さえて動かすと、行の写しが指についてくる
// ・指の下にある [data-drop] が移動先（色が付く）。画面の端に近づくと自動でスクロール
// ・離した時、元と違うまとまりの上なら onDrop(行の data-id, 移動先の data-drop) が呼ばれる
// ・label を渡すと、写しの上に「→ 移動先の名前」を出す（指と写しで見出しが隠れるため）

const EDGE = 64; // 端からこの距離に入ったら自動スクロール（px）
const SPEED = 12; // 自動スクロールの速さ（px／フレーム）
const TOP_BAR = 60; // 上の見出しの高さ
const BOTTOM_BAR = 90; // 下のタブの高さ

/**
 * @param {HTMLElement} root
 * @param {{ onDrop: (id: string, key: string) => void, label?: (key: string) => string, handle?: string }} opts
 */
export function makeMovable(root, { onDrop, label, handle = '.drag-handle' }) {
  root.addEventListener('pointerdown', (e) => {
    const h = e.target.closest(handle);
    if (!h || !root.contains(h) || e.button > 0) return;
    const item = h.closest('[data-id]');
    const from = item?.closest('[data-drop]');
    if (!item || !from) return;
    e.preventDefault();
    drag(e, h, item, from.dataset.drop);
  });

  function drag(e, h, item, fromKey) {
    const scroller = document.scrollingElement;
    const rect = item.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const ghost = item.cloneNode(true);
    ghost.classList.add('move-ghost');
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
    const tag = document.createElement('span');
    tag.className = 'move-to';
    tag.hidden = true;
    ghost.append(tag);
    document.body.append(ghost);
    item.classList.add('move-source');
    root.classList.add('is-moving');

    let pointerY = e.clientY;
    let over = null;
    let frame = 0;
    try {
      h.setPointerCapture(e.pointerId);
    } catch {
      /* 一部ブラウザでは不要 */
    }

    const update = () => {
      const bottom = window.innerHeight - BOTTOM_BAR;
      // 端に近いほど速く
      if (pointerY > bottom - EDGE) scroller.scrollTop += Math.ceil(SPEED * Math.min(1, (pointerY - (bottom - EDGE)) / EDGE));
      else if (pointerY < TOP_BAR + EDGE) scroller.scrollTop -= Math.ceil(SPEED * Math.min(1, (TOP_BAR + EDGE - pointerY) / EDGE));
      ghost.style.top = `${pointerY - offsetY}px`;

      // 指の下の移動先（写しは pointer-events:none なので下の要素が取れる）
      // 横位置は一覧の中央で判定する（指が少し左右にずれても移動先が外れないように）
      const box = root.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, pointerY);
      const target = hit?.closest('[data-drop]');
      // まとまりの間のすき間や一覧の下では、直前の移動先のままにする
      const next = target && root.contains(target) ? target : over;
      if (next !== over) {
        over?.classList.remove('drop-over');
        over = next;
        const moving = over && over.dataset.drop !== fromKey;
        if (moving) over.classList.add('drop-over');
        if (label) {
          tag.hidden = !moving;
          tag.textContent = moving ? `→ ${label(over.dataset.drop)}` : '';
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);

    const onMove = (ev) => {
      pointerY = ev.clientY;
      ev.preventDefault();
    };
    const onEnd = (ev) => {
      cancelAnimationFrame(frame);
      h.removeEventListener('pointermove', onMove);
      h.removeEventListener('pointerup', onEnd);
      h.removeEventListener('pointercancel', onEnd);
      ghost.remove();
      item.classList.remove('move-source');
      root.classList.remove('is-moving');
      over?.classList.remove('drop-over');
      if (ev.type === 'pointerup' && over && over.dataset.drop !== fromKey) onDrop(item.dataset.id, over.dataset.drop);
    };
    h.addEventListener('pointermove', onMove, { passive: false });
    h.addEventListener('pointerup', onEnd);
    h.addEventListener('pointercancel', onEnd);
  }
}
