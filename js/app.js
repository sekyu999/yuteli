// アプリの起動とタブ切替
// URL の # 部分（#/list など）を見て、表示する画面を決める。
import * as shopping from './screens/shopping.js';
import * as stock from './screens/stock.js';
import * as prices from './screens/prices.js';
import * as meals from './screens/meals.js';
import * as budget from './screens/budget.js';
import * as settings from './screens/settings.js';
import { db } from './data/db.js';
import { requestPersistence } from './data/storage.js';
import { hideToast } from './ui/toast.js';
import { t, translateStatic } from './lib/i18n.js';
import { openNoteSheet, showNoteOnLaunch } from './screens/noteSheet.js';

/**
 * 各画面は次の2つを export する：
 *   title           … ヘッダーに出す名前
 *   mount(el)       … el の中に画面を作る。片付け用の関数を返す（任意）
 */
const ROUTES = { list: shopping, stock, prices, meals, budget, settings };
/** 以前の URL（#/health）で開いても食事画面を出す */
const ALIASES = { health: 'meals' };
const DEFAULT_ROUTE = 'list';

const screenEl = document.getElementById('screen');
const titleEl = document.getElementById('screen-title');
const tabs = document.querySelectorAll('.tabbar a');

let cleanup = null;

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '').split('/')[0];
  const key = ALIASES[raw] ?? raw;
  return key in ROUTES ? key : DEFAULT_ROUTE;
}

function show() {
  const key = currentRoute();
  const screen = ROUTES[key];

  // 前の画面の監視を止めてから中身を入れ替える。
  // 画面ごとに新しい入れ物を作るので、前の画面のタップ処理は入れ物ごと消える。
  if (typeof cleanup === 'function') cleanup();
  // 開いたままのシート（戻るジェスチャーで画面が変わった時など）を閉じる
  document.querySelectorAll('dialog.sheet[open]').forEach((d) => d.close());
  hideToast();
  const container = document.createElement('div');
  screenEl.replaceChildren(container);
  cleanup = screen.mount(container) ?? null;

  titleEl.textContent = t(screen.title);
  document.title = `${t(screen.title)} | KESELA`;
  tabs.forEach((a) => {
    if (a.dataset.route === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

async function start() {
  // index.html に書いた文字（下のタブなど）を今の言語にする
  translateStatic();
  document.querySelector('.tabbar')?.setAttribute('aria-label', t('メイン'));
  const noteBtn = document.getElementById('note-btn');
  noteBtn.setAttribute('aria-label', t('目標'));
  noteBtn.addEventListener('click', () => openNoteSheet());
  try {
    await db.open();
  } catch (e) {
    console.error(e);
    const p = document.createElement('p');
    p.className = 'notice';
    p.textContent = t('データベースを開けませんでした。プライベートブラウズでは使えない場合があります。');
    screenEl.replaceChildren(p);
    return;
  }

  window.addEventListener('hashchange', show);
  show();

  // 目標メモを起動時に表示。アプリに戻った時も、日付が変わっていれば表示する
  showNoteOnLaunch();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') showNoteOnLaunch();
  });


  requestPersistence();

  // 以前の版で出していたアイコンのバッジ（買い物リストの件数）を消す
  clearOldBadge();

  // オフライン対応（HTTPS か localhost のときだけ動く）
  if ('serviceWorker' in navigator) {
    // updateViaCache: 'none' … sw.js 自体もブラウザのキャッシュを使わず、毎回新しい版があるか確認する
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // アプリに戻ってきた時にも更新を確認する
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch((e) => console.warn('SW登録失敗', e)); // i18n-ignore
    // 新しい版に切り替わったら1回だけ読み込み直す（古いファイルと新しいファイルが混ざらないように）
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
}

/** v1.4 のバッジ機能をオンにしていた端末で、残っている数字を消す */
function clearOldBadge() {
  try {
    if (localStorage.getItem('yuteli.badge') !== '1') return;
    localStorage.removeItem('yuteli.badge');
  } catch {
    return;
  }
  navigator.clearAppBadge?.().catch(() => {});
}

start();
