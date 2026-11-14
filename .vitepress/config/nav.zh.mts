const navZH = [
    {
        text: '深度指南',
        activeMatch: `/guide/(?!release-notes/)`,
        link: '/guide/introduction',
    },
    // 下面这个 target 字段（取值 '_self'）用来关掉 VitePress 全局 click 处理
    // 器的接管。该处理器只
    // 在被点击的 <a> 带 target 属性时提前返回（vitepress/dist/client/app/
    // router.js 里 link.hasAttribute('target') 那一条分支）；否则会把 /api/
    // 当成同源的 HTML 路由，走客户端导航。/api/ 是 Cloudflare Pages Function
    // 路由，构建产物里没有对应页面，被客户端路由接管后渲染出的是 VitePress
    // 自己的 404，Function 从未被调用。这个字段管的不是「在哪打开」，而是让
    // 这个 <a> 跳出上述接管。取值必须是 '_self' 而不是 '_blank'：VPLink.vue
    // 的 isExternal 把 target === '_blank' 当作外链信号，会额外加图标和
    // rel="noreferrer"；'_self' 不触发这条分支，外观与点击行为都不变，只是
    // 不再被拦截。
    {
        text: 'API 接口',
        activeMatch: `/api/`,
        link: '/api/',
        skipVersioning: true,
        target: '_self'
    },
    {
        text: '用户文档',
        link: 'https://doc.ultikits.com',
        skipVersioning: true
    },
    {
        text: '更新说明',
        activeMatch: `/guide/release-notes/`,
        link: '/zh/guide/release-notes/6.4.0',
        skipVersioning: true
    }
    // 版本切换器不是 nav 项。它由 Layout.vue 直接渲染：桌面端在导航栏标题
    // 右侧，手机端在屏幕菜单底部，版本数据取自构建期清单
    // version-pages.generated.mjs。留在这里会被 SecondNavBar 与
    // VPNavScreenMenu 各渲染一份，且位置只能落在 tab 行或菜单列表里。
]

export { navZH }
