// 同名、根 scope 的注册会触发存量 worker 更新；不使用浏览器 HTTP 缓存。
// 参数由浏览器生命周期传入，便于在不启动浏览器的单元测试中核对注册选项。
export function registerRescueWorker(serviceWorker) {
  return serviceWorker.register('/sw.js', {
    scope: '/',
    type: 'classic',
    updateViaCache: 'none',
  })
}
