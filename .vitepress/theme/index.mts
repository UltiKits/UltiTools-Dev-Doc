import DefaultTheme from "vitepress/theme"
import { EnhanceAppContext, useData, useRoute } from 'vitepress'

import { NolebaseInlineLinkPreviewPlugin, } from '@nolebase/vitepress-plugin-inline-link-preview/client'
import { NolebaseGitChangelogPlugin } from '@nolebase/vitepress-plugin-git-changelog/client'
// @ts-ignore
import GitChangelogClientOnly from './components/GitChangelogClientOnly.vue'

import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
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
// This site's own wrapper (04-03-PLAN.md), not @viteplus/versions' own
// version-switcher.component.vue — that upstream component's path builder
// emits a measured-404 shape on this site's Chinese pages and its mobile
// accordion hardcodes its own label. Registered below under the name
// 'VersionSwitcher', not the file's own name 'UtVersionSwitcher': nav.en.mts
// and nav.zh.mts, SecondNavBar.vue's component branch, and VitePress's own
// VPNavScreenMenu component branch all resolve `component: 'VersionSwitcher'`
// against this registered global name, so keeping it unchanged means none of
// those three needed an edit when the import target moved. Do not "fix" this
// mismatch — it is deliberate.
import VersionSwitcher from './components/UtVersionSwitcher.vue'
import Layout from './Layout.vue'

// noinspection JSUnusedGlobalSymbols
export default {
    ...DefaultTheme,
    Layout,
    enhanceApp: (ctx: EnhanceAppContext) => {
        vitepressNprogress(ctx)
        enhanceAppWithTabs(ctx.app)
        vitepressBackToTop()
        ctx.app.use(NolebaseInlineLinkPreviewPlugin)
        ctx.app.use(NolebaseGitChangelogPlugin)
        // 必须在 use(NolebaseGitChangelogPlugin) 之后：这一行按同名覆盖插件注册
        // 的全局组件，把 changelog 整块移出服务端渲染。理由与实测见
        // components/GitChangelogClientOnly.vue 的头注释。GitChangelogMarkdownSection
        // 往每个 markdown 里插的是字面量 <NolebaseGitChangelog />，所以覆盖点
        // 就是这个名字。
        ctx.app.component('NolebaseGitChangelog', GitChangelogClientOnly);
        ctx.app.component('vImageViewer', vImageViewer);
        ctx.app.component('VersionSwitcher', VersionSwitcher);
    },
    setup() {
        // Get frontmatter and route
        const { frontmatter } = useData();
        const route = useRoute();

        codeblocksFold({ route, frontmatter }, false, 400);
        imageViewer(route);

        const { lang } = useData()
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
