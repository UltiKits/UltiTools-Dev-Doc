import { DefaultTheme } from "vitepress/theme";

const navEN: DefaultTheme.NavItem[] = [
    {
        text: 'Documents',
        activeMatch: `^/en/guide/`,
        link: '/en/guide/introduction',
    },
    {
        text: 'API Reference',
        activeMatch: `^/en/api/`,
        link: '/en/api/version-wrapper'
    },
    {
        text: 'User Doc',
        link: 'https://doc.ultikits.com'
    }
]

export { navEN }