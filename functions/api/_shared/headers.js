// Every response under /api/* — 2xx, redirect, or error — carries these
// headers (D-05, D-26). Shared between [[path]].js (the catch-all that
// actually serves /api/* in production) and index.js (the zero-segment
// route that is currently unreachable by route-dispatch ordering, but is
// still shipped and exported as onRequestGet — see index.js's own header
// comment for the full citation). Living in one module means neither file
// can silently drift from the CSP invariant the other one enforces
// (WR-01, 02-REVIEW.md): before this module existed, index.js built its
// redirect Response by hand and never set a Content-Security-Policy at
// all, correct only "in isolation", dependent on an undocumented
// third-party route-ordering detail staying the way it is today.
export function withStandardHeaders(headers) {
  headers.delete('link');
  headers.set('X-Robots-Tag', 'noindex');
  // D-26: a Content-Security-Policy without a nonce (a nonce must be unique
  // per response, which would defeat edge caching entirely — see
  // 02-CONTEXT.md's Deferred Ideas). style-src carries 'unsafe-inline' in
  // addition to the five directives D-26 originally enumerated
  // (default-src, script-src, connect-src, object-src, base-uri):
  // functions/api/_shared/pages.js's two degraded pages each embed a
  // <style> block via styleBlock(), and style-src's default inheritance
  // from default-src 'self' would block inline <style> tags, degrading
  // those fallback pages to unstyled plain text — exactly what Phase 1's
  // acceptance criteria 3 requires they not be. Adding 'unsafe-inline' to
  // style-src does not widen the egress this CSP exists to close: outbound
  // network connections are still limited to same-origin by connect-src
  // 'self', object-src 'none' still blocks plugins, base-uri 'self' still
  // blocks relative-URL-base hijacking, and any url(...) reference inside
  // CSS remains bound by default-src 'self'. script-src also carries
  // 'unsafe-inline' — javadoc's own page has exactly one inline <script>
  // block (sets `pathtoroot` and calls `loadScripts`) that the page's own
  // search and navigation depend on; nonce-ing it has the same caching
  // problem as above.
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'"
  );
  return headers;
}
