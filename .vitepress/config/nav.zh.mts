import { DefaultTheme } from "vitepress/theme";

const navZH: DefaultTheme.NavItem[] = [
    {
        text: '深度指南',
        activeMatch: `^/zh/guide/`,
        link: '/zh/guide/introduction',
    },
    {
        text: 'API 接口',
        activeMatch: `^/zh/api/`,
        link: '/zh/api/version-wrapper'
    },
    {
        text: '用户文档',
        link: 'https://doc.ultikits.com'
    }
]

export { navZH }