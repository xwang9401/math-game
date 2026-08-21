/* ============================================================
 * Service Worker —— 让游戏可以「添加到主屏幕」并离线游玩
 * 修改预缓存资源后请递增 CACHE 版本号。
 * ============================================================ */
'use strict';

const CACHE = 'sxd-v13';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './kids.html',
  './kids.css',
  './kids.js',
  './manifest.json',
  './manifest-kids.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cacheSuccessfulSameOrigin(request, response) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !response.ok || response.type !== 'basic') return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (error) {
    // 缓存写入失败不应让已经成功的网络响应失败。
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // 页面导航优先走网络，失败时回退到当前请求缓存或应用入口。
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        await cacheSuccessfulSameOrigin(request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // 静态资源缓存优先；只缓存同源成功响应，避免把 404/500 固化到缓存。
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    await cacheSuccessfulSameOrigin(request, response.clone());
    return response;
  })());
});
