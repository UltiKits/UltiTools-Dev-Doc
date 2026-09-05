# 缓存与离线能力

本站不再提供离线可用能力，内容新鲜度交给 Cloudflare Pages 的 HTTP 缓存承担。

## 出处标注词表

以下四个字面量之一标在每一条取值旁，选择诚实的那一个是这张表存在的目的：

- `脚本实测` — 值来自实际运行 `bash scripts/verify-sw.sh https://dev.ultikits.com` 或一次性 `curl`，运行输出被逐字引用。
- `维护者浏览器观测` — 值来自维护者本人在真实 profile 上的观察，被观察的对象写清楚。
- `待观测（human_needed）` — 尚未发生的观测。该行写清楚需要看什么、去哪里看，不用猜测填充。
- `配置读取（非观测）` — 值来自配置或源码读取，不是观测。该行明说这一点，需要观测才能确认的行为主张保持独立、开放。

## 结论

本站不提供离线可用能力。内容新鲜度由 Cloudflare Pages 的 HTTP 缓存承担。`selfDestroying: true` 与 `@vite-pwa/vitepress` 插件作为永久配置保留，终态是「不提供离线能力，但卸载通道永不关闭」。

## 实测证据

| # | 项目 | 观测值 | 证据 | 出处标注 |
|---|------|--------|------|----------|
| 1 | 生产站 HTML 首页边缘响应头 | `cache-control: public, max-age=0, must-revalidate`；`cf-cache-status: DYNAMIC` | `curl -sS -D- -o /dev/null https://dev.ultikits.com/ \| grep -iE "^HTTP\|cache-control\|cf-cache-status"`，2026-09-05 实测运行 | `脚本实测` |
| 2 | 生产站 `/sw.js` 边缘响应头 | `cache-control: public, max-age=14400, must-revalidate`；`etag: "055009153767a7455aba1820e28ebe37"`；`cf-cache-status: REVALIDATED`（plain）；`content-length: 608` | `bash scripts/verify-sw.sh https://dev.ultikits.com`，2026-09-05 实测运行 | `脚本实测` |
| 3 | `/sw.js` cache-busted etag 对比判定 | plain 与 cache-busted 两次请求的 `etag` 相同（`055009153767a7455aba1820e28ebe37`），`verdict: etags matched — 无边缘陈旧字节的证据` | 同上一行的 `verify-sw.sh` 运行输出 | `脚本实测` |
| 4 | 页面正文在构建期被 SSR 渲染进 HTML 本身，不依赖任何 JS chunk 才能被读到 | 一次改动一行 Markdown 内容再构建再还原的实测：`grep` 能在产出的 `.html` 文件里直接命中新增文本，且该页面专属 chunk 的文件名 hash 随内容变化、内容还原后 hash 精确变回原值 | `06-RESEARCH.md` 研究问题 2（本任务不重跑，依据既有实测记录） | `配置读取（非观测）` |
| 5 | 新读者的注册行为 | 见下方「为什么自毁 worker 与插件永久保留」一节的精确措辞 | `node_modules/vite-plugin-pwa/dist/client/build/register.js` 与已构建 `.vitepress/dist/sw.js` 的源码读取 | `配置读取（非观测）` |

产出每一行的命令，逐字列出，供读者自己重跑：

```bash
# 第 1 行
curl -sS -D- -o /dev/null https://dev.ultikits.com/ | grep -iE "^HTTP|cache-control|cf-cache-status"

# 第 2、3 行
bash scripts/verify-sw.sh https://dev.ultikits.com

# 第 4 行（06-RESEARCH.md 已执行，本文档不重跑）
grep -o 'guide_essentials_data-storage.md\.[A-Za-z0-9]*\.lean\.js' .vitepress/dist/guide/essentials/data-storage.html
echo "临时测试行" >> docs/src/guide/essentials/data-storage.md && npm run build
grep -c "临时测试行" .vitepress/dist/guide/essentials/data-storage.html
git checkout -- docs/src/guide/essentials/data-storage.md && npm run build

# 第 5 行（本文档不重跑，直接读取产物）
cat node_modules/vite-plugin-pwa/dist/client/build/register.js
cat .vitepress/dist/sw.js
```

