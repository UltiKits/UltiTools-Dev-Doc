// 永久保留 /sw.js，让仍安装旧缓存 worker 的浏览器获得卸载更新。
// 不注册 fetch handler，不预缓存页面，也不接管新访客。
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await self.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => self.caches.delete(cacheName)));
    await self.registration.unregister();

    // 新访客没有旧缓存，不重载；否则每次注册、自毁都会再次重载。
    if (cacheNames.length === 0) return;

    // 旧页面可能仍由被替换的 worker 控制，不能只查新 worker 的受控窗口。
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(pages.map((page) => page.navigate(page.url).catch(() => undefined)));
  })());
});
