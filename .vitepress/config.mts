import { defineVersionedConfig } from '@viteplus/versions'
import { withPwa } from '@vite-pwa/vitepress'

import { pwaConfig } from "./config/pwa.mjs";
import { localeZH } from "./config/locale.zh.mjs";
import { localeEN } from "./config/locale.en.mjs";
import { viteConfig } from "./config/vite.mjs";
import { markdownConfig } from "./config/markdown.mjs";
import { themeConfig } from "./config/theme.mjs";

export default withPwa(
    // 依赖树里有两份 vitepress：根上的 1.6.4，与 @viteplus/versions 自带的
    // 2.0.0-alpha.16（它把 vitepress 同时写进 dependencies 与 peerDependencies，
    // 前者强制了那份嵌套副本）。本文件的配置用根上那份的类型写成，而
    // defineVersionedConfig 的参数类型来自嵌套那份，两个 UserConfig 是不同的
    // 名义类型，TypeScript 因此拒绝。运行时没有这个问题：@viteplus/versions 的
    // 运行时产物 dist/index.js 里没有任何 vitepress 引用（实测），那份嵌套副本
    // 只参与类型解析。
    //
    // 去重不可行，四种 npm overrides 写法实测：
    //   {"vitepress": "1.6.4"}                     → EOVERRIDE，与直接依赖冲突
    //   {"vitepress": "$vitepress"}                → 退 0，嵌套副本纹丝不动
    //   {"@viteplus/versions": {"vitepress": ...}} → 退 0，静默忽略；连删掉嵌套
    //                                                目录后完整安装也会装回来
    // 对照组：给 nanoid 加同样形式的 override 生效了，所以不是 overrides 在这个
    // 项目里整体失效，而是这一条被 npm 忽略。真正的修法在上游。
    //
    // 用 @ts-expect-error 而不是 as any：前者会在错误消失时自己报
    // 「未使用的指令」，逼人回来删掉；后者会永远沉默。它也只作用于下一行，
    // 本文件其余部分照常被检查。
    // @ts-expect-error 两份 vitepress 的 UserConfig 是不同的名义类型
    defineVersionedConfig({
        srcDir: 'docs',
        lastUpdated: true,
        // /api/ is proxied at request time by the Cloudflare Pages Function
        // (functions/api/[[path]].js) and is never a VitePress-rendered page —
        // no docs/src/api/index.md exists or should exist (01-04-PLAN.md D-13/D-14).
        // The dead-link checker resolves a trailing-slash link to "<path>/index",
        // so this ignores exactly that one resolved path and nothing deeper under /api/.
        //
        // v6.3.0-SNAPSHOT is alpha's own content, injected at build time
        // (scripts/inject-alpha.mjs). Defects in that content are alpha's own —
        // they're fixed via the framework repo's doc-sync flow, not this site's
        // build — so they must not block a site-class deploy that has nothing to
        // do with the content itself (D-39, 03-CONTEXT.md).
        //
        // VitePress's dead-link checker calls its ignore predicate as
        // ignore(url) — the target URL only, never the linking page
        // (shouldIgnoreDeadLink, node_modules/vitepress/dist/node/
        // chunk-D3CUZ4fa.js). An earlier version of this exemption tried to
        // infer "this link came from SNAPSHOT content" from the URL alone (by
        // checking whether a same-path page existed under
        // docs/archive/v6.3.0-SNAPSHOT/) and claimed in this comment that the
        // result "cannot mask a dead link anywhere else on the site". That
        // claim was false and was caught in code review (03-REVIEW.md CR-01):
        // any absolute link anywhere on the site — latest, or any of the six
        // already-released archived versions — whose target path happened to
        // coincide with a SNAPSHOT-only page (docs/archive/v6.3.0-SNAPSHOT/'s
        // page set diverges from master's by 8 paths as of this writing) would
        // have been silently exempted too, with no CI signal, the moment
        // build:with-alpha ran.
        //
        // The fix moves the provenance into the URL itself instead of trying
        // to infer it: scripts/inject-alpha.mjs now rewrites every absolute
        // body link inside the injected markdown to carry the
        // /v6.3.0-SNAPSHOT/ prefix unconditionally (its own "step 5b", the
        // same technique as its <<< @/../examples/ snippet rewrite, with the
        // same zero-residual assertion). With that in place, a single regex
        // anchored to the SNAPSHOT prefix is exactly scoped by construction —
        // it can only ever match a URL this injection step itself produced —
        // and needs no per-URL filesystem lookup or function predicate.
        ignoreDeadLinks: [/^\/api\/index$/, /^\/(?:[a-z]{2}\/)?v6\.3\.0-SNAPSHOT\//],
        head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
        // v6.3.0-SNAPSHOT is unreleased content injected at build time
        // (scripts/inject-alpha.mjs) — it may change tomorrow, and a reader
        // landing on it from a search result has no way to tell that (D-48,
        // 03-CONTEXT.md), the same direction as Phase 1's D-05 (`/api/*`
        // gets X-Robots-Tag: noindex). vitepress's generateSitemap does
        // `items = await sitemap?.transformItems?.(items) || items` right
        // before writing the stream (node_modules/vitepress/dist/node/
        // chunk-D3CUZ4fa.js, 1.6.4) — item.url is already a full path segment
        // like 'zh/v6.2.4/guide/introduction'. The Chinese archive is served at
        // /{locale}/{version}/..., so the filter has to match the version
        // segment wherever it sits rather than only at the start.
        // This is a new exception, not a continuation of existing behaviour:
        // the six already-released archived versions get neither canonical
        // nor noindex today and are 85% of this sitemap — that's a
        // site-wide SEO decision out of this Phase's scope (03-CONTEXT.md
        // Deferred Ideas), not extended here.
        //
        // Filtering item.url alone is not enough: generateSitemap groups
        // every page sharing the same path across all versions/locales and,
        // when a page has 2+ such siblings, stamps each item with
        // `links: pages2` — the *entire* sibling group, rendered as
        // <xhtml:link rel="alternate"> tags (real-build finding: v6.2.0's
        // own api/ulti-tools-plugin.html item carried an alternate link to
        // v6.3.0-SNAPSHOT/api/ulti-tools-plugin.html even after item.url
        // filtering removed SNAPSHOT's own top-level item). Each surviving
        // item's links array needs the same prefix filter, or SNAPSHOT keeps
        // leaking in through every other version's alternate-language tags.
        //
        // The prefix test has to be locale-aware. Chinese archived pages used to
        // be emitted as `v6.3.0-SNAPSHOT/zh/...`, which a `startsWith('v6.3.0-SNAPSHOT/')`
        // test catches. They are now emitted as `zh/v6.3.0-SNAPSHOT/...`, which it
        // does not: a locale-blind test let 28 Chinese SNAPSHOT <loc> entries into
        // the sitemap (337 -> 365), publishing unreleased content that the filter
        // exists to keep unindexed. Matching the version segment wherever it sits
        // covers both shapes and any locale added later.
        sitemap: {
            hostname: 'https://dev.ultikits.com',
            transformItems: (items) => {
                const isSnapshot = (url: string) => /(^|\/)v6\.3\.0-SNAPSHOT\//.test(url);

                return items
                    .filter((item) => !isSnapshot(item.url))
                    .map((item) => item.links
                        ? { ...item, links: item.links.filter((link) => !isSnapshot(link.url)) }
                        : item
                    );
            },
        },
        locales: { ...localeZH, ...localeEN },
        markdown: markdownConfig,
        pwa: pwaConfig,
        themeConfig: themeConfig,
        ...viteConfig,

        versionsConfig: {
            current: 'v6.2.5',
            sources: 'src',
            archive: 'archive',
            // `false`, not an object and not omitted. @viteplus/versions'
            // versionSwitcher() checks exactly this sentinel
            // (dist/index.js: `if(e.versionSwitcher===!1)return;`) to skip
            // auto-injecting its static-label nav group. That group renders
            // VPFlyout with :button="item.text" — a build-time string with no
            // per-page value — so it is structurally incapable of satisfying
            // VER-04 (04-UI-SPEC.md § Version Switcher Contract, "Resolved
            // Implementation Findings"). The wrapper registered as
            // UtVersionSwitcher in nav.en.mts/nav.zh.mts replaces it instead.
            versionSwitcher: false
        }
    })
)
