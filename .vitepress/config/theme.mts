import {readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {DefaultTheme} from "vitepress/theme";
import {renderForSearch} from "./archive-locale-search.mjs";

// Archived versions, read the same way @viteplus/versions builds its version
// list: every directory under docs/archive (including v6.3.0-SNAPSHOT when
// scripts/inject-alpha.mjs has run). No per-version bookkeeping here.
const archiveVersions = readdirSync(fileURLToPath(new URL('../../docs/archive/', import.meta.url)), {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const zhSearchTranslations: DefaultTheme.LocalSearchOptions['translations'] = {
    button: {
        buttonText: '搜索文档',
        buttonAriaLabel: '搜索文档'
    },
    modal: {
        noResultsText: '无法找到相关结果',
        resetButtonTitle: '清除查询条件',
        footer: {
            selectText: '选择',
            navigateText: '切换',
            closeText: '关闭'
        }
    }
}

const searchTranslations: Record<string, DefaultTheme.LocalSearchOptions['translations']> = {
    zh: zhSearchTranslations
}

// The search box looks translations up by the page's locale key, and an
// archived Chinese page's key is 'zh/<version>' (added by @viteplus/versions),
// so each of those keys needs the same entry as 'zh'.
const searchLocales: NonNullable<DefaultTheme.LocalSearchOptions['locales']> = {};
for (const [locale, translations] of Object.entries(searchTranslations)) {
    searchLocales[locale] = {translations};
    for (const version of archiveVersions) {
        searchLocales[`${locale}/${version}`] = {translations};
    }
}

const themeConfig: DefaultTheme.Config = {
    search: {
        provider: 'local',
        options: {
            locales: searchLocales,
            // Archived pages of a non-root locale (zh/v6.2.4/...) get their own
            // per-version index here; see archive-locale-search.mts.
            _render: renderForSearch
        }
    }
}

export { themeConfig }
