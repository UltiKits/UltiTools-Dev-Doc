const navZH = [
    {
        text: '深度指南',
        activeMatch: `/guide/`,
        link: '/guide/introduction',
    },
    {
        text: 'API 接口',
        activeMatch: `/api/`,
        link: '/api/version-wrapper'
    },
    {
        text: '用户文档',
        link: 'https://doc.ultikits.com',
        skipVersioning: true
    },
    {
        component: 'VersionSwitcher'
    }
]

export { navZH }
