// ⑤ 設定・バックアップ（バックアップは Phase 6 で実装）
// 今はデータ保護の状態と、各テーブルの件数を表示する。
import { watch } from '../ui/live.js';
import { countAll, isPersisted, isStandalone, requestPersistence } from '../data/storage.js';

export const title = '設定';

const TABLE_LABELS = {
  categories: 'カテゴリ',
  products: '商品',
  stores: '店舗',
  storeShelfOrders: '売り場順',
  shoppingListItems: '買い物リスト',
  priceRecords: '価格記録',
  meta: '管理情報',
};

export function mount(el) {
  el.innerHTML = `
    <div class="stack">
      <section>
        <h2 class="section-title">データの保護</h2>
        <ul class="list">
          <li><span class="grow">ホーム画面から起動</span><span id="st-standalone"></span></li>
          <li><span class="grow">データ保護</span><span id="st-persist"></span></li>
        </ul>
        <p class="notice" style="margin-top:12px">
          データはこの iPhone の中だけに保存されます。Safari の履歴・サイトデータの削除や機種変更で消えるため、定期的にバックアップしてください。
          ホーム画面に追加して使うと、しばらく開かなくても消えにくくなります。
        </p>
      </section>

      <section>
        <h2 class="section-title">保存されているデータ</h2>
        <ul class="list" id="counts"></ul>
      </section>

      <p class="placeholder">バックアップ・復元・初期化は Phase 6 で作ります。</p>
    </div>
  `;

  el.querySelector('#st-standalone').innerHTML = isStandalone()
    ? '<span class="badge">はい</span>'
    : '<span class="note">いいえ</span>';

  const persistEl = el.querySelector('#st-persist');
  (async () => {
    const ok = (await isPersisted()) || (await requestPersistence());
    persistEl.innerHTML = ok ? '<span class="badge">有効</span>' : '<span class="note">未許可</span>';
  })();

  const countsEl = el.querySelector('#counts');
  return watch(countAll, (counts) => {
    countsEl.innerHTML = Object.entries(TABLE_LABELS)
      .map(
        ([key, label]) =>
          `<li><span class="grow">${label}</span><span class="num">${counts[key]} 件</span></li>`
      )
      .join('');
  });
}
