import {DefaultTheme} from "vitepress/theme";

const textCN: DefaultTheme.Config = {

    footer: {
        message: '基于 MIT 许可发布',
        copyright: `版权所有 © 2019-${new Date().getFullYear()} UltiKits 开发团队`
    },

    editLink: {
        pattern: 'https://github.com/vuejs/vitepress/edit/master/docs/:path',
        text: '在 GitHub 上编辑此页面'
    },

    docFooter: {
        prev: '上一页',
        next: '下一页'
    },

    outline: {
        label: '页面导航'
    },

    lastUpdated: {
        text: '最后更新于',
    },

    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
}

export { textCN }