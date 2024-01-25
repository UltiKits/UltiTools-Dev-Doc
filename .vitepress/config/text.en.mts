import {DefaultTheme} from "vitepress/theme";

const textEN: DefaultTheme.Config = {
    outline: {
      level: 'deep'
    },
    footer: {
        message: 'Released under the MIT License.',
        copyright: `Copyright © 2019-${new Date().getFullYear()} UltiKits Dev Team`
    }
}

export { textEN }