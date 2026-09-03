import { existsSync } from 'node:fs'
import { defineVersionedConfig } from '@viteplus/versions'
import { withPwa } from '@vite-pwa/vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

import { pwaConfig } from "./config/pwa.mjs";
import { localeZH } from "./config/locale.zh.mjs";
import { localeEN } from "./config/locale.en.mjs";
import { viteConfig } from "./config/vite.mjs";
import { markdownConfig } from "./config/markdown.mjs";
import { themeConfig } from "./config/theme.mjs";

// @viteplus/versions only rewrites sidebar and nav links to carry a version
// prefix (populateSidebar/populateNav in node_modules/@viteplus/versions/
// dist/index.js) — it never touches links written inside markdown body text.
// alpha's own content can (and, verified via a real build, does) contain
// absolute body links like /api/version-wrapper that resolved fine on the
// branch alpha forked from, but point at a page Phase 1 removed from this
// site's current /api/ namespace. That is exactly the class of alpha
// content defect D-39 says must not block a site-class deploy (03-CONTEXT.md)
// — it isn't ours to fix, doc-sync owns it. This check is scoped tightly: it
// only exempts a dead link when a same-path page genuinely exists inside the
// injected docs/archive/v6.3.0-SNAPSHOT/ tree (proving the link is a
// SNAPSHOT-content cross-reference, not a real site-wide dead link), so it
// cannot mask a dead link anywhere else on the site.
function isDeadLinkResolvableInSnapshot(url: string): boolean {
    const clean = url.replace(/[?#].*$/, '')
    const zhMatch = clean.match(/^\/zh\/(.+)$/)
    const relPath = zhMatch ? `zh/${zhMatch[1]}` : clean.replace(/^\//, '')
    if (!relPath) return false
    const base = `docs/archive/v6.3.0-SNAPSHOT/${relPath}`
    return existsSync(`${base}.md`) || existsSync(`${base}/index.md`)
}

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
        // do with the content itself (D-39, 03-CONTEXT.md). The regex exemption
        // covers version-prefixed links (sidebar/nav, rewritten by
        // @viteplus/versions); the function exemption covers unprefixed absolute
        // body links written inside alpha's own markdown (see
        // isDeadLinkResolvableInSnapshot above for why body links need a
        // separate check). Both are scoped strictly to SNAPSHOT content;
        // dead-link checking for the rest of the site is unchanged.
        ignoreDeadLinks: [/^\/api\/index$/, /^\/v6\.3\.0-SNAPSHOT\//, isDeadLinkResolvableInSnapshot],
        head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
        // v6.3.0-SNAPSHOT is unreleased content injected at build time
        // (scripts/inject-alpha.mjs) — it may change tomorrow, and a reader
        // landing on it from a search result has no way to tell that (D-48,
        // 03-CONTEXT.md), the same direction as Phase 1's D-05 (`/api/*`
        // gets X-Robots-Tag: noindex). vitepress's generateSitemap does
        // `items = await sitemap?.transformItems?.(items) || items` right
        // before writing the stream (node_modules/vitepress/dist/node/
        // chunk-D3CUZ4fa.js, 1.6.4) — item.url is already a full path segment
        // like 'v6.2.4/zh/guide/introduction' (verified against production:
        // the Chinese archive is served at /{version}/zh/..., not
        // /zh/{version}/...), so one prefix filter covers both locales.
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
        sitemap: {
            hostname: 'https://dev.ultikits.com',
            transformItems: (items) => items
                .filter((item) => !item.url.startsWith('v6.3.0-SNAPSHOT/'))
                .map((item) => item.links
                    ? { ...item, links: item.links.filter((link) => !link.url.startsWith('v6.3.0-SNAPSHOT/')) }
                    : item
                ),
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
            versionSwitcher: {
                text: 'API Version',
                includeCurrentVersion: true
            }
        }
    })
)
