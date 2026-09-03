import {navEN} from "./nav.en.mjs";
import {sidebarApiEN, sidebarGuideEN, sidebarGuideEN_v624, sidebarGuideEN_v620, sidebarGuideEN_v610} from "./sidebar.en.mjs";
import {sidebarGuideSnapshotEN, sidebarApiSnapshotEN} from "./sidebar-snapshot.generated.mjs";
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
            ...socialEN
        }
    }
}

export { localeEN }
