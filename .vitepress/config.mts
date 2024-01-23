import * as process from 'node:process';

import {defineConfig} from 'vitepress'
import {tabsMarkdownPlugin} from 'vitepress-plugin-tabs'
import {withPwa} from '@vite-pwa/vitepress'
import {BiDirectionalLinks} from '@nolebase/markdown-it-bi-directional-links'
import type {Options as ElementTransformOptions} from '@nolebase/markdown-it-element-transform'
import {ElementTransform} from '@nolebase/markdown-it-element-transform'

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
            ['link', {rel: 'icon', href: '/favicon.ico'}]
        ],
        locales: {
            zh: {
                label: '简体中文',
                lang: 'zh-CN',
                link: '/zh/',
                themeConfig: {
                    nav: [
                        {
                            text: '深度指南',
                            activeMatch: `^/guide/`,
                            link: '/zh/guide/introduction',
                        },
                        {
                            text: 'API 接口',
                            activeMatch: `^/api/`,
                            link: '/zh/api/version-wrapper'
                        },
                        {
                            text: '用户文档',
                            link: 'https://doc.ultikits.com'
                        }
                    ],
                    outline: {
                        level: 'deep',
                        label: '页面导航'
                    },
                    editLink: {
                        pattern: 'https://github.com/UltiKits/UltiTools-Dev-Doc/edit/master/docs/:path',
                        text: '在 GitHub 上编辑此页面',
                    },
                    lastUpdated: {
                        text: '最后更新于'
                    },
                    socialLinks: [
                        {icon: 'github', link: 'https://github.com/UltiKits'},
                        {
                            icon: {svg: '<svg enable-background="new 0 0 2094.5 2477.7" viewBox="0 0 2094.5 2477.7" xmlns="http://www.w3.org/2000/svg"><path d="m1831.6 1032.9c2.3-31.5 4.5-65.3 4.5-96.8 0-517.6-353.3-936.1-789.8-936.1s-789.8 418.5-789.8 936.1c0 33.8 2.3 67.5 4.5 101.3-132.8 265.5-330.8 825.8-236.3 994.6 11.3 20.3 126-90 218.3-265.5 2.3 195.8 101.3 373.5 261 497.3-130.5 22.5-249.8 105.8-240.8 148.5 15.8 72 335.3 87.8 726.8 31.5 2.3 0 4.5 0 9-2.3 15.8 0 31.5 2.3 47.3 2.3s31.5 0 47.3-2.3c2.3 0 4.5 0 9 2.3 393.8 56.3 711.1 40.5 726.8-31.5 9-42.8-110.3-126-240.8-148.5 159.8-123.8 258.8-303.8 261-501.8 90 180 209.3 292.5 220.5 270 94.6-168.8-108-735.9-238.5-999.1z"/></svg>'},
                            link: 'https://qm.qq.com/q/ELTl8iUoGk'
                        }
                    ],
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
                }
            },
            en: {
                label: 'English',
                lang: 'en-US',
                link: '/en/',
                themeConfig: {
                    outline: {
                        level: 'deep',
                    },
                    editLink: {
                        pattern: 'https://github.com/UltiKits/UltiTools-Dev-Doc/edit/master/docs/:path',
                        text: 'Edit this page on GitHub',
                    },
                    nav: [
                        {
                            text: 'Documents',
                            activeMatch: `^/guide/`,
                            link: '/en/guide/introduction',
                        },
                        {
                            text: 'API Reference',
                            activeMatch: `^/api/`,
                            link: '/en/api/version-wrapper'
                        },
                        {
                            text: 'User Doc',
                            link: 'https://doc.ultikits.com'
                        }
                    ],
                    search: {
                        provider: 'algolia',
                        options: {
                            indexName: 'ultikits',
                            appId: '8D12CWPS3U',
                            apiKey: '8dfc6d2cbe56024cb3906cf802f2cce7',
                            placeholder: "You can type anything to get started~",
                            translations: {
                                button: {
                                    buttonText: 'Search',
                                    buttonAriaLabel: 'Search Documents'
                                },
                                modal: {
                                    searchBox: {
                                        resetButtonTitle: 'Clear query',
                                        resetButtonAriaLabel: 'Clear query',
                                        cancelButtonText: 'Cancel',
                                        cancelButtonAriaLabel: 'Cancel'
                                    },
                                    startScreen: {
                                        recentSearchesTitle: 'Recent Searches',
                                        noRecentSearchesText: 'No recent searches',
                                        saveRecentSearchButtonTitle: 'Save to recent searches',
                                        removeRecentSearchButtonTitle: 'Remove from recent searches',
                                        favoriteSearchesTitle: 'Favorites',
                                        removeFavoriteSearchButtonTitle: 'Remove from favorites'
                                    },
                                    errorScreen: {
                                        titleText: 'Unable to fetch results',
                                        helpText: 'You may need to check your network connection'
                                    },
                                    footer: {
                                        selectText: 'This is it!',
                                        navigateText: 'Navigation',
                                        closeText: 'Close',
                                        searchByText: 'Search by'
                                    },
                                    noResultsScreen: {
                                        noResultsText: 'No results found',
                                        suggestedQueryText: 'You may give it a try',
                                        reportMissingResultsText: 'Do you think this query should have results?',
                                        reportMissingResultsLinkText: 'Report missing results'
                                    }
                                }
                            }
                        }
                    },
                    socialLinks: [
                        {icon: 'github', link: 'https://github.com/UltiKits'},
                        {icon: 'discord', link: 'https://discord.gg/P3fpQSRPGu'},
                    ],
                }
            }
        },
        sitemap: {
            hostname: 'https://dev.ultikits.com'
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
            footer: {
                message: 'Released under the MIT License.',
                copyright: 'Copyright © 2019-present UltiKits Dev Team'
            },
            outline: 'deep',
            externalLinkIcon: true,

            sidebar: {
                '/zh/guide/': {
                    base: '/zh/guide/',
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
                                },
                                {
                                    text: 'UltiTools Maven插件',
                                    link: 'advanced/maven-plugin'
                                }
                            ]
                        },
                    ],
                },
                '/en/guide/': {
                    base: '/en/guide/',
                    items: [
                        {
                            text: 'Get Started',
                            items: [
                                {
                                    text: 'Introduction',
                                    link: 'introduction'
                                },
                                {
                                    text: 'Quick Start',
                                    link: 'quick-start'
                                }
                            ]
                        },
                        {
                            text: 'Basics',
                            items: [
                                {
                                    text: 'Command Executor',
                                    link: 'essentials/cmd-executor'
                                },
                                {
                                    text: 'Event Listener',
                                    link: 'essentials/event-listener'
                                },
                                {
                                    text: 'Config File',
                                    link: 'essentials/config-file'
                                },
                                {
                                    text: 'Data Storage',
                                    link: 'essentials/data-storage'
                                },
                                {
                                    text: 'Internationalization',
                                    link: 'essentials/i18n'
                                },
                            ]
                        },
                        {
                            text: 'Advanced',
                            items: [
                                {
                                    text: 'Auto Register',
                                    link: 'advanced/auto-register'
                                },
                                {
                                    text: 'IOC Container',
                                    link: 'advanced/ioc-container'
                                },
                                {
                                    text: 'GUI Interface',
                                    link: 'advanced/gui'
                                },
                                {
                                    text: 'UltiTools Maven Plugin',
                                    link: 'advanced/maven-plugin'
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
