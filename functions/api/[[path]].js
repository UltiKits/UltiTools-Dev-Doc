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

import { GENERATED_AT, CURRENT_VERSION, ARCHIVED_VERSIONS } from './_shared/version.generated.js';
import { readThrough } from './_shared/cache.js';
import { notIndexedPage, upstreamDownPage } from './_shared/pages.js';
// PALETTE_MARKER dropped from this import (02-09 cleanup, editing this line
// anyway for appearance.js below): OVERRIDE_BLOCK is the only export of
// palette.js this file actually reads; PALETTE_MARKER has no reference
// below it.
import { OVERRIDE_BLOCK } from './_shared/palette.js';
import { backlinkLiHtml } from './_shared/backlink.js';
import { withStandardHeaders } from './_shared/headers.js';
// G-02-8: the appearance-detection script appended to every HTML response's
// <head> below. See that module's own header comment for the full
// reasoning (VitePress parity, sync-inline requirement, class semantics).
import { APPEARANCE_SCRIPT } from './_shared/appearance.js';

// Upstream host and protocol live ONLY here. context.params.path never
// contributes to host/protocol — that boundary is the SSRF mitigation (T-01-01
// in 01-01-PLAN.md's threat register).
const UPSTREAM_ORIGIN = 'https://javadoc.io';
const UPSTREAM_PATH_PREFIX = '/static/com.ultikits/UltiTools-API';

function isValidSegment(segment) {
  if (segment === '' || segment === '.' || segment === '..') return false;
  // Cloudflare's routing layer has already URL-decoded once; a segment
  // reaching here is not safe to treat as a raw string. Reject anything that
  // could still change the shape of the upstream path.
  if (/[/\\:%]/.test(segment)) return false;
  return true;
}

// G-02-7 version-root redirect: a single segment matching this pattern is
// treated as a bare version number (`/api/6.2.5`) and gets redirected
// straight to that version's index.html, instead of falling through to the
// proxy branch where it would 303 out of UPSTREAM_PATH_PREFIX (see
// upstream.js's header comment for the upstream behavior this closes).
//
// Anchored WHITELIST, not a reuse of isValidSegment's blacklist: this
// segment is about to be interpolated into a Location this Function sends
// to the browser (`new URL(...)` below), the second such place in this file
// (the first is the zero-segment guard above, which uses a build-time
// constant instead of request-derived input — T-02-08-02). isValidSegment's
// blacklist only rejects characters known to reshape the upstream path; it
// was never designed to prove a value is safe to place in a Location.
// Restricting this segment to digits and dots by construction makes path
// traversal or a cross-origin jump structurally impossible here, without
// having to re-argue whether the blacklist covers every case.
//
// A REGEX, not a membership test against CURRENT_VERSION/ARCHIVED_VERSIONS:
// verified against the live upstream during planning — a version that
// exists but is not yet indexed (e.g. 9.9.9) redirects to
// `/api/9.9.9/index.html`, which then 404s upstream, giving the reader the
// accurate "this version has not been indexed" page. A membership test
// would instead send that same request into the proxy branch, where
// upstream's own 303 gets caught by redirect-blocked and degrades to the
// identical page by a longer path — and a membership list needs editing
// every time a new version shape appears, where the regex needs none.
const VERSION_SEGMENT_RE = /^\d+(?:\.\d+)*$/;

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

// withStandardHeaders (D-05, D-26) now lives in ./_shared/headers.js,
// shared with index.js (WR-01, 02-REVIEW.md) — see that module's own
// header comment for the full CSP reasoning. Applied as the very last step
// before a Response leaves this file so no branch can forget it.

// Module-level memoization: the fingerprint depends only on this module's
// own template output (OVERRIDE_BLOCK, a fixed-argument rendering of
// backlinkLiHtml) and the build-time ARCHIVED_VERSIONS array, never on any
// per-request value, so every request in the same isolate reuses the same
// Promise instead of re-hashing identical bytes.
//
// The dummy version argument ('0.0.0') stays fixed on purpose: it keeps the
// fingerprint from varying per request the way the real per-page argument
// (segments[0]) would. segments[0] itself needs no folding in here — it is
// already part of the request URL, which the fingerprint is combined with
// to form the cache key (stampedCacheKey below), so a different segment[0]
// already produces a different cache key on its own.
//
// ARCHIVED_VERSIONS is folded in for real (not as a dummy), because it is
// the one input that changes the actual per-request output of
// backlinkLiHtml(segments[0], ARCHIVED_VERSIONS) without any source-code
// edit at all: every time a version is archived, this build-time array
// gains an entry, and every already-cached page under that version's
// prefix should switch from an empty-prefix backlink to a version-prefixed
// one. Without ARCHIVED_VERSIONS in the fingerprint, that switch would
// never invalidate the edge-cached HTML entry (CR-01, 02-REVIEW.md) — the
// cache key is the URL plus this stamp, and archiving a version changes
// neither on its own. GENERATED_AT is deliberately NOT folded in here: it
// changes on every build, which would bust the entire HTML edge cache on
// every deploy, not just on the archival/template changes this fingerprint
// exists to catch.
//
// Net effect: changing any color value in OVERRIDE_BLOCK, changing the
// <li>'s structure or copy, changing the injected appearance script's
// bytes, or archiving a new version all change the fingerprint
// automatically — no one has to remember to bump a version number by
// hand.
//
// G-02-8: APPEARANCE_SCRIPT is folded in for the same reason ARCHIVED_
// VERSIONS is — it is served bytes this Function controls that can change
// without any other input here changing, so leaving it out would mean an
// edit to appearance.js never invalidates HTML already sitting in the
// edge cache (same failure CR-01 fixed for ARCHIVED_VERSIONS, 02-REVIEW.md).
let themeStampPromise;

