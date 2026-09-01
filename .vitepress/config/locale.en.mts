import {navEN} from "./nav.en.mjs";
import {sidebarApiEN, sidebarApiEN_v625, sidebarGuideEN, sidebarGuideEN_v625, sidebarGuideEN_v624, sidebarGuideEN_v620, sidebarGuideEN_v610} from "./sidebar.en.mjs";
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
                // v6.2.4 and earlier keep pointing at the frozen sidebarApiEN_v625 below,
                // not the live sidebarApiEN -- the live one changes in the same 07-19 doc
                // sync (a deprecations page is added elsewhere, version-wrapper.md is
                // removed), and archived versions must not inherit that change
                // (07-19-PLAN.md, D-26).
                'v6.2.5/guide/': sidebarGuideEN_v625,
                'v6.2.5/api/': sidebarApiEN_v625,
                'v6.2.4/guide/': sidebarGuideEN_v624,
                'v6.2.4/api/': sidebarApiEN_v625,
                'v6.2.3/guide/': sidebarGuideEN_v624,
                'v6.2.3/api/': sidebarApiEN_v625,
                'v6.2.2/guide/': sidebarGuideEN_v624,
                'v6.2.2/api/': sidebarApiEN_v625,
                'v6.2.1/guide/': sidebarGuideEN_v620,
                'v6.2.1/api/': sidebarApiEN_v625,
                'v6.2.0/guide/': sidebarGuideEN_v620,
                'v6.2.0/api/': sidebarApiEN_v625,
                'v6.1.0/guide/': sidebarGuideEN_v610,
                'v6.1.0/api/': sidebarApiEN_v625,
            },
            ...textEN,
            ...socialEN
        }
    }
}

export { localeEN }
