import DefaultTheme from "vitepress/theme"
import {h, watchEffect} from 'vue'
import {EnhanceAppContext, inBrowser, useData, useRoute} from 'vitepress'

import {
    NolebaseEnhancedReadabilitiesMenu,
    NolebaseEnhancedReadabilitiesScreenMenu,
} from '@nolebase/vitepress-plugin-enhanced-readabilities/client'
import {NolebaseHighlightTargetedHeading,} from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import {NolebaseInlineLinkPreviewPlugin,} from '@nolebase/vitepress-plugin-inline-link-preview/client'
import {NolebaseGitChangelogPlugin} from '@nolebase/vitepress-plugin-git-changelog/client'

import {enhanceAppWithTabs} from 'vitepress-plugin-tabs/client'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'
import vitepressBackToTop from 'vitepress-plugin-back-to-top'
import vitepressNprogress from 'vitepress-plugin-nprogress'
import codeblocksFold from 'vitepress-plugin-codeblocks-fold'
import imageViewer from 'vitepress-plugin-image-viewer';

import 'vitepress-plugin-codeblocks-fold/style/index.scss';
import 'vitepress-plugin-back-to-top/dist/style.css'
import 'vitepress-plugin-nprogress/lib/css/index.css'
import '@nolebase/vitepress-plugin-enhanced-readabilities/client/style.css'
import '@nolebase/vitepress-plugin-highlight-targeted-heading/client/style.css'
import '@nolebase/vitepress-plugin-inline-link-preview/client/style.css'
import '@nolebase/vitepress-plugin-git-changelog/client/style.css'
import 'virtual:group-icons.css'
import 'viewerjs/dist/viewer.min.css';
import './styles/main.css'

// @ts-ignore
import vImageViewer from 'vitepress-plugin-image-viewer/lib/vImageViewer.vue';
// @ts-ignore
import ReloadPrompt from './components/ReloadPrompt.vue'
// @ts-ignore
import VersionCard from "./components/VersionCard.vue";

// noinspection JSUnusedGlobalSymbols
export default {
    ...DefaultTheme,
    Layout() {
        const {lang} = useData()
        if (inBrowser) {
            document.cookie = `nf_lang=${lang.value}; expires=Mon, 1 Jan 2030 00:00:00 UTC; path=/`
        }

        watchEffect(() => {
            const {lang} = useData()
            const {frontmatter} = useData();
            const route = useRoute();

            let language = lang.value.split('-')[0];
            if (language === 'zh') {
                language = 'zh-CN'
            }
            // Obtain configuration from: https://giscus.app/
            giscusTalk({
                    repo: 'UltiKits/UltiTools-Dev-Doc',
                    repoId: 'R_kgDOKHynCA',
                    category: 'General',
                    categoryId: 'DIC_kwDOKHynCM4Cb4Le',
                    mapping: 'pathname',
                    inputPosition: 'top',
                    lang: `${language}`,
                    lightTheme: 'light',
                    darkTheme: 'transparent_dark',
                    // ...
                }, {
                    frontmatter, route
                },
                true
            );
        })
        return h(DefaultTheme.Layout, null, {
            'nav-bar-content-after': () => h(NolebaseEnhancedReadabilitiesMenu),
            'nav-screen-content-after': () => h(NolebaseEnhancedReadabilitiesScreenMenu),
            'layout-top': () => h(NolebaseHighlightTargetedHeading),
            'layout-bottom': () => h(ReloadPrompt),
            'sidebar-nav-before': () => h(VersionCard)
        })
    },
    enhanceApp: (ctx: EnhanceAppContext) => {
        vitepressNprogress(ctx)
        enhanceAppWithTabs(ctx.app)
        vitepressBackToTop()
        ctx.app.use(NolebaseInlineLinkPreviewPlugin)
        ctx.app.use(NolebaseGitChangelogPlugin)
        ctx.app.component('vImageViewer', vImageViewer);
    },
    setup() {
        // Get frontmatter and route
        const {frontmatter} = useData();
        const route = useRoute();

        codeblocksFold({route, frontmatter}, false, 400);
        imageViewer(route);

        const {lang} = useData()
        let language = lang.value.split('-')[0];
        if (language === 'zh') {
            language = 'zh-CN'
        }
        // Obtain configuration from: https://giscus.app/
        giscusTalk({
                repo: 'UltiKits/UltiTools-Dev-Doc',
                repoId: 'R_kgDOKHynCA',
                category: 'General',
                categoryId: 'DIC_kwDOKHynCM4Cb4Le',
                mapping: 'pathname',
                inputPosition: 'top',
                lang: `${language}`,
                lightTheme: 'light',
                darkTheme: 'transparent_dark',
                // ...
            }, {
                frontmatter, route
            },
            true
        );
    }
}
