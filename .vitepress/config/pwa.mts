import type { PwaOptions } from '@vite-pwa/vitepress'
import { fileURLToPath } from 'node:url'

// PWA 2 已移除构建期 selfDestroying 策略。保留无离线能力的永久卸载入口，
// 用受支持的 buildSW 构建自有脚本，并明确停用预缓存注入。依据见 CACHING.md。
// 原生注册由 ReloadPrompt.vue 负责，插件仍产出 manifest 与同名 classic worker。
const pwaConfig = {
    strategies: 'buildSW',
    swType: 'classic',
    filename: 'sw.js',
    scope: '/',
    injectRegister: false,
    updateViaCache: 'none',
    minify: false,
    buildSW: {
        swSrc: fileURLToPath(new URL('../../docs/public/sw.js', import.meta.url)),
        injectionPoint: false,
    },
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
} satisfies Partial<PwaOptions<'buildSW', 'classic'>>

export { pwaConfig }
