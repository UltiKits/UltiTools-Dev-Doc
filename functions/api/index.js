// Handles the zero-segment /api and /api/ requests. Cloudflare Pages routing
// docs confirm index.js matches the directory path itself, and both "/foo"
// and "/foo/" resolve to the same function — see
// https://developers.cloudflare.com/pages/functions/routing/ — and frame an
// exact route as more specific than a catch-all.
//
// CORRECTION (found live on this branch's preview, after this file alone
// did not fix the pre-existing bare-/api 500): that framing does not hold
// for this project's actual route dispatch. `wrangler pages functions build`
// emits the generated route list in filename-sort order — `[[path]].js`
// sorts before `index.js` ("[" < "i") — and the dispatcher that walks that
// list (pages-template-worker.ts's executeRequest) breaks on the FIRST
// pattern that matches, not the most specific one. `[[path]].js`'s own
// `/api/:path*` pattern matches zero segments too (`*` means "zero or
// more"), so it wins before this file is ever reached, for every request
// under /api including the bare one. This file is therefore correct in
// isolation and kept as the documented, intended owner of this route — but
// `[[path]].js` now carries an identical defensive fallback that is what
// actually executes; see that file's onRequestGet for the live code path
// and full citation.
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
import { withStandardHeaders } from './_shared/headers.js';

export async function onRequestGet(context) {
  const location = new URL(
    `/api/${CURRENT_VERSION}/index.html`,
    context.request.url
  );

  // Response.redirect()'s return value has immutable headers, and this
  // response needs more headers set (the CSP/X-Robots-Tag pair
  // withStandardHeaders applies, plus x-version-generated-at) beyond what
  // the redirect factory provides — so it's built by hand instead.
  //
  // withStandardHeaders (./_shared/headers.js) is the same function
  // [[path]].js applies to every other /api/* response. Before this
  // (WR-01, 02-REVIEW.md), this file built its Headers object without it
  // and never carried a Content-Security-Policy at all — harmless only
  // because [[path]].js's own catch-all route wins before this file is
  // ever reached in production (see the CORRECTION note above), not
  // because the omission was safe on its own terms.
  const headers = withStandardHeaders(new Headers({ Location: location.toString() }));
  headers.set('x-version-generated-at', GENERATED_AT);

  return new Response(null, { status: 302, headers });
}
