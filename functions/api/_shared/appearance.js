// Injected into every javadoc page's <head> by functions/api/[[path]].js's
// HTMLRewriter chain (G-02-8). Makes /api/* pages follow this site's OWN
// appearance toggle in all three of its states (dark / light / auto), not
// just the OS/browser prefers-color-scheme media query
// functions/api/_shared/palette.js's dark table already responded to
// before this file existed.
//
// Key name and judgment expression are copied, not reinvented, from
// VitePress's own injected script:
//   - localStorage key: APPEARANCE_KEY = 'vitepress-theme-appearance'
//     (node_modules/vitepress/dist/client/shared.js:2)
//   - judgment expression: `(!preference || preference === 'auto') ?
//     prefersDark : preference === 'dark'`, from the "check-dark-mode"
//     inline script VitePress's own resolveSiteDataHead() injects into
//     every page it builds (node_modules/vitepress/dist/node/index.js,
//     also emitted pre-bundled at
//     node_modules/vitepress/dist/node/chunk-D3CUZ4fa.js, the
//     `;(() => { const preference = localStorage.getItem(...` block
//     that runs when `appearance` is left at its default, non-'force-*'
//     value). Copying the expression verbatim — not an equivalent-looking
//     rewrite — is what guarantees an unrecognized localStorage value
//     (anything other than 'auto', 'light', or 'dark') resolves the SAME
//     way here as on every other page of this site: VitePress treats that
//     case as light, and so does this script.
//
// Must run SYNCHRONOUSLY, inline, before body parsing — not async, not
// deferred. The javadoc page has no other CSS gating initial paint color;
// anything that ran after first paint would show one visible flash of the
// wrong theme on every navigation into /api/*.
//
// Both branches set a class, not just the dark branch: palette.js's
// media-query rule fires on prefers-color-scheme: dark regardless of what
// class is on <html>, so a reader who picked "light" on a system that
// prefers dark needs an explicit exclusion class for that media query to
// stop matching — without it, that one combination (site=light,
// system=dark) would still render dark. The exclusion class's literal
// name is 'ultitools-appearance-light', defined once in palette.js as
// APPEARANCE_LIGHT_CLASS and imported below rather than re-typed here, so
// the two files cannot silently disagree on the string. See palette.js's
// own header comment on APPEARANCE_LIGHT_CLASS for the full
// six-combination table (script ran x three site states, script did not
// run x two system states) this script's two branches feed into.
//
// Zero request-time input — same security invariant as backlink.js's
// header comment: this constant is fixed at build/deploy time and never
// interpolates anything derived from the request, so it carries none of
// backlink.js's XSS surface (this module has no per-request argument at
// all, unlike backlinkLiHtml). The script body also contains no substring
// that could close the <script> tag early (no literal "</script" appears
// anywhere below, including inside this comment block).
import { APPEARANCE_LIGHT_CLASS } from './palette.js';

export const APPEARANCE_SCRIPT = `<script>(function(){try{var key='vitepress-theme-appearance';var preference=localStorage.getItem(key)||'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=(!preference||preference==='auto')?prefersDark:preference==='dark';var classes=document.documentElement.classList;if(dark){classes.add('dark');}else{classes.add('${APPEARANCE_LIGHT_CLASS}');}}catch(e){}})();</script>`;
