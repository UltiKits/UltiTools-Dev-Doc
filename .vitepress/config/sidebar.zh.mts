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
            },
            {
                text: '弃用清单',
                link: 'advanced/deprecations'
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

// 在 v6.2.5 归档切分时冻结（07-19-PLAN.md, D-26）。取自 origin/master 切分时刻的
// sidebarGuideZH —— 已发布层，不是 live alpha sidebar；后者已经带上了未发布的
// 6.3.0 条目（模块加载顺序、面板集成），在已发布文档里并不存在。不要从 live
// alpha sidebar 派生这份常量。
const sidebarGuideZH_v625: DefaultTheme.SidebarItem[] = [
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

// 与上面的 sidebarGuideZH_v625 一起冻结 —— 取自 origin/master 切分时刻的
// sidebarApiZH。下方 live sidebarApiZH 之后可以自由变化（弃用页放到别处、
// version-wrapper.md 被移除），不影响本常量，也不影响共享它的更早归档版本。
const sidebarApiZH_v625: DefaultTheme.SidebarItem[] = [
    {
        text: 'VersionWrapper',
        link: 'version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: 'ulti-tools-plugin'
    },
]

export { sidebarGuideZH, sidebarGuideZH_v625, sidebarGuideZH_v624, sidebarGuideZH_v620, sidebarGuideZH_v610, sidebarApiZH, sidebarApiZH_v625 }
