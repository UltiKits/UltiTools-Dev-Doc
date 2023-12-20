import DefaultTheme from "vitepress/theme"

import { h } from 'vue'
import { EnhanceAppContext } from 'vitepress'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import {
  NolebaseEnhancedReadabilitiesMenu,
  NolebaseEnhancedReadabilitiesScreenMenu,
} from '@nolebase/vitepress-plugin-enhanced-readabilities'
import giscusTalk from 'vitepress-plugin-comment-with-giscus';
import { useData, useRoute } from 'vitepress';
import '@nolebase/vitepress-plugin-enhanced-readabilities/dist/style.css'
import vitepressNprogress from 'vitepress-plugin-nprogress'
import 'vitepress-plugin-nprogress/lib/css/index.css'
import './styles/main.css'

// noinspection JSUnusedGlobalSymbols
export default {
  ...DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(NolebaseEnhancedReadabilitiesMenu),
      'nav-screen-content-after': () => h(NolebaseEnhancedReadabilitiesScreenMenu),
    })
  },
  enhanceApp: (ctx: EnhanceAppContext) => {
    vitepressNprogress(ctx)
    enhanceAppWithTabs(ctx.app)
  },
  setup() {
    // Get frontmatter and route
    const { frontmatter } = useData();
    const route = useRoute();

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