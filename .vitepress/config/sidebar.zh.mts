import {DefaultTheme} from "vitepress/theme";

const sidebarGuideZH: DefaultTheme.SidebarItem[] = [
    {
        base: "/guide/",
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
        base: "/guide/",
        text: '核心能力',
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
                text: '流式查询 DSL',
                link: 'essentials/query-dsl'
            },
            {
                text: 'I18n 多语言',
                link: 'essentials/i18n'
            },
            {
                text: '异常处理',
                link: 'advanced/exception-handling'
            },
            {
                text: '事务',
                link: 'advanced/transactions'
            }
        ]
    },
    {
        base: "/guide/",
        text: '框架机制',
        items: [
            {
                text: '自动注册',
                link: 'advanced/auto-register'
            },
            {
                text: 'IOC 容器',
                link: 'advanced/ioc-container'
            },
            {
                text: '条件注册',
                link: 'advanced/conditional-registration'
            },
            {
                text: '配置校验',
                link: 'advanced/config-validation'
            }
        ]
    },
    {
        base: "/guide/",
        text: '运行时',
        items: [
            {
                text: '定时任务',
                link: 'advanced/scheduled-tasks'
            },
            {
                text: '玩家缓存',
                link: 'advanced/player-cache'
            }
        ]
    },
    {
        base: "/guide/",
        text: '界面系统',
        items: [
            {
                text: 'GUI 界面',
                link: 'advanced/gui'
            },
            {
                text: '声明式 GUI',
                link: 'advanced/declarative-gui'
            }
        ]
    },
    {
        base: "/guide/",
        text: '工具链',
        items: [
            {
                text: 'UltiTools Maven 插件',
                link: 'advanced/maven-plugin'
            },
            {
                text: 'UltiKits CLI',
                link: 'advanced/ultikits-cli'
            },
            {
                text: '测试工具',
                link: 'advanced/test-utilities'
            }
        ]
    },
]

const sidebarGuideZH_v610: DefaultTheme.SidebarItem[] = [
    {
        base: "/guide/",
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
        base: "/guide/essentials/",
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
        base: '/guide/advanced/',
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
        link: 'version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: 'ulti-tools-plugin'
    },
]

export { sidebarGuideZH, sidebarGuideZH_v610, sidebarApiZH }
