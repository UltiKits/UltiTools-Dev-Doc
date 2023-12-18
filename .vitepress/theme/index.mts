import DefaultTheme from "vitepress/theme"

import { h } from 'vue'
import vitepressNprogress from 'vitepress-plugin-nprogress'
import 'vitepress-plugin-nprogress/lib/css/index.css'
import Layout from './Layout.vue'

export default {
  ...DefaultTheme,
  Layout() {
    return h(Layout, null, {})
  },
  enhanceApp: (ctx) => {
    vitepressNprogress(ctx)
  }
}