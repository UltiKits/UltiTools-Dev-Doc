// Injected into every javadoc page's <head> by functions/api/[[path]].js's
// HTMLRewriter chain (G-02-8). Makes /api/* pages follow this site's OWN
// appearance toggle in all three of its states (dark / light / auto), not
// just the OS/browser prefers-color-scheme media query
// functions/api/_shared/palette.js's dark table already responded to
// before this file existed.
//
// Key name is copied, not reinvented, from VitePress's own injected script:
//   - localStorage key: APPEARANCE_KEY = 'vitepress-theme-appearance'
//     (node_modules/vitepress/dist/client/shared.js:2)
//
// Three branches, evaluated in this order (G-02-20 fix — see the regression
// note below for why the order and the "everything else" branch matter):
//   1. preference === 'auto' -> add NOTHING. palette.js's
//      prefers-color-scheme media query is left as the sole authority, so
//      it keeps re-evaluating live if the reader changes their OS setting
//      after this page has already loaded — no class freezes the load-time
//      result.
//   2. preference === 'dark' -> classList.add('dark').
//   3. everything else (including the literal 'light' AND any unrecognized
//      value) -> classList.add(APPEARANCE_LIGHT_CLASS).
// Branch 3 is a load-bearing invariant, not a lazy fallback. VitePress's own
// "check-dark-mode" inline script (node_modules/vitepress/dist/node/index.js,
// also emitted pre-bundled at
// node_modules/vitepress/dist/node/chunk-D3CUZ4fa.js) resolves an
// unrecognized localStorage value to light: its ternary
// `(!preference || preference === 'auto') ? prefersDark : preference ===
// 'dark'` only takes the dark path when preference is EXACTLY 'dark' —
// anything else falls through to light. Branch 3 above reproduces that
// fall-through exactly, so an unrecognized value still resolves the SAME
// way here as on every other page of this site. Writing this branch as "if
// it is neither dark nor auto, add nothing" would be wrong: it would send
// unrecognized values down the live-media-query path meant only for 'auto',
// breaking that parity with VitePress.
//
// G-02-20 regression this fixes: before this three-branch form, 'auto' was
// folded into a single ternary and used `prefersDark` — the media query's
// result AT LOAD TIME — to decide whether to add 'dark' or the
// light-exclusion class. That froze the choice into a class, and neither of
// palette.js's two CSS rules re-evaluates afterward (:root.dark is a class
// selector that stays matched once added; the media-query rule is blocked
// by the light-exclusion class once that class is added), so a reader in
// 'auto' mode who changed their OS appearance after page load stayed stuck
// on whatever the media query said at load time. 'dark' and 'light' are
// unaffected by this fix — they never depended on the media query and were
// never supposed to follow the OS.
//
// Must run SYNCHRONOUSLY, inline, before body parsing — not async, not
// deferred. The javadoc page has no other CSS gating initial paint color;
// anything that ran after first paint would show one visible flash of the
// wrong theme on every navigation into /api/*.
//
// Only branches 2 and 3 add a class; branch 1 (auto) deliberately adds
// none. palette.js's media-query rule fires on prefers-color-scheme: dark
// regardless of what class is on <html>, so a reader who picked "light" on
// a system that prefers dark needs an explicit exclusion class for that
// media query to stop matching — without it, that one combination (site=
// light, system=dark) would still render dark. The exclusion class's
// literal name is 'ultitools-appearance-light', defined once in palette.js
// as APPEARANCE_LIGHT_CLASS and imported below rather than re-typed here,
// so the two files cannot silently disagree on the string. See palette.js's
// own header comment on APPEARANCE_LIGHT_CLASS for its six-combination
// table of how the two CSS rules there consume these classes.
//
// Six reachable combinations, this script's contribution updated for
// G-02-20 (the two 'auto' rows are what changed):
//   script ran, site=dark                        -> adds .dark
//   script ran, site=light                        -> adds light-exclusion
//   script ran, site=auto, system prefers dark     -> adds NOTHING; the
//                                                      media query matches
//                                                      live (dark)
//   script ran, site=auto, system prefers light    -> adds NOTHING; the
//                                                      media query does not
//                                                      match, live (light)
//   script did not run, system prefers dark        -> the media query
//                                                      (dark)
//   script did not run, system prefers light       -> neither rule matches
//                                                      (light)
// Previously the two 'auto' rows read "script adds a class" (whichever the
// load-time media query said); the script itself decided dark-vs-light for
// 'auto' once and never revisited it. Now the script adds nothing for
// 'auto', so palette.js's live media query is what decides — and keeps
// deciding, for as long as the page stays open. This is what makes 'auto'
// actually follow OS appearance changes instead of freezing them.
//
// Zero request-time input — same security invariant as backlink.js's
// header comment: this constant is fixed at build/deploy time and never
// interpolates anything derived from the request, so it carries none of
// backlink.js's XSS surface (this module has no per-request argument at
// all, unlike backlinkLiHtml). The script body also contains no substring
// that could close the <script> tag early (no literal "</script" appears
// anywhere below, including inside this comment block).
import { APPEARANCE_LIGHT_CLASS } from './palette.js';

export const APPEARANCE_SCRIPT = `<script>(function(){try{var key='vitepress-theme-appearance';var preference=localStorage.getItem(key)||'auto';if(preference==='auto'){}else if(preference==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.add('${APPEARANCE_LIGHT_CLASS}');}}catch(e){}})();</script>`;
