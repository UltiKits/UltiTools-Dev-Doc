// Reverse proxy for /api/{version}/{rest} -> javadoc.io/static/com.ultikits/UltiTools-API/{version}/{rest}.
//
// index.js sits next to this file and takes the zero-segment /api and /api/
// requests (302 to the current release). This file only ever sees requests
// with at least one path segment (see 01-RESEARCH.md Pattern 1 / Pitfall 2 —
// the official routing docs are silent on whether a catch-all matches a
// zero-segment request, so the split avoids depending on the answer).
//
// _routes.json is deliberately NOT committed. The auto-generated one is derived
// from the real functions/ tree and can never drift from it; a hand-written one
// committed alongside could drift silently (site still builds, only routing
// changes). If Phase 2 needs scoping the auto-generated file can't express,
// re-evaluate then.

import { GENERATED_AT, CURRENT_VERSION } from './_shared/version.generated.js';
import { readThrough } from './_shared/cache.js';
import { notIndexedPage, upstreamDownPage } from './_shared/pages.js';

// Upstream host and protocol live ONLY here. context.params.path never
// contributes to host/protocol — that boundary is the SSRF mitigation (T-01-01
// in 01-01-PLAN.md's threat register).
const UPSTREAM_ORIGIN = 'https://this-host-does-not-exist.invalid';
const UPSTREAM_PATH_PREFIX = '/static/com.ultikits/UltiTools-API';

function isValidSegment(segment) {
  if (segment === '' || segment === '.' || segment === '..') return false;
  // Cloudflare's routing layer has already URL-decoded once; a segment
  // reaching here is not safe to treat as a raw string. Reject anything that
  // could still change the shape of the upstream path.
  if (/[/\\:%]/.test(segment)) return false;
  return true;
}

// A segment counts as a non-HTML asset request when its last path component
// has a dot-extension that isn't "html" (e.g. stylesheet.css,
// member-search-index.js). No extension at all, or an .html extension, is
// treated as an HTML page request and gets the full degraded-page treatment
// instead of an empty body.
function isNonHtmlAsset(lastSegment) {
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0) return false;
  const ext = lastSegment.slice(dot + 1).toLowerCase();
  return ext !== 'html';
}

// Every response this Function produces — 2xx, redirect, or error — carries
// these two headers (D-05): no upstream canonical, always noindex. Applied
// as the very last step before a Response leaves this file so no branch can
// forget it.
function withStandardHeaders(headers) {
  headers.delete('link');
  headers.set('X-Robots-Tag', 'noindex');
  return headers;
}

