import type { LocaleConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress/theme'
import {navEN} from "./nav.en.mjs";
import {sidebarApiEN, sidebarGuideEN, sidebarGuideEN_v624, sidebarGuideEN_v620, sidebarGuideEN_v610} from "./sidebar.en.mjs";
import {sidebarGuideSnapshotEN, sidebarApiSnapshotEN} from "./sidebar-snapshot.generated.mjs";
import {textEN} from "./text.en.mjs";
import {socialEN} from "./social.en.mjs";

// 显式标注，不靠结构推断。没有标注时 themeConfig 里写错的形状不会被发现——
// 曾经把 SocialLink[] 用展开写进 themeConfig，两条链接落成数字键 0 与 1，
// 导航栏的社交图标因此从未渲染过，而类型检查一声不吭。
const localeEN: LocaleConfig<DefaultTheme.Config> = {
    root: {
        title: 'UltiKits Dev Doc',
        label: 'English',
        lang: 'en-US',
        description: 'Spigot Development Framework',
        themeConfig: {
            nav: navEN,
            sidebar: {
                '/guide/': sidebarGuideEN,
                'v6.3.0-SNAPSHOT/guide/': sidebarGuideSnapshotEN,
                'v6.3.0-SNAPSHOT/api/': sidebarApiSnapshotEN,
                'v6.2.4/guide/': sidebarGuideEN_v624,
                'v6.2.4/api/': sidebarApiEN,
                'v6.2.3/guide/': sidebarGuideEN_v624,
                'v6.2.3/api/': sidebarApiEN,
                'v6.2.2/guide/': sidebarGuideEN_v624,
                'v6.2.2/api/': sidebarApiEN,
                'v6.2.1/guide/': sidebarGuideEN_v620,
                'v6.2.1/api/': sidebarApiEN,
                'v6.2.0/guide/': sidebarGuideEN_v620,
                'v6.2.0/api/': sidebarApiEN,
                'v6.1.0/guide/': sidebarGuideEN_v610,
                'v6.1.0/api/': sidebarApiEN,
            },
            ...textEN,
            // socialLinks，不是展开。socialEN 的类型是 DefaultTheme.SocialLink[]——
            // 把数组展开进对象会让两条链接落成 themeConfig 上的数字键 0 与 1，
            // 而 VitePress 读的是 theme.socialLinks（VPNavBarSocialLinks.vue:10,12 与
            // VPNavScreenSocialLinks.vue:10,12，都带 v-if="theme.socialLinks" 守卫）。
            // 实测：改之前产物里 VPNavBarSocialLinks 与 VPNavScreenSocialLinks 各 0 次，
            // 导航栏的 GitHub 与 Discord 图标从未渲染过。
            socialLinks: socialEN
        }
    }
}

export { localeEN }
