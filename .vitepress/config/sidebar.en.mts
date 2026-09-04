import {DefaultTheme} from "vitepress/theme";

const sidebarGuideEN: DefaultTheme.SidebarItem[] = [
    {
        base: '/guide/',
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
        base: '/guide/',
        text: 'Core Capabilities',
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
                text: 'Query DSL',
                link: 'essentials/query-dsl'
            },
            {
                text: 'Internationalization',
                link: 'essentials/i18n'
            },
            {
                text: 'Exception Handling',
                link: 'advanced/exception-handling'
            },
            {
                text: 'Transactions',
                link: 'advanced/transactions'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Framework Mechanisms',
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
                text: 'Conditional Registration',
                link: 'advanced/conditional-registration'
            },
            {
                text: 'Config Validation',
                link: 'advanced/config-validation'
            },
            {
                text: 'Module Load Ordering',
                link: 'advanced/module-dependencies'
            },
            {
                text: 'External Plugin API',
                link: 'advanced/external-plugin-api'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Runtime',
        items: [
            {
                text: 'Scheduled Tasks',
                link: 'advanced/scheduled-tasks'
            },
            {
                text: 'Player Cache',
                link: 'advanced/player-cache'
            },
            {
                text: 'Module EventBus',
                link: 'advanced/module-eventbus'
            },
            {
                text: 'Panel Integration',
                link: 'advanced/panel-integration'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'UI System',
        items: [
            {
                text: 'GUI Interface',
                link: 'advanced/gui'
            },
            {
                text: 'Declarative GUI',
                link: 'advanced/declarative-gui'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Toolchain',
        items: [
            {
                text: 'UltiTools Maven Plugin',
                link: 'advanced/maven-plugin'
            },
            {
                text: 'UltiKits CLI',
                link: 'advanced/ultikits-cli'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Releasing',
        items: [
            {
                text: 'Module Versioning',
                link: 'advanced/module-versioning'
            }
        ]
    },
]

const sidebarGuideEN_v610: DefaultTheme.SidebarItem[] = [
    {
        base: '/guide/',
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
        base: "/guide/essentials/",
        text: 'Basics',
        items: [
            {
                text: 'Command Executor',
                link: 'cmd-executor'
            },
            {
                text: 'Event Listener',
                link: 'event-listener'
            },
            {
                text: 'Config File',
                link: 'config-file'
            },
            {
                text: 'Data Storage',
                link: 'data-storage'
            },
            {
                text: 'Internationalization',
                link: 'i18n'
            },
        ]
    },
    {
        base: '/guide/advanced/',
        text: 'Advanced',
        items: [
            {
                text: 'Auto Register',
                link: 'auto-register'
            },
            {
                text: 'IOC Container',
                link: 'ioc-container'
            },
            {
                text: 'GUI Interface',
                link: 'gui'
            },
            {
                text: 'UltiTools Maven Plugin',
                link: 'maven-plugin'
            }
        ]
    },
]

const sidebarGuideEN_v620: DefaultTheme.SidebarItem[] = [
    {
        base: '/guide/',
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
        base: '/guide/',
        text: 'Core Capabilities',
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
                text: 'Query DSL',
                link: 'essentials/query-dsl'
            },
            {
                text: 'Internationalization',
                link: 'essentials/i18n'
            },
            {
                text: 'Exception Handling',
                link: 'advanced/exception-handling'
            },
            {
                text: 'Transactions',
                link: 'advanced/transactions'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Framework Mechanisms',
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
                text: 'Conditional Registration',
                link: 'advanced/conditional-registration'
            },
            {
                text: 'Config Validation',
                link: 'advanced/config-validation'
            },
            {
                text: 'External Plugin API',
                link: 'advanced/external-plugin-api'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Runtime',
        items: [
            {
                text: 'Scheduled Tasks',
                link: 'advanced/scheduled-tasks'
            },
            {
                text: 'Player Cache',
                link: 'advanced/player-cache'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'UI System',
        items: [
            {
                text: 'GUI Interface',
                link: 'advanced/gui'
            },
            {
                text: 'Declarative GUI',
                link: 'advanced/declarative-gui'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Toolchain',
        items: [
            {
                text: 'UltiTools Maven Plugin',
                link: 'advanced/maven-plugin'
            },
            {
                text: 'UltiKits CLI',
                link: 'advanced/ultikits-cli'
            },
            {
                text: 'Test Utilities',
                link: 'advanced/test-utilities'
            }
        ]
    },
]

const sidebarGuideEN_v624: DefaultTheme.SidebarItem[] = [
    {
        base: '/guide/',
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
        base: '/guide/',
        text: 'Core Capabilities',
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
                text: 'Query DSL',
                link: 'essentials/query-dsl'
            },
            {
                text: 'Internationalization',
                link: 'essentials/i18n'
            },
            {
                text: 'Exception Handling',
                link: 'advanced/exception-handling'
            },
            {
                text: 'Transactions',
                link: 'advanced/transactions'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Framework Mechanisms',
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
                text: 'Conditional Registration',
                link: 'advanced/conditional-registration'
            },
            {
                text: 'Config Validation',
                link: 'advanced/config-validation'
            },
            {
                text: 'External Plugin API',
                link: 'advanced/external-plugin-api'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Runtime',
        items: [
            {
                text: 'Scheduled Tasks',
                link: 'advanced/scheduled-tasks'
            },
            {
                text: 'Player Cache',
                link: 'advanced/player-cache'
            },
            {
                text: 'Module EventBus',
                link: 'advanced/module-eventbus'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'UI System',
        items: [
            {
                text: 'GUI Interface',
                link: 'advanced/gui'
            },
            {
                text: 'Declarative GUI',
                link: 'advanced/declarative-gui'
            }
        ]
    },
    {
        base: '/guide/',
        text: 'Toolchain',
        items: [
            {
                text: 'UltiTools Maven Plugin',
                link: 'advanced/maven-plugin'
            },
            {
                text: 'UltiKits CLI',
                link: 'advanced/ultikits-cli'
            },
            {
                text: 'Test Utilities',
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
const sidebarApiEN: DefaultTheme.SidebarItem[] = [
    {
        text: 'VersionWrapper',
        link: 'api/version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: 'api/ulti-tools-plugin'
    },
]

export { sidebarGuideEN, sidebarGuideEN_v624, sidebarGuideEN_v620, sidebarGuideEN_v610, sidebarApiEN }
