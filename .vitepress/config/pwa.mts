import {PwaOptions} from "@vite-pwa/vitepress";

// The site has no offline mode; see CACHING.md. selfDestroying makes the build
// emit a small /sw.js that unregisters itself and deletes its caches, which
// rescues readers whose browsers still run the old workbox worker
// (scripts/verify-sw.sh asserts this on every build). With selfDestroying the
// plugin never runs workbox, so workbox, includeAssets, registerType,
// devOptions and experimental.includeAllowlist had no effect and were removed.
// The manifest is kept on purpose (CACHING.md, "为什么 manifest 与图标保留").
const pwaConfig: PwaOptions = {
    selfDestroying: true,
    outDir: '../.vitepress/dist',
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
}

export { pwaConfig }