**承重关系：** 承重的是 HTML 响应的 `max-age=0, must-revalidate` 加 Cloudflare 判定的 `DYNAMIC`（边缘完全不缓存）。hash 命名资源的内容指纹是辅助环节，它保障的是 SPA 客户端路由时的一致性，不是读者「看到新内容」本身依赖的机制。唯一能打破这条链路的改动是给 HTML 加上比 `max-age=0` 更长的边缘缓存策略。

**「一致」不是两个数字相等：** HTML 是 `max-age=0`、`sw.js` 是 `max-age=14400`，本来就不同。它指的是两者都受 `must-revalidate` 约束、都没有边缘持有一份比源站更旧的字节的证据。反例：若 `/sw.js` 的 cache-busted 请求返回了与 plain 请求不同的 etag，就说明边缘有一份陈旧副本尚未被替换，那条结论必须单独呈报、记为未决，而不是被本次的「一致」掩盖。本次实测两者相同（均为 `055009153767a7455aba1820e28ebe37`），不需要呈报。

## 为什么曾经有离线能力，为什么撤掉

依据三条：

1. 研究阶段直接 HTTP 探测的 10 个同类框架/文档站里，8 个的 `manifest.webmanifest` 与 `sw.js` 均为 404，只有 `vitest.dev` 与 `angular.dev` 两个有可用的 service worker。
2. 本站核心价值是站点能力与读者拿到内容冲突时后者赢。
3. 这整个里程碑存在的原因，就是离线缓存把读者卡在了旧内容上。

## 为什么自毁 worker 与插件永久保留

拒绝「完全移除插件」的具体风险：Phase 5 上线后一直没访问过站点的读者浏览器里仍装着旧的 workbox worker，插件一移除 `sw.js` 即 404，那些读者会永久卡住且解救通道已消失。这条结论按方向明确、待实测坐实记录，不是已证实的结论。保留的代价已量化且很小：每次访问一次 608 字节取回加一轮 SW 装卸。

新读者的浏览器仍会对 `/sw.js` 发起一次真实的 service worker 注册请求（这是 `selfDestroying: true` 配置下未被移除的代码路径），
但这次注册在同一次访问内完成「安装 → 立即 `skipWaiting()` → 激活时立即 `self.registration.unregister()`」的完整自毁流程，
不留下任何持久注册、不创建任何缓存条目，也不会让当前这次访问被该 worker 控制或触发页面重载。

结构性保障：`scripts/verify-sw.sh` 的断言 2/3/4 在 `.github/workflows/docs-ci.yml` 的 `build` job 里对每一次后续 PR 运行，任何未来改动若意外改了 `sw.js` 的文件名、scope，或让自毁逻辑退化回 workbox precache 形态，会在合并前变红。

## 为什么 manifest 与图标保留

`manifest.webmanifest` 与 `icon-512x512.png` 当前均为 200 且保留：插件仍在，manifest 是插件产物；移除要动更多 PWA 选项，而 Phase 5 的教训正是动 PWA 选项的地方最容易出事。没有离线能力的 manifest 只让站点可被安装成快捷方式，不构成误导。

## 待观测

`待观测（human_needed）`：在一次真实内容改动上线之后，用一个此前访问过 dev.ultikits.com 的浏览器 profile 正常导航（不强制刷新、不清缓存、不换 profile），与该次改动的已知内容对照。这一行不能在本 Phase 关闭——本 Phase 已裁决不为验证专门造一次发布，它搭下一次真实内容改动的车验证。关闭它需要：一次后续的真实内容发布之后，维护者本人在一个曾经正常访问过本站的 profile 上，看到该次发布对应的新内容。

可选的搭车项：同一次发布时用一个全新 profile 看一眼 DevTools → Application → Service Workers 是否为空、Cache Storage 有无本站条目，出处标注同样是 `待观测（human_needed）`，且注明源码级证据（见「为什么自毁 worker 与插件永久保留」一节）已足够支撑书面结论，这次观测是加强而非必需。
