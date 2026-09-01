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
            },
            {
                text: 'Test Utilities',
                link: 'advanced/test-utilities'
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
            },
            {
                text: 'Deprecations',
                link: 'advanced/deprecations'
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

// Frozen at the v6.2.5 archive cut (07-19-PLAN.md, D-26). Sourced from
// origin/master's sidebarGuideEN at cut time -- the released layer, not the
// live alpha sidebar, which already carries unreleased 6.3.0 entries (Module
// Load Ordering, Panel Integration) that do not exist in the released docs.
// Do not derive this from the live alpha sidebar.
const sidebarGuideEN_v625: DefaultTheme.SidebarItem[] = [
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


const sidebarApiEN: DefaultTheme.SidebarItem[] = [
    {
        text: 'UltiToolsPlugin',
        link: 'ulti-tools-plugin'
    },
]

// Frozen alongside sidebarGuideEN_v625 above -- sourced from origin/master's
// sidebarApiEN at cut time. The live sidebarApiEN below is free to change
// afterward (deprecations page added elsewhere, version-wrapper.md removed)
// without touching this or any older archived version, all of which share it.
const sidebarApiEN_v625: DefaultTheme.SidebarItem[] = [
    {
        text: 'VersionWrapper',
        link: 'version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: 'ulti-tools-plugin'
    },
]

export { sidebarGuideEN, sidebarGuideEN_v625, sidebarGuideEN_v624, sidebarGuideEN_v620, sidebarGuideEN_v610, sidebarApiEN, sidebarApiEN_v625 }
