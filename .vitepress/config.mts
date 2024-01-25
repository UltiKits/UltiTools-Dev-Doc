import {defineConfig} from 'vitepress'
import {withPwa} from '@vite-pwa/vitepress'

import {pwaConfig} from "./config/pwa.mjs";
import {localeZH} from "./config/locale.zh.mjs";
import {localeEN} from "./config/locale.en.mjs";
import {viteConfig} from "./config/vite.mjs";
import {markdownConfig} from "./config/markdown.mjs";
import {themeConfig} from "./config/theme.mjs";

export default withPwa(
    defineConfig({
        srcDir: 'docs',
        lastUpdated: true,
        head: [['link', {rel: 'icon', href: '/favicon.ico'}]],
        sitemap: { hostname: 'https://dev.ultikits.com' },
        locales: { ...localeZH, ...localeEN },
        markdown: markdownConfig,
        pwa: pwaConfig,
        themeConfig: themeConfig,
        ...viteConfig,
    })
)
