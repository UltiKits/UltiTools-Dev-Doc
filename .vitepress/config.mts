import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "UltiTools Dev Doc",
  description: "UltiTools Dev Doc",
  lastUpdated: true,
  lang: 'zh-CN',
  srcDir: 'docs',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    editLink: {
      pattern: 'https://github.com/UltiKits/UltiTools-Dev-Doc/edit/main/docs/:path'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2019-present UltiKits Dev Team'
    },
    search: {
      provider: 'algolia',
      options: {
        indexName: 'ultikits',
        appId: '8D12CWPS3U',
        apiKey: '8dfc6d2cbe56024cb3906cf802f2cce7',
        locales: {
          'zh-CN': {
            placeholder: '搜索文档',
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                searchBox: {
                  resetButtonTitle: '清除查询条件',
                  resetButtonAriaLabel: '清除查询条件',
                  cancelButtonText: '取消',
                  cancelButtonAriaLabel: '取消'
                },
                startScreen: {
                  recentSearchesTitle: '搜索历史',
                  noRecentSearchesText: '没有搜索历史',
                  saveRecentSearchButtonTitle: '保存至搜索历史',
                  removeRecentSearchButtonTitle: '从搜索历史中移除',
                  favoriteSearchesTitle: '收藏',
                  removeFavoriteSearchButtonTitle: '从收藏中移除'
                },
                errorScreen: {
                  titleText: '无法获取结果',
                  helpText: '你可能需要检查你的网络连接'
                },
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                  searchByText: '搜索提供者'
                },
                noResultsScreen: {
                  noResultsText: '无法找到相关结果',
                  suggestedQueryText: '你可以尝试查询',
                  reportMissingResultsText: '你认为该查询应该有结果？',
                  reportMissingResultsLinkText: '点击反馈'
                }
              }
            }
          }
        }
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/UltiKits' },
      { icon: 'discord', link: 'https://discord.gg/P3fpQSRPGu' }
    ],
    nav: [
      {
        text: '深度指南',
        activeMatch: `^/guide/`,
        link: '/guide/introduction'
      },
      {
        text: '用户文档',
        link: 'https://ultitools.doc.ultikits.com'
      }
    ],

    sidebar: [
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
      },
      {
        text: '高级',
        items: [
          {
            text: '自动注册',
            link: '/guide/advanced/auto-register'
          },
          {
            text: 'IOC容器',
            link: '/guide/advanced/ioc-container'
          }
        ]
      },
    ],
  }
})
