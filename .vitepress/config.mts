import * as process from 'node:process';

import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { withPwa } from '@vite-pwa/vitepress'
import { BiDirectionalLinks } from '@nolebase/markdown-it-bi-directional-links'
import type { Options as ElementTransformOptions } from '@nolebase/markdown-it-element-transform'
import { ElementTransform } from '@nolebase/markdown-it-element-transform'

// https://vitepress.dev/reference/site-config
// noinspection JSUnusedGlobalSymbols
export default withPwa(
  defineConfig({
    title: "UltiTools Dev Doc",
    description: "UltiTools Dev Doc",
    lastUpdated: true,
    lang: 'zh-CN',
    srcDir: 'docs',
    head: [
      ['link', { rel: 'icon', href: '/favicon.ico' }]
    ],
    locales: {
      root: {
        label: '简体中文',
        lang: 'zh-CN'
      }
    },
    sitemap: {
      hostname: 'https://doc.dev.ultikits.com'
    },
    vite: {
      ssr: {
        noExternal: [
          '@nolebase/vitepress-plugin-enhanced-readabilities',
          '@nolebase/vitepress-plugin-highlight-targeted-heading',
          '@nolebase/markdown-it-bi-directional-links',
          '@nolebase/vitepress-plugin-inline-link-preview'
        ],
      },
    },
    markdown: {
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(BiDirectionalLinks({
          dir: process.cwd(),
        }))
        md.use(ElementTransform, (() => {
          let transformNextLinkCloseToken = false

          // noinspection JSUnusedGlobalSymbols
          return {
            transform(token) {
              switch (token.type) {
                case 'link_open':
                  if (token.attrGet('class') !== 'header-anchor') {
                    token.tag = 'VPNolebaseInlineLinkPreview'
                    transformNextLinkCloseToken = true
                  }
                  break
                case 'link_close':
                  if (transformNextLinkCloseToken) {
                    token.tag = 'VPNolebaseInlineLinkPreview'
                    transformNextLinkCloseToken = false
                  }

                  break
              }
            },
          } as ElementTransformOptions
        })())
      }
    },
    pwa: {
      registerType: 'prompt',
      outDir: '../.vitepress/dist',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'UltiKits Dev Doc',
        short_name: 'UltiKitsDevDoc',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff2}'],
      },
      devOptions: {
        type: 'module',
        enabled: true,
        suppressWarnings: true,
        navigateFallback: '/',
      },
      experimental: {
        includeAllowlist: true
      }
    },
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      editLink: {
        pattern: 'https://github.com/UltiKits/UltiTools-Dev-Doc/edit/master/docs/:path'
      },
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2019-present UltiKits Dev Team'
      },
      externalLinkIcon: true,
      search: {
        provider: 'algolia',
        options: {
          indexName: 'ultikits',
          appId: '8D12CWPS3U',
          apiKey: '8dfc6d2cbe56024cb3906cf802f2cce7',
          placeholder: "如果是开发者大人的话...搜索什么的都是没有关系的哦~",
          translations: {
            button: {
              buttonText: '搜索文档这里请喵~',
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
                noRecentSearchesText: '还没有与开发者大人建立过共同回忆呜~ QAQ',
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
                selectText: '就是你了！',
                navigateText: '这这不对...',
                closeText: '你给路达呦',
                searchByText: '你的专属搜索姬'
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
          text: 'API 接口',
          activeMatch: `^/api/`,
          link: '/api/version-wrapper'
        },
        {
          text: '用户文档',
          link: 'https://ultitools.doc.ultikits.com'
        }
      ],

      sidebar: {
        '/guide/' : {
          base: '/guide/',
          items: [
            {
              text: '开始',
              items: [
                {
                  text: '简介',
                  link: 'introduction'
                },
                {
                  text: '快速上手',
                  link: 'quick-start'
                }
              ]
            },
            {
              text: '基础',
              items: [
                {
                  text: '命令执行器',
                  link: 'essentials/cmd-executor'
                },
                {
                  text: '事件监听器',
                  link: 'essentials/event-listener'
                },
                {
                  text: '配置文件',
                  link: 'essentials/config-file'
                },
                {
                  text: '数据储存',
                  link: 'essentials/data-storage'
                },
                {
                  text: 'I18n 多语言',
                  link: 'essentials/i18n'
                },
              ]
            },
            {
              text: '高级',
              items: [
                {
                  text: '自动注册',
                  link: 'advanced/auto-register'
                },
                {
                  text: 'IOC容器',
                  link: 'advanced/ioc-container'
                },
                {
                  text: 'GUI界面',
                  link: 'advanced/gui'
                }
              ]
            },
          ],
        },
        '/api/': {
          base: '/api/',
          items: [
            {
              text: 'VersionWrapper',
              link: 'version-wrapper'
            },
            {
              text: 'UltiToolsPlugin',
              link: 'ulti-tools-plugin'
            },
          ]
        }
      }
    }
  })
)
