import {readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {DefaultTheme} from "vitepress/theme";
import {localeEN} from "./locale.en.mjs";
import {localeZH} from "./locale.zh.mjs";

// Non-root locale keys ('zh' today), read from the locale config so a new
// language needs no edit here.
const nonRootLocales = Object.keys({...localeEN, ...localeZH}).filter((key) => key !== 'root');

// Archived versions, read the same way @viteplus/versions builds its version
// list: every directory under docs/archive (including v6.3.0-SNAPSHOT when
// scripts/inject-alpha.mjs has run). No per-version bookkeeping here.
const archiveVersions = readdirSync(fileURLToPath(new URL('../../docs/archive/', import.meta.url)), {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

// VitePress 1.6.4's local search picks a page's index by testing the *source*
// path (relative to srcDir) against each locale key with an unanchored
// `/${key}/` regex (localSearchPlugin -> getLocaleForPath). A Chinese archived
// page lives at archive/<version>/zh/..., so it matches the current 'zh' key
// before any 'zh/<version>' key and lands in the current Chinese index:
// 226 of its 259 pages were archived ones. English archived pages live at
// archive/<version>/..., match the '<version>' key and get their own
// per-version index, which is why English search was unaffected.
//
// The index a page goes into cannot be changed from these options, so archived
// pages of a non-root locale are left out of the index entirely. Their own
// route ('zh/<version>') never had an index in the build output, so search on
// those pages finds nothing, before and after this change.
function isArchivedNonRootLocalePage(relativePath: string): boolean {
    const [top, , locale] = relativePath.split('/');
    return top === 'archive' && nonRootLocales.includes(locale);
}

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
            _render(src, env, md) {
                if (isArchivedNonRootLocalePage(env.relativePath)) return '';
                // Same as VitePress's default renderer when _render is unset.
                const html = md.render(src, env);
                return env.frontmatter?.search === false ? '' : html;
            }
        }
    }
}

export { themeConfig }