function themeStamp() {
  if (!themeStampPromise) {
    const fingerprintSource =
      OVERRIDE_BLOCK +
      backlinkLiHtml('0.0.0', []) +
      ARCHIVED_VERSIONS.join(',') +
      APPEARANCE_SCRIPT;
    themeStampPromise = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(fingerprintSource))
      .then((digest) => {
        const bytes = new Uint8Array(digest).slice(0, 4);
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      });
  }
  return themeStampPromise;
}

// The theme fingerprint is folded into the HTML edge-cache key (not into the
// key for stylesheet.css, which uses a short TTL instead — see the
// stylesheet branch below). This is the only channel by which a theming
// change reaches a reader whose copy is already sitting in the edge cache:
// the edge cache key is the URL, so without the fingerprint in it, a reader
// requesting an already-cached class page keeps getting yesterday's <li> and
// yesterday's palette (via the stylesheet's own long-lived edge copy, before
// its own TTL) until upstream's long max-age naturally expires.
function stampedCacheKey(request, stamp) {
  const url = new URL(request.url);
  url.searchParams.set('__theme', stamp);
  return new Request(url.toString(), request);
}

// Builds a weak validator ETag by combining the upstream's own ETag (or the
// literal "noetag" when upstream didn't send one) with the theme fingerprint,
// joined by a single hyphen. Weak (W/) because the bytes being served are not
// byte-for-byte identical to any single upstream representation — they're
// upstream bytes plus an appended override block.
function weakEtag(upstreamEtag, stamp) {
  const base = upstreamEtag ? upstreamEtag.replace(/^W\//, '').replace(/"/g, '') : 'noetag';
  return `W/"${base}-${stamp}"`;
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

  // G-02-7 version root: `/api/{version}` (no further path) redirects to
  // that version's index.html instead of falling through to the proxy
  // branch below, where the bare version segment would 303 out of
  // UPSTREAM_PATH_PREFIX (see VERSION_SEGMENT_RE's own comment, and
  // upstream.js's header comment for the upstream behavior this closes).
  // 302, not 301, for the same reason as the zero-segment guard above: a
  // 301 is cached by browsers permanently, and the target filename
  // (index.html) is not something this repository can promise forever.
  // Location is built from the incoming request (never a hardcoded host),
  // same as every other redirect in this file, so PR-preview visitors stay
  // on the preview domain.
  if (segments.length === 1 && VERSION_SEGMENT_RE.test(segments[0])) {
    const location = new URL(`/api/${segments[0]}/index.html`, context.request.url);
    const headers = withStandardHeaders(new Headers({ Location: location.toString() }));
    return new Response(null, { status: 302, headers });
  }

  const upstreamUrl = new URL(
    `${UPSTREAM_PATH_PREFIX}/${segments.join('/')}`,
    UPSTREAM_ORIGIN
  );

  const lastSegment = segments[segments.length - 1];
  // Exact filename match, not extension match: an extension match (".css")
  // would also catch any other upstream stylesheet javadoc might ship in a
  // future version, none of which this override block is written for.
  const isStylesheet = lastSegment === 'stylesheet.css';
  const isHtmlRequest = !isNonHtmlAsset(lastSegment);

  let readThroughOptions;

  if (isStylesheet) {
    readThroughOptions = {
      // This is the only place in this Function that reads an upstream body
      // entirely into memory. That is allowed here specifically because
      // stylesheet.css is measured at 30,650 bytes (RESEARCH.md §1.1) — a
      // world apart from the 409 KB-class objects like
      // member-search-index.js this proxy also serves. The exact-filename
      // check above (not an extension match) is what keeps this branch from
      // ever being reached by one of those larger files.
      transformOk: async (upstreamResponse) => {
        const upstreamBody = await upstreamResponse.text();
        const stampedBody = `${upstreamBody}\n${OVERRIDE_BLOCK}`;
        const stamp = await themeStamp();
        const headers = new Headers(upstreamResponse.headers);
        // D-20: stylesheet.css switches to a short, symmetric TTL on both
        // sides — Cloudflare-CDN-Cache-Control controls the edge copy,
        // Cache-Control controls the browser copy — instead of following
        // upstream's max-age=31536000. The edge doesn't get the fingerprint
        // folded into its cache key (unlike the HTML branch below); a short
        // TTL bounds staleness to at most one hour instead.
        headers.set('Cache-Control', 'public, max-age=3600');
        headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=3600');
        headers.set('ETag', weakEtag(upstreamResponse.headers.get('etag'), stamp));
        // Content-Length, if upstream sent one, describes the pre-append
        // byte count and is now wrong.
        headers.delete('Content-Length');
        return new Response(stampedBody, {
          status: upstreamResponse.status,
          headers,
        });
      },
    };
  } else if (isHtmlRequest) {
    const stamp = await themeStamp();
    readThroughOptions = {
      cacheKey: stampedCacheKey(context.request, stamp),
      transformOk: async (upstreamResponse) => {
        // D-27 (REVISED for G-02-8 — see 02-UAT.md's Scope Decision, D-38):
        // this Function now makes exactly TWO structural changes to
        // upstream HTML, not one. The original invariant ("the only
        // structural change is prepending one <li>") was explicitly
        // relaxed by the maintainer when scoping G-02-8: APIREF-02's
        // implementation constraint (custom-property overrides only) was
        // never meant to forbid appearance sync, and syncing the site's
        // own toggle onto this page structurally requires injecting a
        // script — there is no custom-property-only way to read
        // localStorage. The two changes are:
        //   1. Prepending one <li> to ul#navbar-top-firstrow (unchanged
        //      from the original D-27 — the guide/API backlink).
        //   2. Appending one inline <script> to <head> (new in G-02-8 —
        //      the appearance-detection script, functions/api/_shared/
        //      appearance.js).
        // This relaxation is scoped to appearance sync only. It does NOT
        // extend to the deep-mode magnifier icon test 4 exempted under
        // the same APIREF-02 constraint — that stays out of scope unless
        // separately decided.
        //
        // Cache argument, re-verified against the actual implementation
        // (not assumed) before writing this paragraph: APPEARANCE_SCRIPT
        // is a build-time constant (see appearance.js's own header
        // comment — zero request-time input), so the bytes appended here
        // are identical for every reader of a given deploy; which theme
        // those bytes RESOLVE to is decided entirely client-side, inside
        // the injected script, after the response has already left this
        // Function. stampedCacheKey (below) is still exactly "URL +
        // themeStamp", and themeStamp's fingerprintSource now folds in
        // APPEARANCE_SCRIPT (see that function's own comment) so an edit
        // to this script busts already-cached HTML the same way an edit
        // to OVERRIDE_BLOCK or a new archived version already did — but
        // neither the cache key's SHAPE nor its per-reader behavior
        // changes: no new dimension is added, and no Vary header is
        // introduced, because nothing about the response varies by
        // reader in the first place.
        const backlink = backlinkLiHtml(segments[0], ARCHIVED_VERSIONS);
        // CR-02 (02-REVIEW.md): same reasoning as the stylesheet branch's
        // weakEtag() call above — the served bytes are not byte-for-byte
        // identical to any single upstream representation, so upstream's
        // own ETag must not be passed through untouched. Set it on a
        // pre-transform copy of the headers (not the eventual stored/
        // outgoing headers built later in onRequestGet) so HTMLRewriter's
        // transform() carries it straight into both the client response
        // and the copy readThrough writes into caches.default — this is
        // the same composite validator, computed the same way, just
        // applied to the branch whose bytes actually change per D-29's
        // version-aware backlink and per CR-01's fingerprint fix.
        //
        // Content-Length is deliberately left untouched here, unlike the
        // stylesheet branch's explicit `headers.delete('Content-Length')`:
        // the body handed to HTMLRewriter.transform() below is a streamed
        // ReadableStream, not a fixed-length source, and Cloudflare's own
        // Response docs state "The Content-Length header is automatically
        // set by the runtime based on the Response data source, and any
        // manual value set in Headers will be ignored... Using any other
        // type of ReadableStream results in chunked encoding"
        // (developers.cloudflare.com/workers/runtime-apis/response). A
        // stale Content-Length value surviving in this Headers object has
        // no effect on what is actually sent.
        const headers = new Headers(upstreamResponse.headers);
        headers.set('ETag', weakEtag(upstreamResponse.headers.get('etag'), stamp));
        return new HTMLRewriter()
          .on('ul#navbar-top-firstrow', {
            element(el) {
              el.prepend(backlink, { html: true });
            },
          })
          .on('head', {
            // append, not prepend: prepending would insert ahead of
            // upstream's own <meta charset> tag, moving it out of the
            // "first 1024 bytes" position browsers require for charset
            // sniffing to reliably kick in. Appending lands at the end of
            // <head> instead, leaving charset's position untouched while
            // still executing before body parsing begins — first paint
            // never happens ahead of this script, so there is no flash of
            // the wrong theme.
            element(el) {
              el.append(APPEARANCE_SCRIPT, { html: true });
            },
          })
          .transform(
            new Response(upstreamResponse.body, {
              status: upstreamResponse.status,
              headers,
            })
          );
      },
    };
  }

  const result = await readThrough(context, context.request, upstreamUrl, readThroughOptions);

  if (result.kind === 'ok') {
    const headers = withStandardHeaders(new Headers(result.response.headers));
    headers.set('x-version-generated-at', GENERATED_AT);
    if (isHtmlRequest) {
      // D-20/D-27: the edge copy keeps following upstream's own long TTL
      // (the stored response's headers are untouched by this branch) — only
      // what's sent to THIS browser is shortened, because this response now
      // carries this repository's own bytes (the injected backlink <li> and,
      // as of G-02-8, the injected appearance-detection <script>) and
      // upstream's one-year max-age was never a promise about those bytes.
      headers.set('Cache-Control', 'public, max-age=3600');
    }
    return new Response(result.response.body, {
      status: result.response.status,
      headers,
    });
  }

  // Every failure branch below is deliberately never cached (D-07): no
  // cache.put call exists on this path at all, and Cache-Control: no-store
  // is set explicitly rather than relied upon as a side effect. This holds
  // for redirect-blocked too — it flows through the same result.kind !==
  // 'ok' branch in readThrough (cache.js), so no change was needed there.
  const upstreamStatusValue =
    result.kind === 'unreachable' ? 'unreachable' : String(result.status);
  const isRedirectBlocked = result.kind === 'redirect-blocked';

  if (isNonHtmlAsset(lastSegment)) {
    // A non-HTML asset that can't be fetched gets an honest empty response
    // with the real (or synthesized) status code, not a text/html body a
    // browser would flag as a MIME mismatch for a stylesheet or script.
    // redirect-blocked gets its own synthesized 404 here, same as
    // 'unreachable' synthesizes 502: result.status for that kind is the
    // upstream's raw 3xx, and sending a 3xx status code with an empty body
    // and no Location header would look like a broken redirect to the
    // browser, not a clean failure (T-02-08-01).
    const status = result.kind === 'unreachable' ? 502 : isRedirectBlocked ? 404 : result.status;
    const headers = withStandardHeaders(new Headers());
    headers.set('Cache-Control', 'no-store');
    headers.set('x-upstream-status', upstreamStatusValue);
    headers.set('x-version-generated-at', GENERATED_AT);
    if (isRedirectBlocked) {
      // G-02-7 / T-02-08-03: the fact that a redirect was blocked is
      // observable; the redirect's target is not. Never place
      // result.location (or anything derived from it) into a response
      // header.
      headers.set('x-upstream-redirect', 'blocked');
    }
    return new Response(null, { status, headers });
  }

  // HTML request: D-06/D-07's two-page/two-status-code split. "not-found"
  // (upstream 404) is a genuinely different reader-facing situation from
  // "upstream-error"/"unreachable" (upstream is broken or unreachable) —
  // one says "this version was never indexed", the other says "try again
  // later" — so they get different pages and different status codes.
  // redirect-blocked joins "not-found" here (G-02-7): from a reader's
  // perspective, "upstream 303'd us to its own site chrome instead of
  // content" and "upstream said 404" are the same fact — there is nothing
  // this Function can serve at this address.
  const headers = withStandardHeaders(new Headers());
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('x-upstream-status', upstreamStatusValue);
  headers.set('x-version-generated-at', GENERATED_AT);
  if (isRedirectBlocked) {
    headers.set('x-upstream-redirect', 'blocked');
  }

  if (result.kind === 'not-found' || isRedirectBlocked) {
    return new Response(notIndexedPage(CURRENT_VERSION), { status: 404, headers });
  }
  // upstream-error or unreachable both degrade to the same 502 page — the
  // reader-facing message is identical ("we couldn't reach javadoc.io right
  // now"), only x-upstream-status differs between them for anyone reading
  // response headers.
  return new Response(upstreamDownPage(CURRENT_VERSION), { status: 502, headers });
}
