import {DefaultTheme} from "vitepress/theme";

// @viteplus/versions 的 populateSidebar 读取的 skipVersioning 字段并不在
// DefaultTheme.SidebarItem 的类型定义里。只要该字段出现在带显式 SidebarItem[]
// 类型标注的数组元素里，tsc --noEmit 就会报 TS2353（"Object literal may only
// specify known properties"）——完整说明见下方 "API 参考" 条目的注释。这个交
// 集类型给这个字段一个类型上的归属，而不是留一条未披露的隐性诊断。
type SidebarItemExt = DefaultTheme.SidebarItem & { skipVersioning?: boolean }

const sidebarGuideZH: SidebarItemExt[] = [
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
    // 这里完全不同。不写 base 字段：既有分组的 base 全是 '/guide/'，而这条要
    // 落到 /api/ 而不是 /guide/api——绝对路径的 link 会完全绕过 base 拼接。
    //
    // 对原 D-30 注释的修正（02-07 规划期间发现）：此前那句「类型定义里没有
    // 这个跳过版本化的字段所以只能靠 latest-only 放置」判断有误。VitePress
    // 自己的类型定义里确实没有，但真正读这个字段的是另一段代码：
    // @viteplus/versions 的 populateSidebar 在注入 base 之前会先看这个字段
    // （node_modules/@viteplus/versions/dist/index.js）。本仓库没有
    // tsconfig.json，package.json 的 scripts 与 .github/workflows/ 里也没有
    // 任何 tsc/vue-tsc 步骤，所以 esbuild 转译时不做类型检查，这个字段今天
    // 没有任何构建期影响。但只要真的跑 tsc --noEmit，它就会报错（TS2353，
    // "Object literal may only specify known properties"）——因为
    // sidebarGuideZH 带着显式数组类型标注，这个对象字面量是直接赋进去的。
    // 实测命令：`npx tsc --noEmit --skipLibCheck --module esnext
    // --moduleResolution bundler --target es2022
    // .vitepress/config/sidebar.zh.mts`。nav.zh.mts 用同一个字段却零报错，
    // 只是因为 navZH 完全没有类型标注——这不是等价的先例，只是恰好没触发这
    // 条检查的另一种情况。本文件顶部声明的 SidebarItemExt 交集类型才是真正
    // 解决问题的地方：它把"@viteplus/versions 确实会读这个字段"这件事写进
    // 类型里，同时让 tsc --noEmit 保持干净，日后有人给 CI 加类型检查步骤
    // 时，答案已经写在这里，不必重新推导一遍。具体后果：中文 locale 下这个
    // 分组本会被注入 base: '/zh/'，把绝对路
    // 径 /api/ 拼成 /zh/api/——这条路径不在 Function 代理（作用域 /api/*）之
    // 下，preview 上实测 404。英文（root）locale 在 populateSidebar 里传入的
    // base 参数是空字符串，本来就不受影响；两份文件都加这个字段，是为了让
    // 「不做版本化、不加前缀」这个意图显式，而不是靠巧合成立。
    //
    // 下面这条 item 上、取值为 '_self' 的字段——完整论证见 nav.zh.mts。
    // sidebar 的渲染路径是 VPSidebarItem.vue，它把 item.target 原样透传给
    // 与 nav 相同的 VPLink 组件，因此这里修的是同一个失效：02-UAT.md 的
    // G-02-6 只诊断了 nav 那一半，这条 sidebar 入口同样被悄悄波及。
    {
        text: 'API 参考',
        skipVersioning: true,
        items: [
            {
                text: 'API 参考',
                link: '/api/',
                target: '_self'
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
