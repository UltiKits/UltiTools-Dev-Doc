import {PwaOptions} from "@vite-pwa/vitepress";

const pwaConfig: PwaOptions = {
    registerType: 'prompt',
    outDir: '../.vitepress/dist',
    includeAssets: ['favicon.ico'],
    manifest: {
        name: 'UltiKits Dev Doc',
        short_name: 'UltiKitsDevDoc',
        theme_color: '#ffffff',
        icons: [
            {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    },
    workbox: {
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff2}'],
    },
    devOptions: {
        type: 'module',
        enabled: true,
        suppressWarnings: true,
        navigateFallback: '/',
    },
    experimental: {
        includeAllowlist: true
    }
}

export { pwaConfig }