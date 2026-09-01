import {navZH} from "./nav.zh.mjs";
import {sidebarApiZH, sidebarApiZH_v625, sidebarGuideZH, sidebarGuideZH_v625, sidebarGuideZH_v624, sidebarGuideZH_v620, sidebarGuideZH_v610} from "./sidebar.zh.mjs";
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
                // v6.2.4 及更早版本继续指向下方冻结的 sidebarApiZH_v625，不指向 live
                // sidebarApiZH —— live 版本在同一次 07-19 文档同步里会变化（弃用页
                // 放到别处、version-wrapper.md 被移除），归档版本不应继承该变化
                // （07-19-PLAN.md, D-26）。
                'v6.2.5/guide/': sidebarGuideZH_v625,
                'v6.2.5/api/': sidebarApiZH_v625,
                'v6.2.4/guide/': sidebarGuideZH_v624,
                'v6.2.4/api/': sidebarApiZH_v625,
                'v6.2.3/guide/': sidebarGuideZH_v624,
                'v6.2.3/api/': sidebarApiZH_v625,
                'v6.2.2/guide/': sidebarGuideZH_v624,
                'v6.2.2/api/': sidebarApiZH_v625,
                'v6.2.1/guide/': sidebarGuideZH_v620,
                'v6.2.1/api/': sidebarApiZH_v625,
                'v6.2.0/guide/': sidebarGuideZH_v620,
                'v6.2.0/api/': sidebarApiZH_v625,
                'v6.1.0/guide/': sidebarGuideZH_v610,
                'v6.1.0/api/': sidebarApiZH_v625,
            },
            ...textCN,
            ...socialZH
        }
    }
}

export { localeZH }
