// オフライン対応（Service Worker）
// 方針：ネットにつながる時は常に最新のファイルを取り、つながらない時だけ保存済みのものを使う。
// そのため、ファイルを更新したときにキャッシュが原因で古い画面が出る、ということが起きにくい。

// アプリを更新したら版を上げる（js/lib/version.js と合わせる）
const CACHE = 'yuteli-1.0.0';

// オフラインでも開けるように最初に保存しておくファイル
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/components.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'js/app.js',
  'js/content/healthRecommendations.js',
  'js/data/backup.js',
  'js/data/categoryRepo.js',
  'js/data/db.js',
  'js/data/metaRepo.js',
  'js/data/priceRepo.js',
  'js/data/productRepo.js',
  'js/data/shoppingRepo.js',
  'js/data/storage.js',
  'js/data/storeRepo.js',
  'js/domain/backupFormat.js',
  'js/domain/pricing.js',
  'js/domain/product.js',
  'js/domain/shelf.js',
  'js/domain/shoppingList.js',
  'js/domain/units.js',
  'js/lib/util.js',
  'js/lib/version.js',
  'js/screens/health.js',
  'js/screens/priceSheet.js',
  'js/screens/prices.js',
  'js/screens/settings.js',
  'js/screens/shopping.js',
  'js/screens/stock.js',
  'js/ui/form.js',
  'js/ui/live.js',
  'js/ui/sheet.js',
  'js/ui/toast.js',
  'vendor/dexie.mjs',
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
