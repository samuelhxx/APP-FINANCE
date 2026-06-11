/**
 * sw.js — service worker: cache-first para app shell, stale-while-revalidate para o resto
 */
const CACHE = 'fc-v1';

const APP_SHELL = [
  '/APP-FINANCE/',
  '/APP-FINANCE/index.html',
  '/APP-FINANCE/css/app.css',
  '/APP-FINANCE/js/main.js',
  '/APP-FINANCE/js/storage.js',
  '/APP-FINANCE/js/calc.js',
  '/APP-FINANCE/js/router.js',
  '/APP-FINANCE/js/charts.js',
  '/APP-FINANCE/js/views/reserve.js',
  '/APP-FINANCE/js/views/month.js',
  '/APP-FINANCE/js/views/contracts.js',
  '/APP-FINANCE/js/views/contas.js',
  '/APP-FINANCE/js/views/settings.js',
  '/APP-FINANCE/js/views/diagnosis.js',
  '/APP-FINANCE/js/views/launch.js',
  '/APP-FINANCE/icons/icon-192.png',
  '/APP-FINANCE/icons/icon-512.png',
  '/APP-FINANCE/icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Cache-first para assets do app shell (mesmo origin)
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => null);
        return cached || net;
      }),
    );
  }
});
