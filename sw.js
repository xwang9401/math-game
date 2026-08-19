/* ============================================================
 * Service Worker —— 让游戏可以「添加到主屏幕」并离线游玩
 * 注意：修改游戏文件后，请把下面的 CACHE 版本号 +1，
 * 浏览器才会拉取新版本（例如 sxd-v1 → sxd-v2）。
 * ============================================================ */
'use strict';

const CACHE = 'sxd-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(req, res) {
  caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 页面导航优先走网络（保证更新即时生效），失败时回退缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { cachePut(req, res.clone()); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(
      (hit) => hit || fetch(req).then((res) => { cachePut(req, res.clone()); return res; })
    )
  );
});
