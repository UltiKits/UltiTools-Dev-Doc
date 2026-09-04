// Renders the <li> that functions/api/[[path]].js's HTMLRewriter prepends to
// the javadoc page's `ul#navbar-top-firstrow` (D-27, D-28, D-29). Two links,
// Docs and 中文文档, pointing back to this site's guide entry point.
//
// Security invariant, must hold on every code path: request-derived data
// NEVER enters the returned HTML. `requestedVersion` is used exactly once,
// as the right-hand side of a strict membership test against
// `archivedVersions`; when it matches, the path prefix that goes into the
// output is the ARRAY ELEMENT that matched (a build-time-known string from
// docs/archive/'s directory listing), never `requestedVersion` itself or a
// string built from it. When it does not match, the prefix is the empty
// string. Every element of `archivedVersions` originates from a build-time
// `readdirSync('docs/archive')` call (scripts/generate-api-version.mjs) —
// it is never influenced by any single request. This makes reflected XSS
// structurally impossible here, the same shape as functions/api/_shared/
// pages.js's single-arity contract (see that file's header comment).
//
// No class attribute, no inline style, no icon: the javadoc page's own
// `<li>` siblings under #navbar-top-firstrow carry none of those either, so
// this one inherits the page's existing styling and its
// `#navbar-toggle-button` mobile-collapse behavior for free. Adding a class
// or an icon would need a new CSS rule, and APIREF-02 scopes this Phase's
// changes to custom-property overrides only.
//
// The two links place the version segment differently, which is not a typo.
// English is the root locale and carries no locale segment, so its archived
// path is /<version>/guide/... . Chinese is served at /<locale>/<version>/guide/...
// with the locale first. Building the Chinese href as `${prefix}/zh/...` yields
// /<version>/zh/..., which the site served only while locale.zh.mts carried
// `link: '/zh/'` and @viteplus/versions could not recognise `zh` as a language.
// A redirect rule in docs/public/_redirects still catches that old shape, but
// emitting it here would make every archived Chinese backlink take a 301 hop.
//
// The security invariant above is unchanged by the reordering: `prefix` is
// still the matched ARRAY ELEMENT, never request-derived data.
export function backlinkLiHtml(requestedVersion, archivedVersions) {
  const candidate = `v${requestedVersion}`;
  const matched = archivedVersions.find((version) => version === candidate);
  const prefix = matched ? `/${matched}` : '';
  return `<li><a href="${prefix}/guide/introduction">Docs</a>&nbsp;&middot;&nbsp;<a href="/zh${prefix}/guide/introduction">中文文档</a></li>`;
}
