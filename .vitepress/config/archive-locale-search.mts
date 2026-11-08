import {createRequire} from "node:module";
import path from "node:path";
import type {Plugin} from "vite";
import type {MarkdownEnv, SiteConfig} from "vitepress";
import type MiniSearchType from "minisearch";

// Search index for pages whose route locale differs from the locale VitePress's
// local search assigns them.
//
// VitePress 1.6.4's local search (localSearchPlugin in vitepress/dist/node)
// picks a page's index by testing the page's *source* path against every locale
// key with an unanchored `/${key}/` regex. The browser picks the index by the
// page's *route* locale. With @viteplus/versions the two disagree for archived
// pages of a non-root locale: the source archive/v6.2.4/zh/guide/x.md matches
// the current 'zh' key, while its route zh/v6.2.4/guide/x.html belongs to the
// 'zh/v6.2.4' locale. VitePress would put the page into the current Chinese
// index, and no 'zh/v6.2.4' index would exist.
//
// The search options cannot choose the index, so this module does it in two
// halves:
//   - renderForSearch() is the search `_render` hook. For a page whose two
//     locales disagree it renders the page itself, adds its sections to an
//     index named after the route locale, and returns '' so VitePress indexes
//     nothing for it.
//   - archiveLocaleSearchPlugin() serves those indexes: it adds them to the
//     '@localSearchIndex' manifest VitePress generates and fills each
//     '@localSearchIndex<locale>' module VitePress would otherwise leave empty.
//
// Pages whose two locales agree (current pages, English archives) go through
// VitePress unchanged. Locale keys and the route of every page come from the
// resolved site config, so a new version or language needs no edit here.

const LOCAL_SEARCH_INDEX_ID = '@localSearchIndex';
const LOCAL_SEARCH_INDEX_REQUEST_PATH = '/' + LOCAL_SEARCH_INDEX_ID;

// minisearch is a dependency of vitepress, not of this site. Resolving it from
// vitepress's own location loads the same copy VitePress builds its indexes
// with and the browser reads them with.
const requireFromVitepress = createRequire(createRequire(import.meta.url).resolve('vitepress/package.json'));
const MiniSearch: typeof MiniSearchType = requireFromVitepress('minisearch');

let siteConfig: SiteConfig | undefined;
const indexes = new Map<string, MiniSearchType>();

// The same lookup VitePress uses (getLocaleForPath): the first non-root locale
// key that occurs as `/${key}/` in the path. Used on the source path it gives
// the index VitePress would choose; on the route it gives the browser's.
function localeForPath(locales: Record<string, unknown>, relativePath: string): string {
    const target = `/${relativePath}`;
    return Object.keys(locales).find(
        (key) => key !== 'root' && !/^[a-z]+:/i.test(key) && new RegExp(`/${key}/`).test(target)
    ) ?? 'root';
}

function routeOf(config: SiteConfig, relativePath: string): string {
    return config.rewrites.map[relativePath] || relativePath;
}

// Same as getDocId in VitePress's local search.
function docIdOf(config: SiteConfig, relativePath: string): string {
    let id = path.posix.join(config.site.base, routeOf(config, relativePath));
    id = id.replace(/(^|\/)index\.md$/, '$1');
    return id.replace(/\.md$/, config.cleanUrls ? '' : '.html');
}

function getIndex(locale: string): MiniSearchType {
    let index = indexes.get(locale);
    if (!index) {
        index = new MiniSearch({
            fields: ['title', 'titles', 'text'],
            storeFields: ['title', 'titles'],
            ...siteConfig?.site.themeConfig?.search?.options?.miniSearch?.options
        });
        indexes.set(locale, index);
    }
    return index;
}

// Copy of VitePress 1.6.4's default page splitter (splitPageIntoSections),
// which is not exported. It turns rendered HTML into one entry per heading.
const headingRegex = /<h(\d*).*?>(.*?<a.*? href="#.*?".*?>.*?<\/a>)<\/h\1>/gi;
const headingContentRegex = /(.*?)<a.*? href="#(.*?)".*?>.*?<\/a>/i;
const clearHtmlTags = (str: string) => str.replace(/<[^>]*>/g, '');

function* splitPageIntoSections(html: string) {
    const result = html.split(headingRegex);
    result.shift();
    let parentTitles: string[] = [];
    for (let i = 0; i < result.length; i += 3) {
        const level = parseInt(result[i]) - 1;
        const heading = result[i + 1];
        const headingResult = headingContentRegex.exec(heading);
        const title = clearHtmlTags(headingResult?.[1] ?? '').trim();
        const anchor = headingResult?.[2] ?? '';
        const content = result[i + 2];
        if (!title || !content) continue;
        let titles = parentTitles.slice(0, level);
        titles[level] = title;
        titles = titles.filter(Boolean);
        yield {anchor, titles, text: clearHtmlTags(content)};
        if (level === 0) {
            parentTitles = [title];
        } else {
            parentTitles[level] = title;
        }
    }
}

// The search `_render` hook. Returns the HTML VitePress should index, or ''
// for a page this module indexes itself.
function renderForSearch(src: string, env: MarkdownEnv, md: { render: (src: string, env: MarkdownEnv) => string }): string {
    const config = siteConfig;
    if (!config) throw new Error('archive-locale-search: the Vite plugin is not registered (see vite.mts)');
    const locales = config.site.locales;
    const sourceLocale = localeForPath(locales, env.relativePath);
    const routeLocale = localeForPath(locales, routeOf(config, env.relativePath));

    // Same as VitePress's default renderer when _render is unset.
    const html = md.render(src, env);
    const searchable = env.frontmatter?.search === false ? '' : html;
    if (sourceLocale === routeLocale) return searchable;

    const index = getIndex(routeLocale);
    const fileId = docIdOf(config, env.relativePath);
    for (const {anchor, text, titles} of splitPageIntoSections(searchable)) {
        const doc = {id: anchor ? `${fileId}#${anchor}` : fileId, text, title: titles.at(-1), titles: titles.slice(0, -1)};
        // VitePress may index the site more than once per build (once per
        // bundle), so a repeated page replaces its earlier entry.
        if (index.has(doc.id)) index.replace(doc);
        else index.add(doc);
    }
    return '';
}

function archiveLocaleSearchPlugin(): Plugin {
    return {
        name: 'ultitools:archive-locale-search',
        configResolved(config) {
            siteConfig = (config as unknown as { vitepress: SiteConfig }).vitepress;
        },
        transform(code, id) {
            if (id === LOCAL_SEARCH_INDEX_REQUEST_PATH) {
                // VitePress emits `export default {"<locale>": () => import('@localSearchIndex<locale>'),...}`
                // after indexing every page, so all extra indexes exist by now.
                const match = /^export default \{(.*)\}$/s.exec(code.trim());
                if (!match) throw new Error('archive-locale-search: unexpected @localSearchIndex module shape; check the VitePress version');
                const records = [...indexes.keys()].map(
                    (locale) => `${JSON.stringify(locale)}: () => import(${JSON.stringify(LOCAL_SEARCH_INDEX_ID + locale)})`
                );
                return `export default {${[match[1], ...records].filter(Boolean).join(',')}}`;
            }
            if (id.startsWith(LOCAL_SEARCH_INDEX_REQUEST_PATH)) {
                const index = indexes.get(id.slice(LOCAL_SEARCH_INDEX_REQUEST_PATH.length));
                if (index) return `export default ${JSON.stringify(JSON.stringify(index))}`;
            }
        }
    };
}

export {archiveLocaleSearchPlugin, renderForSearch}