export async function onRequestGet(context) {
  const segments = context.params.path;

  // Defensive fallback for the zero-segment case (bare /api or /api/).
  // index.js is supposed to own this — Cloudflare's own routing docs frame
  // an exact route as more specific than a catch-all — but that framing
  // does not hold here. Verified two ways: `wrangler pages functions build`
  // emits routes in filename-sort order (`[[path]].js` before `index.js`,
  // since "[" < "i"), and the dispatcher that consumes that array
  // (pages-template-worker.ts's executeRequest) breaks on the FIRST route
  // whose pattern matches, not the most specific one — so this file's own
  // `/api/:path*` pattern (which matches zero segments too, since `*` means
  // "zero or more") wins before index.js's exact `/api` is ever reached.
  // Confirmed live on this branch's preview: with only index.js's redirect
  // logic in place, bare /api still 500'd with the exact "error code: 1101"
  // this task exists to fix, because context.params.path arrives here as
  // undefined and the loop below threw "segments is not iterable". index.js
  // is left in place — it is harmless, correct in isolation, and documents
  // the intended per-file ownership — but this guard is what actually runs.
  if (!segments || segments.length === 0) {
    const location = new URL(`/api/${CURRENT_VERSION}/index.html`, context.request.url);
    const headers = withStandardHeaders(new Headers({ Location: location.toString() }));
    headers.set('x-version-generated-at', GENERATED_AT);
    return new Response(null, { status: 302, headers });
  }

  for (const segment of segments) {
    if (!isValidSegment(segment)) {
      const headers = withStandardHeaders(new Headers());
      return new Response('Bad Request', { status: 400, headers });
    }
  }

  // Two retired single-segment paths get a permanent redirect instead of
  // being forwarded upstream (D-13/D-14). Location's origin is built from
  // the incoming request, never a hardcoded host — a hardcoded host would
  // throw PR-preview visitors onto production (see index.js's header
  // comment for the full reasoning, which applies identically here).
  if (segments.length === 1 && segments[0] === 'version-wrapper') {
    // D-13: this target is pinned to CURRENT_VERSION, and 301s are cached
    // permanently by browsers. A reader who follows this redirect today
    // will keep landing on THIS release's VersionWrapper page even after a
    // later release ships — they will never re-request /api/version-wrapper
    // to pick up a newer pin. That staleness is accepted as the tradeoff
    // for D-13's decision to retire the page: VersionWrapper has been
    // @Deprecated since 6.2.0 and is slated for removal, so once it's
    // actually gone from a future API, a permanently-pinned link to the
    // last release that had it is the only target left that still resolves
    // at all. Surfaced to the user at 01-05-PLAN.md's merge decision gate.
    const location = new URL(
      `/api/${CURRENT_VERSION}/com/ultikits/ultitools/interfaces/VersionWrapper.html`,
      context.request.url
    );
    const headers = withStandardHeaders(new Headers({ Location: location.toString() }));
    return new Response(null, { status: 301, headers });
  }
  if (segments.length === 1 && segments[0] === 'ulti-tools-plugin') {
    const location = new URL('/guide/advanced/ulti-tools-plugin', context.request.url);
    const headers = withStandardHeaders(new Headers({ Location: location.toString() }));
    return new Response(null, { status: 301, headers });
  }

  const upstreamUrl = new URL(
    `${UPSTREAM_PATH_PREFIX}/${segments.join('/')}`,
    UPSTREAM_ORIGIN
  );

  const result = await readThrough(context, context.request, upstreamUrl);

  if (result.kind === 'ok') {
    const headers = withStandardHeaders(new Headers(result.response.headers));
    headers.set('x-version-generated-at', GENERATED_AT);
    return new Response(result.response.body, {
      status: result.response.status,
      headers,
    });
  }

  // Every failure branch below is deliberately never cached (D-07): no
  // cache.put call exists on this path at all, and Cache-Control: no-store
  // is set explicitly rather than relied upon as a side effect.
  const lastSegment = segments[segments.length - 1];
  const upstreamStatusValue =
    result.kind === 'unreachable' ? 'unreachable' : String(result.status);

  if (isNonHtmlAsset(lastSegment)) {
    // A non-HTML asset that can't be fetched gets an honest empty response
    // with the real (or synthesized) status code, not a text/html body a
    // browser would flag as a MIME mismatch for a stylesheet or script.
    const status = result.kind === 'unreachable' ? 502 : result.status;
    const headers = withStandardHeaders(new Headers());
    headers.set('Cache-Control', 'no-store');
    headers.set('x-upstream-status', upstreamStatusValue);
    headers.set('x-version-generated-at', GENERATED_AT);
    return new Response(null, { status, headers });
  }

  // HTML request: D-06/D-07's two-page/two-status-code split. "not-found"
  // (upstream 404) is a genuinely different reader-facing situation from
  // "upstream-error"/"unreachable" (upstream is broken or unreachable) —
  // one says "this version was never indexed", the other says "try again
  // later" — so they get different pages and different status codes.
  const headers = withStandardHeaders(new Headers());
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('x-upstream-status', upstreamStatusValue);
  headers.set('x-version-generated-at', GENERATED_AT);

  if (result.kind === 'not-found') {
    return new Response(notIndexedPage(CURRENT_VERSION), { status: 404, headers });
  }
  // upstream-error or unreachable both degrade to the same 502 page — the
  // reader-facing message is identical ("we couldn't reach javadoc.io right
  // now"), only x-upstream-status differs between them for anyone reading
  // response headers.
  return new Response(upstreamDownPage(CURRENT_VERSION), { status: 502, headers });
}
