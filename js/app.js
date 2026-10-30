// アプリの起動とタブ切替
// URL の # 部分（#/list など）を見て、表示する画面を決める。
import * as shopping from './screens/shopping.js';
import * as stock from './screens/stock.js';
import * as prices from './screens/prices.js';
import * as health from './screens/health.js';
import * as settings from './screens/settings.js';
import { db } from './data/db.js';
import { requestPersistence } from './data/storage.js';

/**
 * 各画面は次の2つを export する：
 *   title           … ヘッダーに出す名前
 *   mount(el)       … el の中に画面を作る。片付け用の関数を返す（任意）
 */
const ROUTES = { list: shopping, stock, prices, health, settings };
const DEFAULT_ROUTE = 'list';

const screenEl = document.getElementById('screen');
const titleEl = document.getElementById('screen-title');
const tabs = document.querySelectorAll('.tabbar a');

let cleanup = null;

function currentRoute() {
  const key = location.hash.replace(/^#\/?/, '').split('/')[0];
  return key in ROUTES ? key : DEFAULT_ROUTE;
}

function show() {
  const key = currentRoute();
  const screen = ROUTES[key];

  // 前の画面の監視を止めてから中身を入れ替える
  if (typeof cleanup === 'function') cleanup();
  screenEl.replaceChildren();
  cleanup = screen.mount(screenEl) ?? null;

  titleEl.textContent = screen.title;
  document.title = `${screen.title} | YUTELI`;
  tabs.forEach((a) => {
    if (a.dataset.route === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

async function start() {
  try {
    await db.open();
  } catch (e) {
    console.error(e);
    screenEl.innerHTML =
      '<p class="notice">データベースを開けませんでした。プライベートブラウズでは使えない場合があります。</p>';
    return;
  }

  window.addEventListener('hashchange', show);
  show();

  requestPersistence();

  // オフライン対応（HTTPS か localhost のときだけ動く）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW登録失敗', e));
  }
}

start();
