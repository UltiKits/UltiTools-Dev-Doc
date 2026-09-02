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
        ignoreDeadLinks: [/^\/api\/index$/],
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
