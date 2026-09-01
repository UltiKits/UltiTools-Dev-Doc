// Reverse proxy for /api/{version}/{rest} -> javadoc.io/static/com.ultikits/UltiTools-API/{version}/{rest}.
//
// Scope as of this commit (01-03 Task 1): path validation, the 2xx pass-
// through path via the extracted upstream/cache modules, and non-HTML asset
// failure handling. The zero-segment /api and /api/ redirect, the two
// retired-path 301s, and the HTML-request 404/502 degraded pages are wired
// up in this same plan's later tasks (index.js and _shared/pages.js do not
// exist yet at this commit).
//
// _routes.json is deliberately NOT committed. The auto-generated one is derived
// from the real functions/ tree and can never drift from it; a hand-written one
// committed alongside could drift silently (site still builds, only routing
// changes). If Phase 2 needs scoping the auto-generated file can't express,
// re-evaluate then.

import { GENERATED_AT } from './_shared/version.generated.js';
import { readThrough } from './_shared/cache.js';

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

  for (const segment of segments) {
    if (!isValidSegment(segment)) {
      const headers = withStandardHeaders(new Headers());
      return new Response('Bad Request', { status: 400, headers });
    }
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

  // HTML request failure branch: this plan's Task 3 replaces the body below
  // with the real notIndexedPage()/upstreamDownPage() from
  // functions/api/_shared/pages.js (D-06/D-07's two-page split). Until that
  // task lands, this is a minimal, honest placeholder — not the final
  // reader-facing text — that still carries the correct status code and
  // no-store so the acceptance criteria this task owns (non-HTML branching,
  // module extraction, noindex/no-link on every response) can be verified
  // independent of the page-content task.
  const status = result.kind === 'unreachable' ? 502 : result.status === 404 ? 404 : 502;
  const headers = withStandardHeaders(new Headers());
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('x-upstream-status', upstreamStatusValue);
  headers.set('x-version-generated-at', GENERATED_AT);
  return new Response('Upstream error', { status, headers });
}
