import {DefaultTheme} from "vitepress/theme";

const textEN: DefaultTheme.Config = {
    outline: {
      level: 'deep'
    },
    footer: {
        message: 'Released under the MIT License.',
        copyright: `Copyright © 2019-${new Date().getFullYear()} UltiKits Dev Team`
    },
    editLink: {
        pattern: 'https://github.com/UltiKits/UltiTools-Dev-Doc/edit/master/docs/:path',
        text: '在 GitHub 上编辑此页面'
    },
}

export { textEN }