import { defineVersionedConfig } from '@viteplus/versions'
import { withPwa } from '@vite-pwa/vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

import { pwaConfig } from "./config/pwa.mjs";
import { localeZH } from "./config/locale.zh.mjs";
import { localeEN } from "./config/locale.en.mjs";
import { viteConfig } from "./config/vite.mjs";
import { markdownConfig } from "./config/markdown.mjs";
import { themeConfig } from "./config/theme.mjs";

export default withPwa(
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
