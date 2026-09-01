// Handles the zero-segment /api and /api/ requests exactly (Cloudflare Pages
// routing docs confirm index.js matches the directory path itself, and both
// "/foo" and "/foo/" resolve to the same function — see
// https://developers.cloudflare.com/pages/functions/routing/). [[path]].js's
// catch-all only ever sees requests with at least one path segment; whether
// a catch-all alone would also match zero segments is a documented silence
// in the official routing docs (01-RESEARCH.md Pitfall 2 / Pattern 1), and
// this split avoids depending on the answer. It was also settled empirically
// during 01-01: without this file, bare /api reached [[path]].js and threw —
// 500, Cloudflare error code 1101.
//
// 302, not 301: the redirect target embeds the current release's version
// number, which changes on every release. A 301 is cached permanently by
// browsers, so a reader who followed a 301 today would keep landing on a
// stale version forever, never re-requesting /api to pick up the new one
// (D-03). A plain proxy of the current version's index.html was considered
// and rejected: the browser would resolve that page's relative links against
// the /api/ URL itself (no version segment in the address bar), breaking
// every link on the page.
//
// Location's origin is built from the incoming request (context.request.url)
// rather than a hardcoded production host. 01-RESEARCH.md's own code sketch
// for this pattern hardcodes https://dev.ultikits.com — that sketch is
// corrected here: a hardcoded host would send PR-preview visitors to
// production, which defeats the entire point of verifying this behavior on a
// preview before it merges. Preview and production run the exact same code;
// only the request's own host differs.
import { CURRENT_VERSION, GENERATED_AT } from './_shared/version.generated.js';

export async function onRequestGet(context) {
  const location = new URL(
    `/api/${CURRENT_VERSION}/index.html`,
    context.request.url
  );

  // Response.redirect()'s return value has immutable headers, and this
  // response needs two more headers set (X-Robots-Tag, x-version-generated-at)
  // beyond what the redirect factory provides — so it's built by hand instead.
  const headers = new Headers({ Location: location.toString() });
  headers.set('X-Robots-Tag', 'noindex');
  headers.set('x-version-generated-at', GENERATED_AT);

  return new Response(null, { status: 302, headers });
}
