import {DefaultTheme} from "vitepress/theme";

const sidebarGuideZH: DefaultTheme.SidebarItem[] = [
    {
        base: "/zh/guide/",
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
        base: "/zh/guide/essentials/",
        text: '基础',
        items: [
            {
                text: '命令执行器',
                link: 'cmd-executor'
            },
            {
                text: '事件监听器',
                link: 'event-listener'
            },
            {
                text: '配置文件',
                link: 'config-file'
            },
            {
                text: '数据储存',
                link: 'data-storage'
            },
            {
                text: 'I18n 多语言',
                link: 'i18n'
            },
        ]
    },
    {
        base: '/zh/guide/advanced/',
        text: '高级',
        items: [
            {
                text: '自动注册',
                link: 'auto-register'
            },
            {
                text: 'IOC容器',
                link: 'ioc-container'
            },
            {
                text: 'GUI界面',
                link: 'gui'
            },
            {
                text: 'UltiTools Maven插件',
                link: 'maven-plugin'
            }
        ]
    },
]

const sidebarApiZH: DefaultTheme.SidebarItem[] = [
    {
        text: 'VersionWrapper',
        link: '/zh/api/version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: '/zh/api/ulti-tools-plugin'
    },
]

export { sidebarGuideZH, sidebarApiZH }