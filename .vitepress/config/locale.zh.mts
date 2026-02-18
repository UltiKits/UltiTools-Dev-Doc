import {navZH} from "./nav.zh.mjs";
import {sidebarApiZH, sidebarGuideZH, sidebarGuideZH_v610} from "./sidebar.zh.mjs";
import {textCN} from "./text.zh.mjs";
import {socialZH} from "./social.zh.mjs";

const localeZH = {
    zh: {
        title: 'UltiKits 开发文档',
        label: '简体中文',
        lang: 'zh-CN',
        link: '/zh/',
        description: 'Spigot 开发框架',
        themeConfig: {
            nav: navZH,
            sidebar: {
                '/guide/': sidebarGuideZH,
                '/api/': sidebarApiZH,
                'v6.2.0/guide/': sidebarGuideZH,
                'v6.2.0/api/': sidebarApiZH,
                'v6.1.0/guide/': sidebarGuideZH_v610,
                'v6.1.0/api/': sidebarApiZH,
            },
            ...textCN,
            ...socialZH
        }
    }
}

export { localeZH }
