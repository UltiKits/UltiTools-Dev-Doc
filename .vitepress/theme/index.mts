import DefaultTheme from "vitepress/theme"
import { h } from 'vue'
import { EnhanceAppContext } from 'vitepress'

import {
  NolebaseEnhancedReadabilitiesMenu,
  NolebaseEnhancedReadabilitiesScreenMenu,
} from '@nolebase/vitepress-plugin-enhanced-readabilities'
import {
  NolebaseHighlightTargetedHeading,
} from '@nolebase/vitepress-plugin-highlight-targeted-heading'
import {
  NolebaseInlineLinkPreviewPlugin,
} from '@nolebase/vitepress-plugin-inline-link-preview'

import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'
import { useData, useRoute } from 'vitepress';
import vitepressBackToTop from 'vitepress-plugin-back-to-top'
import vitepressNprogress from 'vitepress-plugin-nprogress'
import codeblocksFold from 'vitepress-plugin-codeblocks-fold'

import 'vitepress-plugin-codeblocks-fold/style/index.scss';
import 'vitepress-plugin-back-to-top/dist/style.css'
import 'vitepress-plugin-nprogress/lib/css/index.css'
import '@nolebase/vitepress-plugin-enhanced-readabilities/dist/style.css'
import '@nolebase/vitepress-plugin-highlight-targeted-heading/dist/style.css'
import '@nolebase/vitepress-plugin-inline-link-preview/dist/style.css'
import './styles/main.css'

// @ts-ignore
import ReloadPrompt from './components/ReloadPrompt.vue'

// noinspection JSUnusedGlobalSymbols
export default {
  ...DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(NolebaseEnhancedReadabilitiesMenu),
      'nav-screen-content-after': () => h(NolebaseEnhancedReadabilitiesScreenMenu),
      'layout-top': () => h(NolebaseHighlightTargetedHeading),
      'layout-bottom': () => h(ReloadPrompt),
    })
  },
  enhanceApp: (ctx: EnhanceAppContext) => {
    vitepressNprogress(ctx)
    enhanceAppWithTabs(ctx.app)
    vitepressBackToTop()
    ctx.app.use(NolebaseInlineLinkPreviewPlugin)
  },
  setup() {
    // Get frontmatter and route
    const { frontmatter } = useData();
    const route = useRoute();

    codeblocksFold({ route, frontmatter }, true, 400);

    // Obtain configuration from: https://giscus.app/
    giscusTalk({
        repo: 'UltiKits/UltiTools-Dev-Doc',
        repoId: 'R_kgDOKHynCA',
        category: 'General',
        categoryId: 'DIC_kwDOKHynCM4Cb4Le',
        mapping: 'pathname',
        inputPosition: 'top',
        lang: 'zh-CN',
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