import {DefaultTheme} from "vitepress/theme";

const sidebarGuideEN: DefaultTheme.SidebarItem[] = [
    {
        base: '/en/guide/',
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
        base: "/en/guide/essentials/",
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
        base: '/en/guide/advanced/',
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
]

const sidebarApiEN: DefaultTheme.SidebarItem[] = [
    {
        text: 'VersionWrapper',
        link: 'version-wrapper'
    },
    {
        text: 'UltiToolsPlugin',
        link: 'ulti-tools-plugin'
    },
]

export { sidebarGuideEN, sidebarApiEN }