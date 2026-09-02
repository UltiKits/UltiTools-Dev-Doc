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
                text: '外部插件 API',
                link: 'advanced/external-plugin-api'
            },
            {
                text: 'UltiToolsPlugin 基类',
                link: 'advanced/ulti-tools-plugin'
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
    // D-30：这一条只加进 latest 常量（sidebarGuideEN/ZH），不进任何版本化常量
    // （_v624/_v620/_v610）。@viteplus/versions 会把 sidebar link 重写成带版本
    // 前缀的形式（如 /v6.2.4/api/），而 Function 代理的作用域只有 /api/，归档
    // 路径不在其下；加进版本化常量会把归档读者送到两个已退役的手写页，语义与
    // 这里完全不同。nav 侧用 skipVersioning 达到同样效果，但
    // DefaultTheme.SidebarItem 的类型定义里没有这个字段，因此只加进 latest
    // 常量是这里唯一能用的隔离手段。不写 base 字段：既有分组的 base 全是
    // '/guide/'，而这条要落到 /api/ 而不是 /guide/api——绝对路径的 link 会
    // 完全绕过 base 拼接。
    {
        text: 'API 参考',
        items: [
            {
                text: 'API 参考',
                link: '/api/'
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
            }
            // D-35 存量违规修复：「外部插件 API」这个 guide 页面在
            // v6.2.1 与 v6.2.0 两个归档版本里都不存在（该页最早出现在
            // v6.2.2）。sidebarGuideZH_v620 同时被 locale.zh.mts 映射给
            // 'v6.2.1/guide/' 与 'v6.2.0/guide/' 两个 key，两处这条 link 都指
            // 空——这正是新 sidebar-links 门禁（D-35）要抓的第一批存量违规。
            // 整条删除，不改指他处：sidebarGuideZH_v624（服务 v6.2.2/v6.2.3/
            // v6.2.4，三个版本都有这个页面）下方保持原样不动。
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

export { sidebarGuideZH, sidebarGuideZH_v624, sidebarGuideZH_v620, sidebarGuideZH_v610, sidebarApiZH }
