import {LocaleConfig} from "vitepress";
import {DefaultTheme} from "vitepress/theme";
import {navZH} from "./nav.zh.mjs";
import {sidebarApiZH, sidebarGuideZH} from "./sidebar.zh.mjs";
import {textCN} from "./text.zh.mjs";
import {socialZH} from "./social.zh.mjs";

const localeZH: LocaleConfig<DefaultTheme.Config> = {
    zh: {
        title: 'UltiKits 开发文档',
        label: '简体中文',
        lang: 'zh-CN',
        link: '/zh/',
        description: 'Spigot 开发框架',
        themeConfig: {
            nav: navZH,
            sidebar: {
                "/zh/guide/": sidebarGuideZH,
                "/zh/api/": sidebarApiZH
            },
            ...textCN,
            ...socialZH
        }
    }
}

export { localeZH }