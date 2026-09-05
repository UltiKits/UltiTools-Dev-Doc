import {DefaultTheme} from "vitepress/theme";

// `@viteplus/versions`' populateSidebar reads a `skipVersioning` field that
// `DefaultTheme.SidebarItem` does not declare. `tsc --noEmit` reports TS2353
// ("Object literal may only specify known properties") on any object literal
// carrying it inside an explicitly-typed `SidebarItem[]` array — see the
// comment on the "API Reference" entry below for the full story. This
// intersection type gives the field a home instead of leaving the mismatch
// undisclosed.
type SidebarItemExt = DefaultTheme.SidebarItem & { skipVersioning?: boolean }

const sidebarGuideEN: SidebarItemExt[] = [
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
            },
            {
                text: 'UltiToolsPlugin Base Class',
                link: 'advanced/ulti-tools-plugin'
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
    // D-30: this entry is added ONLY to the latest constant (sidebarGuideEN /
    // sidebarGuideZH), never to any versioned constant (_v624 / _v620 / _v610).
    // @viteplus/versions rewrites sidebar links to a version-prefixed form
    // (e.g. /v6.2.4/api/) for versioned constants, but the Function proxy's
    // scope is only /api/ — an archived prefix is outside it. Adding this to a
    // versioned constant would send archived readers to two already-retired
    // hand-written pages with unrelated content. No `base` field: every
    // existing group's base is '/guide/', and this link must resolve to
    // /api/, not /guide/api — an absolute link bypasses `base` entirely.
    //
    // Correction to the original D-30 note (found during 02-07 planning):
    // it previously said the skip-versioning field couldn't be used here
    // because `DefaultTheme.SidebarItem`'s type definition carries no such
    // field. That's true for VitePress's own type, but the field that
    // actually matters is read by a different piece of code:
    // @viteplus/versions' populateSidebar guards on it before injecting
    // `base` (node_modules/@viteplus/versions/dist/index.js). This repo has
    // no tsconfig.json and no `tsc`/`vue-tsc` step in package.json's scripts
    // or in .github/workflows/, so esbuild strips types without checking
    // them and this field has zero build-time effect today. But `tsc
    // --noEmit` DOES error on it (TS2353, "Object literal may only specify
    // known properties") the moment it is run against this file, because
    // `sidebarGuideEN` carries an explicit array type and this object
    // literal is assigned straight into it — verified directly:
    // `npx tsc --noEmit --skipLibCheck --module esnext --moduleResolution
    // bundler --target es2022 .vitepress/config/sidebar.en.mts`.
    // `nav.en.mts` uses the same field with zero errors only because
    // `navEN` carries no type annotation at all; that is not an equivalent
    // precedent, it is a different situation that happens not to trigger
    // the check. The `SidebarItemExt` alias declared above the array (this
    // file's top) is what actually resolves the mismatch: it documents that
    // `@viteplus/versions` genuinely reads this field while keeping `tsc
    // --noEmit` clean, so a contributor who later adds a type-check step to
    // CI finds the answer written down instead of re-deriving it.
    // Concretely: for the zh locale this group would
    // otherwise get `base: '/zh/'` injected, turning the absolute link
    // `/api/` into `/zh/api/` — a path the Function proxy (scoped to
    // /api/*) does not serve, and which 404s on preview. The en (root)
    // locale's `base` argument is an empty string in populateSidebar, so
    // root was never actually affected — this group carries the field on
    // both files anyway to make the "don't version, don't prefix" intent
    // explicit rather than incidental.
    //
    // The item-level field set to '_self' below — see nav.en.mts for the
    // full argument. Sidebar items render through VPSidebarItem.vue, which
    // passes `item.target` straight through to the same VPLink component
    // nav uses, so this is the same fix for the same failure: 02-UAT.md's
    // G-02-6 only diagnosed the nav half of this; this sidebar entry was
    // silently affected too.
    {
        text: 'API Reference',
        skipVersioning: true,
        items: [
            {
                text: 'API Reference',
                link: '/api/',
                target: '_self'
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
            }
            // D-35 stock-violation fix: the "External Plugin API" guide page
            // does not exist in either v6.2.1 or v6.2.0 (the page was first
            // introduced in v6.2.2). sidebarGuideEN_v620 is mapped by
            // locale.en.mts to BOTH 'v6.2.1/guide/' and 'v6.2.0/guide/', so
            // this link resolved to nothing in either archived version — the
            // first stock violation the new sidebar-links gate (D-35) exists
            // to catch. Removed entirely rather than repointed, since
            // sidebarGuideEN_v624 (serving v6.2.2/v6.2.3/v6.2.4, all three of
            // which have the page) keeps the same entry unchanged below.
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

// 链接以 api/ 起头，不是裸页名。这两个常量挂在 locale.{en,zh}.mts 的
// `vX.Y.Z/api/` 键上，但 @viteplus/versions 的 populateSidebar（dist/index.js）
// 注入的 base 只到「语言 + 版本」那一层——它由 sidebar 键解析出 lang 与 version
// 后拼成 `/<lang>/<version>/`，键里 api/ 那一段不参与。裸页名于是落到
// /vX.Y.Z/version-wrapper.html，而真实文件在 /vX.Y.Z/api/version-wrapper.html。
// scripts/check-sidebar-links.sh 的 check_api_constant 曾自己补上这一段
// （`$root/api/$link.md`），因此在链接实际失效时照常转绿；那条已随本次改动改成
// 直接用 link 值解析，check-rendered-links.sh 第 8 节从产物侧再兜一层。
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
