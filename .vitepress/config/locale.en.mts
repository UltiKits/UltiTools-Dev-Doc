import {navEN} from "./nav.en.mjs";
import {sidebarApiEN, sidebarGuideEN, sidebarGuideEN_v610} from "./sidebar.en.mjs";
import {textEN} from "./text.en.mjs";
import {socialEN} from "./social.en.mjs";

const localeEN = {
    root: {
        title: 'UltiKits Dev Doc',
        label: 'English',
        lang: 'en-US',
        description: 'Spigot Development Framework',
        themeConfig: {
            nav: navEN,
            sidebar: {
                '/guide/': sidebarGuideEN,
                '/api/': sidebarApiEN,
                'v6.1.0/guide/': sidebarGuideEN_v610,
                'v6.1.0/api/': sidebarApiEN,
            },
            ...textEN,
            ...socialEN
        }
    }
}

export { localeEN }
