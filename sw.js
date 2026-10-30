// オフライン対応（Service Worker）
// 方針：ネットにつながる時は常に最新のファイルを取り、つながらない時だけ保存済みのものを使う。
// そのため、ファイルを更新したときにキャッシュが原因で古い画面が出る、ということが起きにくい。

const CACHE = 'yuteli-v1';

// オフラインでも開けるように最初に保存しておくファイル
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/components.css',
  'js/app.js',
  'js/lib/util.js',
  'js/ui/live.js',
  'js/data/db.js',
  'js/data/storage.js',
  'js/data/categoryRepo.js',
  'js/data/productRepo.js',
  'js/domain/units.js',
  'js/screens/shopping.js',
  'js/screens/stock.js',
  'js/screens/prices.js',
  'js/screens/health.js',
  'js/screens/settings.js',
  'vendor/dexie.mjs',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 古い版のキャッシュを削除
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
