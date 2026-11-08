import type { LocaleConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress/theme'
import {navZH} from "./nav.zh.mjs";
import {sidebarApiZH, sidebarGuideZH, sidebarGuideZH_v631, sidebarGuideZH_v630, sidebarGuideZH_v625, sidebarGuideZH_v624, sidebarGuideZH_v620, sidebarGuideZH_v610} from "./sidebar.zh.mjs";
import {sidebarGuideSnapshotZH, sidebarApiSnapshotZH, snapshotVersion} from "./sidebar-snapshot.generated.mjs";
import {archiveSidebarEntries} from "./archive-sidebars.mjs";
import {textCN} from "./text.zh.mjs";
import {socialZH} from "./social.zh.mjs";

// 显式标注，不靠结构推断。没有标注时 themeConfig 里写错的形状不会被发现——
// 曾经把 SocialLink[] 用展开写进 themeConfig，两条链接落成数字键 0 与 1，
// 导航栏的社交图标因此从未渲染过，而类型检查一声不吭。
const localeZH: LocaleConfig<DefaultTheme.Config> = {
    zh: {
        title: 'UltiKits 开发文档',
        label: '简体中文',
        lang: 'zh-CN',
        description: 'Paper 插件框架',
        themeConfig: {
            nav: navZH,
            sidebar: {
                '/guide/': sidebarGuideZH,
                // The alpha snapshot label is derived at injection time from the
                // framework's main-branch pom (scripts/inject-alpha.mjs); with
                // nothing injected there is no snapshot tree and no key.
                ...(snapshotVersion ? {
                    [`${snapshotVersion}/guide/`]: sidebarGuideSnapshotZH,
                    [`${snapshotVersion}/api/`]: sidebarApiSnapshotZH,
                } : {}),
                // Archived versions: the version -> sidebar mapping lives only in
                // archive-sidebars.mjs, which scripts/check-sidebar-links.sh reads too.
                // It throws when a docs/archive/v* directory has no row.
                ...archiveSidebarEntries({
                    guideConstants: {
                        v631: sidebarGuideZH_v631,
                        v630: sidebarGuideZH_v630,
                        v625: sidebarGuideZH_v625,
                        v624: sidebarGuideZH_v624,
                        v620: sidebarGuideZH_v620,
                        v610: sidebarGuideZH_v610,
                    },
                    apiShared: sidebarApiZH,
                    snapshotVersion,
                }),
            },
            ...textCN,
            // socialLinks，不是展开。socialZH 的类型是 DefaultTheme.SocialLink[]——
            // 把数组展开进对象会让两条链接落成 themeConfig 上的数字键 0 与 1，
            // 而 VitePress 读的是 theme.socialLinks（VPNavBarSocialLinks.vue:10,12 与
            // VPNavScreenSocialLinks.vue:10,12，都带 v-if="theme.socialLinks" 守卫）。
            // 实测：改之前产物里 VPNavBarSocialLinks 与 VPNavScreenSocialLinks 各 0 次，
            // 导航栏的 GitHub 与 Discord 图标从未渲染过。
            socialLinks: socialZH
        }
    }
}

export { localeZH }
