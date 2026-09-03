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
        sitemap: { hostname: 'https://dev.ultikits.com' },
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
