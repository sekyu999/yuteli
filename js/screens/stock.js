// ② 在庫・商品管理（Phase 2 で実装）
// 今はカテゴリ一覧を表示して、DB が動いていることを確認する。
import { watch } from '../ui/live.js';
import { listCategories } from '../data/categoryRepo.js';
import { esc } from '../lib/util.js';

export const title = '在庫';

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <p class="placeholder">商品の登録・在庫の変更は Phase 2 で作ります。</p>
      <section>
        <h2 class="section-title">カテゴリ（DB から読み込み）</h2>
        <ul class="list" id="category-list"></ul>
      </section>
    </div>
  `;
  const listEl = el.querySelector('#category-list');

  // カテゴリが変わると自動で描き直される
  return watch(listCategories, (categories) => {
    listEl.innerHTML = categories
      .map((c) => `<li><span class="grow">${esc(c.name)}</span></li>`)
      .join('');
  });
}
