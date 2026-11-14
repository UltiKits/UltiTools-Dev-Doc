# 缓存与离线能力

本站不再提供离线可用能力，内容新鲜度交给 Cloudflare Pages 的 HTTP 缓存承担。

## 出处标注词表

以下四个字面量之一标在每一条取值旁，选择诚实的那一个是这张表存在的目的：

- `脚本实测`：值来自实际运行脚本或一次性 `curl`，注明运行日期和被测对象。
- `维护者浏览器观测`：值来自维护者本人在真实 profile 上的观察，被观察的对象写清楚。
- `待观测（human_needed）`：尚未发生的观测。该行写清楚需要看什么、去哪里看，不用猜测填充。
- `配置读取（非观测）`：值来自配置或源码读取，不是浏览器观测。

## 结论

本站不提供离线可用能力。内容新鲜度由 Cloudflare Pages 的 HTTP 缓存承担。永久保留同名 `/sw.js`、根 scope 的注册入口、manifest 与图标，终态仍是「不提供离线能力，但卸载通道永不关闭」。PWA 2 迁移改变实现，不恢复离线缓存。

## 历史实测证据

下表记录 2026-09-05 的旧版实现，不代表 PWA 2 迁移已经部署或完成浏览器验收。

| 项目 | 观测值 | 证据 | 出处标注 |
|---|---|---|---|
| 生产站 HTML 首页边缘响应头 | `cache-control: public, max-age=0, must-revalidate`；`cf-cache-status: DYNAMIC` | `curl -sS -D- -o /dev/null https://dev.ultikits.com/`，2026-09-05 | `脚本实测` |
| 生产站 `/sw.js` 边缘响应头 | `cache-control: public, max-age=14400, must-revalidate`；`etag: "055009153767a7455aba1820e28ebe37"`；`cf-cache-status: REVALIDATED`；608 字节 | `bash scripts/verify-sw.sh https://dev.ultikits.com`，2026-09-05 | `脚本实测` |
| `/sw.js` cache-busted etag 对比 | 两次请求的 etag 相同，无边缘陈旧字节的证据 | 同上一行 | `脚本实测` |
| 页面正文 | Markdown 在构建期 SSR 进 HTML；正文变化会改变对应 chunk 的 hash | 原研究中的增改一行、构建、还原对照 | `配置读取（非观测）` |

重新检查响应头和部署的脚本：

```bash
curl -sS -D- -o /dev/null https://dev.ultikits.com/ | grep -iE '^HTTP|cache-control|cf-cache-status'
bash scripts/verify-sw.sh https://dev.ultikits.com
```

内容新鲜度依赖 HTML 的 `max-age=0, must-revalidate` 和边缘不缓存旧 HTML。hash 命名资源保障 SPA 路由时的资源一致性，不替代 HTML 重新校验。若以后给 HTML 加更长的边缘缓存，必须重新验证这项约定。

HTML 与 `/sw.js` 的缓存时间不必相等。如果普通请求与 cache-busted 请求返回不同 etag，应单独记录并调查，不能以历史观测代替当前证据。

## 带 hash 的资源长缓存（docs/public/_headers）

`/assets/*` 下的文件由 Vite 按内容 hash 命名，同一个 URL 的内容不会变，因此 `docs/public/_headers` 给它们 `Cache-Control: public, max-age=31536000, immutable`。

HTML、`/sw.js`、`/manifest.webmanifest`、`/sitemap.xml`、`/robots.txt` 都不在 `/assets/` 下，继续使用 Pages 默认策略。新内容上线时 HTML 引用新的 hash 文件名，旧资源的长缓存不会替代新内容。本次迁移没有改动 `_headers`；部署后的实际响应仍需检查。

## 为什么曾经有离线能力，为什么撤掉

依据三条：

1. 原研究直接探测的 10 个同类框架或文档站里，8 个的 `manifest.webmanifest` 与 `sw.js` 均为 404，只有 `vitest.dev` 与 `angular.dev` 两个有可用的 service worker。
2. 本站核心价值是读者能够取得正确内容。
3. 旧离线缓存曾使读者长期停留在旧内容上。

## 为什么自毁 worker 与插件永久保留

删除插件或把 `/sw.js` 改名，不能卸载尚未回访的浏览器中的旧 Workbox 注册。原有决定因此永久保留同名卸载入口，而不是等待所有访客访问过一次后再删除它。旧模板是 608 字节；迁移后脚本的体积由 `scripts/verify-sw.sh` 在构建时检查。

