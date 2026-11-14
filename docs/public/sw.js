// 永久保留 /sw.js，让仍安装旧缓存 worker 的浏览器获得卸载更新。
// 不注册 fetch handler，不预缓存页面，也不接管新访客。
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    let cacheNames;
    try {
      cacheNames = await self.caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => self.caches.delete(cacheName)));
    } catch {
      // 枚举失败时无法排除旧缓存，仍继续注销与页面重载。
    } finally {
      await self.registration.unregister();
    }

    // 只有确认没有旧缓存才跳过重载，避免新访客反复重载。
    if (cacheNames?.length === 0) return;

    // 旧页面可能仍由被替换的 worker 控制，不能只查新 worker 的受控窗口。
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.allSettled(pages.map(async (page) => {
      const target = new URL(page.url);
      // 带片段的原 URL 可能只滚动；移除片段以强制加载文档，保留路径与查询。
      target.hash = '';
      await page.navigate(target.href);
    }));
  })());
});
