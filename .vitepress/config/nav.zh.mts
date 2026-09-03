const navZH = [
    {
        text: '深度指南',
        activeMatch: `/guide/`,
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
    }
]

export { navZH }
