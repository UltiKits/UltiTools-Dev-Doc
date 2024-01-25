import {DefaultTheme} from "vitepress/theme";
import {docSearchOptions} from "./search.mjs";
import {docSearchLocaleZH} from "./search.zh.mjs";
import {docSearchLocaleEN} from "./search.en.mjs";

const themeConfig: DefaultTheme.Config = {
    outline: {
        level: "deep"
    },
    search: {
        provider: 'algolia',
        options: {
            ...docSearchOptions,
            locales: {
                ...docSearchLocaleZH,
                ...docSearchLocaleEN
            }
        }
    }
}

export { themeConfig }