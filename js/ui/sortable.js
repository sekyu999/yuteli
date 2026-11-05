// ドラッグ＆ドロップで並べ替える共通部品（指・マウス両対応）
// 使い方：
//   <ul id="x"><li data-id="a"><span class="drag-handle">…</span>…</li>…</ul>
//   makeSortable(ul, { onSort: (ids) => 保存処理 })
// ・行の「≡」（drag-handle）を押さえて上下に動かす
// ・画面やシートの端に近づくと自動でスクロールする
// ・離すと、新しい並び順の data-id の配列で onSort が呼ばれる（順番が変わった時だけ）

const EDGE = 56; // 端からこの距離に入ったら自動スクロール（px）
const SPEED = 10; // 自動スクロールの速さ（px／フレーム）

/**
 * @param {HTMLElement} list ul / ol
 * @param {{ onSort: (ids: string[]) => void, handle?: string }} opts
 */
export function makeSortable(list, { onSort, handle = '.drag-handle' }) {
  list.addEventListener('pointerdown', (e) => {
    const h = e.target.closest(handle);
    if (!h || !list.contains(h) || e.button > 0) return;
    const item = h.closest('[data-id]');
    if (!item || item.parentElement !== list) return;
    e.preventDefault();
    drag(e, h, item);
  });

  function drag(e, h, item) {
    const items = [...list.children].filter((el) => el.dataset.id);
    const from = items.indexOf(item);
    const rects = items.map((el) => el.getBoundingClientRect());
    const scroller = item.closest('.sheet-body') ?? document.scrollingElement;
    const startScroll = scroller.scrollTop;
    const startY = e.clientY;
    const gap = from + 1 < rects.length ? rects[from + 1].top - rects[from].bottom : 0;
    const size = rects[from].height + gap;
    let pointerY = e.clientY;
    let to = from;
    let frame = 0;

    item.classList.add('dragging');
    list.classList.add('is-sorting');
    try {
      h.setPointerCapture(e.pointerId);
    } catch {
      /* 一部ブラウザでは不要 */
    }

    const update = () => {
      // 端に近ければスクロール
      const view = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const bottomLimit = scroller === document.scrollingElement ? view.bottom - 90 : view.bottom; // 下のタブの分
      if (pointerY > bottomLimit - EDGE) scroller.scrollTop += SPEED;
      else if (pointerY < view.top + EDGE + (scroller === document.scrollingElement ? 60 : 0)) scroller.scrollTop -= SPEED;

      const dy = pointerY - startY + (scroller.scrollTop - startScroll);
      item.style.transform = `translateY(${dy}px)`;
      // 持っている行の中心が、どの行の位置にあるか
      const center = rects[from].top + rects[from].height / 2 + dy;
      to = 0;
      for (let i = 0; i < rects.length; i++) {
        if (i === from) continue;
        const mid = rects[i].top + rects[i].height / 2;
        if (center > mid) to = i < from ? i + 1 : i;
      }
      if (to > from) to = Math.min(to, rects.length - 1);
      // 間の行をずらす
      items.forEach((el, i) => {
        if (i === from) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -size;
        if (from > to && i >= to && i < from) shift = size;
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);

    const onMove = (ev) => {
      pointerY = ev.clientY;
      ev.preventDefault();
    };
    const onEnd = () => {
      cancelAnimationFrame(frame);
      h.removeEventListener('pointermove', onMove);
      h.removeEventListener('pointerup', onEnd);
      h.removeEventListener('pointercancel', onEnd);
      items.forEach((el) => (el.style.transform = ''));
      item.classList.remove('dragging');
      list.classList.remove('is-sorting');
      if (to === from) return;
      const ids = items.map((el) => el.dataset.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      // 保存の前に見た目を新しい順にしておく（描き直しまでのちらつき防止）
      const els = items.slice();
      const [mEl] = els.splice(from, 1);
      els.splice(to, 0, mEl);
      els.forEach((el) => list.append(el));
      onSort(ids);
    };
    h.addEventListener('pointermove', onMove, { passive: false });
    h.addEventListener('pointerup', onEnd);
    h.addEventListener('pointercancel', onEnd);
  }
}

/** 行に置く「≡」の HTML */
export function dragHandle(label) {
  return `<span class="drag-handle" role="button" aria-label="${label}を並べ替え"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg></span>`;
}