`@vite-pwa/vitepress` 2 不再支持构建期 `selfDestroying: true`。上游的[迁移说明](https://github.com/vite-pwa/unplugin-pwa/blob/main/packages/vite/BREAKING-CHANGES.md#13-self-destroying-strategy-removed)要求显式维护旧文件名下的救援脚本，并[长期保留这个入口](https://github.com/vite-pwa/unplugin-pwa/blob/main/packages/vite/BREAKING-CHANGES.md#1-do-i-need-to-change-my-service-worker-setup-read-this-first)。本站采用 `docs/public/sw.js`，通过新版的 `buildSW` 构建为 classic worker；`buildSW.injectionPoint: false` 明确停用预缓存注入。不再设置已移除的 `selfDestroying` 开关。

注册由 `.vitepress/theme/register-rescue-worker.mjs` 的原生 `navigator.serviceWorker.register()` 完成，固定 `/sw.js`、scope `/`、type `classic`，并设置 `updateViaCache: 'none'`。`ReloadPrompt.vue` 只在浏览器挂载时调用它，不显示更新或离线就绪提示。PWA 插件不再重复注入注册代码，仍负责产出 worker 和 manifest。

脚本的生命周期如下，依据是源码和自动化测试，不是已完成的浏览器观测：

1. 安装时通过 `event.waitUntil(self.skipWaiting())` 立即进入激活，不等待访客关闭所有窗口。
2. 激活时用 `waitUntil()` 等待删除本站 origin 的全部 Cache Storage，然后注销自身。清理范围与旧模板相同，不涉及 cookie、localStorage 或 IndexedDB。
3. 若发现旧缓存，获取同 origin 的窗口，包括仍由旧 worker 控制的窗口，逐个导航到原 URL。清理先于导航，读者无须点击更新；单个窗口关闭不影响其他窗口。
4. 没有旧缓存时不导航，不调用 `clients.claim()`，也不注册 `fetch` handler。新访客不会因自毁流程反复重载；没有旧缓存的回访也不重载。

浏览器仍须能够联网取得新的 `/sw.js`；离线访问不属于本站提供的能力。长期未回访、仍运行旧缓存页面的浏览器依靠同名脚本的原生更新机制取得救援更新，不依赖先运行新版页面 JavaScript。实际更新时序和清理结果须在独立浏览器验收中观察。

站点与 PWA 共用 `.vitepress/config.mts` 中明确配置的根目录 `.vitepress/dist`。PWA 2 从站点配置读取 `outDir`，不再依赖旧 `pwa.outDir` 相对内容目录的解析。

结构性检查保留在 `docs-ci.yml` 的 `build` job，并在 `build-with-alpha` job 再检查注入后的产物：

- `scripts/verify-sw.sh` 继续检查同名脚本、清理逻辑、4096 字节上限和根 scope 的注册产物。
- `scripts/test-rescue-worker.mjs` 分别执行源码和构建产物的生命周期测试，检查等待清理、不缓存、不重载新访客、旧窗口清理和不形成重载循环。
- `scripts/check-pwa-artifacts.mjs` 检查 manifest、图标、每页的 manifest 链接，以及实际构建的原生注册函数和 bundle 引用，防止仅有文件名但缺少有效集成。

## 为什么 manifest 与图标保留

manifest 与图标继续提供安装为快捷方式的元数据，不承诺离线可用。PWA 2 负责生成 manifest，源码仍引用 `icon-512x512.png`；构建门禁检查两者和 HTML 中的 manifest 链接，缺少任一项都失败。

## 待观测

本次源码和构建检查不代替浏览器验收，也不表示已经部署。独立验收应在同一测试 origin 上覆盖：全新访客、已注册旧自毁 worker 的访客、保有旧缓存 worker 和旧页面的访客、内容更新后的再次访问，以及离线访问。旧访客场景不能通过换一个空白 profile 或手动清缓存代替。

预期为：旧缓存被删除、注册最终注销，旧缓存页面在清理后至多一次自动重载取得新内容；之后正常访问不需要强制刷新或手动更新。全新访客不自动重载、不留下持久注册或离线缓存。真实部署后的更新行为仍应记录来源和观测时间。
