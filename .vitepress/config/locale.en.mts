import {LocaleConfig} from "vitepress";
import {DefaultTheme} from "vitepress/theme";
import {navEN} from "./nav.en.mjs";
import {sidebarApiEN, sidebarGuideEN} from "./sidebar.en.mjs";
import {textEN} from "./text.en.mjs";
import {socialEN} from "./social.en.mjs";

const localeEN: LocaleConfig<DefaultTheme.Config> = {
    en: {
        title: 'UltiKits Dev Doc',
        label: 'English',
        lang: 'en-US',
        link: '/en/',
        description: 'Spigot Development Framework',
        themeConfig: {
            nav: navEN,
            sidebar: {
                "/en/guide": sidebarGuideEN,
                "/en/api": sidebarApiEN
            },
            ...textEN,
            ...socialEN
        }
    }
}

export { localeEN }