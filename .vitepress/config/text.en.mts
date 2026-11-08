import {DefaultTheme} from "vitepress/theme";
import type {PageData} from "vitepress";

// filePath is relative to srcDir ('docs'). VitePress serializes this function
// into the site data of every page, once per locale (21 copies), so it is kept
// short and must not use anything outside its own body.
//   src/<path>                      current page: edit it on master.
//   archive/<version>-SNAPSHOT/<p>  injected at build time from alpha's
//                                   docs/src (scripts/inject-alpha.mjs), so
//                                   docs/archive/... does not exist anywhere:
//                                   edit the alpha source instead.
//   archive/<version>/<path>        a frozen release snapshot: link to the file
//                                   for reading, not to the editor.
const editLinkPattern = ({filePath: p}: PageData): string => 'https://github.com/UltiKits/UltiTools-Dev-Doc/' +
    (/^archive\/[^/]+-SNAPSHOT\//.test(p) ? p.replace(/^archive\/[^/]+/, 'edit/alpha/docs/src')
        : p.startsWith('archive/') ? 'blob/master/docs/' + p : 'edit/master/docs/' + p)

const textEN: DefaultTheme.Config = {
    outline: {
      level: 'deep'
    },
    footer: {
        message: 'Released under the MIT License.',
        copyright: `Copyright © 2019-${new Date().getFullYear()} UltiKits Dev Team`
    },
    editLink: {
        pattern: editLinkPattern,
    },
}

export { textEN, editLinkPattern }