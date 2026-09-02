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
export function backlinkLiHtml(requestedVersion, archivedVersions) {
  const candidate = `v${requestedVersion}`;
  const matched = archivedVersions.find((version) => version === candidate);
  const prefix = matched ? `/${matched}` : '';
  return `<li><a href="${prefix}/guide/introduction">Docs</a>&nbsp;&middot;&nbsp;<a href="${prefix}/zh/guide/introduction">中文文档</a></li>`;
}
