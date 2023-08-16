import { defineConfigWithTheme } from 'vitepress'
import type { Config as ThemeConfig } from 'vitepress-theme-vue'
// @ts-ignore
import baseConfig from 'vitepress-theme-vue/config'
import { headerPlugin } from './headerMdPlugin'

const nav: ThemeConfig['nav'] = [
  {
    text: '文档 (v6.0.0)',
    activeMatch: `^/guide/`,
    items: [
      { text: '深度指南', link: '/guide/introduction' },
      { text: '快速上手', link: '/guide/quick-start' },
    ]
  },
  {
    text: '用户文档',
    link: 'https://ultitools.doc.ultikits.com'
  },
]

export const sidebar: ThemeConfig['sidebar'] = {
  '/guide/': [
    {
      text: '开始',
      items: [
        {
          text: '简介',
          link: '/guide/introduction'
        },
        {
          text: '快速上手',
          link: '/guide/quick-start'
        }
      ]
    },
    {
      text: '基础',
      items: [
        {
          text: '命令执行器',
          link: '/guide/essentials/cmd-executor'
        },
        {
          text: '事件监听器',
          link: '/guide/essentials/event-listener'
        },
        {
          text: '配置文件',
          link: '/guide/essentials/config-file'
        },
        {
          text: '数据储存',
          link: '/guide/essentials/data-storage'
        },
        {
          text: 'I18n 多语言',
          link: '/guide/essentials/i18n'
        },
      ]
    }
  ]
}

const i18n: ThemeConfig['i18n'] = {
  search: '搜索',
  menu: '菜单',
  toc: '本页目录',
  returnToTop: '返回顶部',
  appearance: '外观',
  previous: '前一篇',
  next: '下一篇',
  pageNotFound: '页面未找到',
  deadLink: {
    before: '你打开了一个不存在的链接：',
    after: '。'
  },
  deadLinkReport: {
    before: '不介意的话请提交到',
    link: '这里',
    after: '，我们会跟进修复。'
  },
  footerLicense: {
    before: '',
    after: ''
  },
  ariaDarkMode: '切换深色模式',
  ariaSkipToContent: '直接跳到内容',
  ariaToC: '当前页面的目录',
  ariaMainNav: '主导航',
  ariaMobileNav: '移动版导航',
  ariaSidebarNav: '侧边栏导航',
}

export default defineConfigWithTheme<ThemeConfig>({
  extends: baseConfig,

  lang: 'zh-CN',
  title: 'UltiTools API 开发文档',
  description: 'UltiTools API 开发文档',
  srcDir: 'src',
  scrollOffset: 'header',
  lastUpdated: true,

  themeConfig: {
    nav,
    sidebar,
    i18n,

    localeLinks: [
      {
        link: '/',
        text: '简体中文',
        repo: 'https://github.com/UltiKits/UltiTools-User-Doc'
      },
      {
        link: 'UltiKits/UltiTools-Dev-Doc',
        text: '帮助我们翻译！',
        isTranslationsDesc: true
      }
    ],

    algolia: {
      indexName: 'ultikits',
      appId: '8D12CWPS3U',
      apiKey: '8dfc6d2cbe56024cb3906cf802f2cce7',
      searchParameters: {
        //
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/UltiKits' },
      { icon: 'discord', link: 'https://discord.gg/P3fpQSRPGu' }
    ],

    editLink: {
      repo: 'UltiKits/UltiTools-Dev-Doc',
      text: '在 GitHub 上编辑此页'
    },
  },

  markdown: {
    config(md) {
      md.use(headerPlugin)
    }
  },

  vue: {
    reactivityTransform: true
  }
})
