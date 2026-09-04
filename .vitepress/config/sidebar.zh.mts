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
            },
            {
                text: '模块加载顺序',
                link: 'advanced/module-dependencies'
            },
            {
                text: '外部插件 API',
                link: 'advanced/external-plugin-api'
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
            },
            {
                text: '模块事件总线',
                link: 'advanced/module-eventbus'
            },
            {
                text: '面板集成',
                link: 'advanced/panel-integration'
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
            }
        ]
    },
    {
        base: "/guide/",
        text: '发布',
        items: [
            {
                text: '模块版本规范',
                link: 'advanced/module-versioning'
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

const sidebarGuideZH_v620: DefaultTheme.SidebarItem[] = [
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
            },
            {
                text: '外部插件 API',
                link: 'advanced/external-plugin-api'
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

const sidebarGuideZH_v624: DefaultTheme.SidebarItem[] = [
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
            },
            {
                text: '外部插件 API',
                link: 'advanced/external-plugin-api'
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
            },
            {
                text: '模块事件总线',
                link: 'advanced/module-eventbus'
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

// 链接以 api/ 起头，不是裸页名。@viteplus/versions 的 populateSidebar 注入的
// base 只到「语言 + 版本」那一层（dist/index.js 的 populateSidebar 由 sidebar 键
// 解析出 lang/version 后拼成 `/<lang>/<version>/`），不含键里的 api/ 一段；而
// 未版本化的 '/api/' 键解析出的 lang 与 version 都为空，base 干脆不注入。
// 两种情况下裸页名都会落到少一段 api/ 的地址上，实测 404。
const sidebarApiZH: DefaultTheme.SidebarItem[] = [
    {
        text: 'VersionWrapper',
        link: 'api/version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: 'api/ulti-tools-plugin'
    },
]

export { sidebarGuideZH, sidebarGuideZH_v624, sidebarGuideZH_v620, sidebarGuideZH_v610, sidebarApiZH }
