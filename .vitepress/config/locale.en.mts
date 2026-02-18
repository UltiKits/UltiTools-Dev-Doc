import {navEN} from "./nav.en.mjs";
import {sidebarApiEN, sidebarGuideEN, sidebarGuideEN_v620, sidebarGuideEN_v610} from "./sidebar.en.mjs";
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
                'v6.2.1/guide/': sidebarGuideEN_v620,
                'v6.2.1/api/': sidebarApiEN,
                'v6.2.0/guide/': sidebarGuideEN_v620,
                'v6.2.0/api/': sidebarApiEN,
                'v6.1.0/guide/': sidebarGuideEN_v610,
                'v6.1.0/api/': sidebarApiEN,
            },
            ...textEN,
            ...socialEN
        }
    }
}

export { localeEN }
