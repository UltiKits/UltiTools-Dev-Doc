// Reverse proxy for /api/{version}/{rest} -> javadoc.io/static/com.ultikits/UltiTools-API/{version}/{rest}.
//
// Scope of this file (Phase 1 tracer, Task 1): the plain pass-through path only.
// No bare-/api 302, no version-wrapper/ulti-tools-plugin 301s, no dedicated
// 404/502 degraded pages, no non-HTML branching beyond passing the upstream
// status through. Those are 01-03-PLAN.md's expansion of this tracer slice.
//
// _routes.json is deliberately NOT committed. The auto-generated one is derived
// from the real functions/ tree and can never drift from it; a hand-written one
// committed alongside could drift silently (site still builds, only routing
// changes). If Phase 2 needs scoping the auto-generated file can't express,
// re-evaluate then.

import { GENERATED_AT } from './_shared/version.generated.js';

// Upstream host and protocol live ONLY here. context.params.path never
// contributes to host/protocol — that boundary is the SSRF mitigation (T-01-01
// in 01-01-PLAN.md's threat register).
const UPSTREAM_ORIGIN = 'https://javadoc.io';
const UPSTREAM_PATH_PREFIX = '/static/com.ultikits/UltiTools-API';

const UPSTREAM_TIMEOUT_MS = 8000;

function isValidSegment(segment) {
  if (segment === '' || segment === '.' || segment === '..') return false;
  // Cloudflare's routing layer has already URL-decoded once; a segment
  // reaching here is not safe to treat as a raw string. Reject anything that
  // could still change the shape of the upstream path.
  if (/[/\\:%]/.test(segment)) return false;
  return true;
}

export async function onRequestGet(context) {
  const segments = context.params.path;

  for (const segment of segments) {
    if (!isValidSegment(segment)) {
      return new Response('Bad Request', { status: 400 });
    }
  }

  const upstreamUrl = new URL(
    `${UPSTREAM_PATH_PREFIX}/${segments.join('/')}`,
    UPSTREAM_ORIGIN
  );

  const cache = caches.default;
  const cached = await cache.match(context.request);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-cache', 'HIT');
    headers.set('x-version-generated-at', GENERATED_AT);
    return new Response(cached.body, { status: cached.status, headers });
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    // Network-level failure (DNS, connection refused, abort timeout). Full
    // degraded-page treatment (D-06/D-07) is 01-03-PLAN.md's scope; this is a
    // minimal safety net so the tracer doesn't surface an opaque runtime error.
    const headers = new Headers();
    headers.set('x-version-generated-at', GENERATED_AT);
    return new Response('Upstream unreachable', { status: 502, headers });
  }

  if (upstream.status < 200 || upstream.status >= 300) {
    // Non-2xx handling (dedicated 404/502 pages, D-07's Cache-Control: no-store)
    // is 01-03-PLAN.md's expansion. Here: pass the upstream status through
    // as-is and never cache it.
    const headers = new Headers();
    headers.set('x-upstream-status', String(upstream.status));
    headers.set('x-version-generated-at', GENERATED_AT);
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  // 2xx: clone headers (fetch's Headers object is immutable), strip the
  // upstream canonical link (D-05 — it always points off-site), mark noindex.
  const headers = new Headers(upstream.headers);
  headers.delete('link');
  headers.set('X-Robots-Tag', 'noindex');

  // Stream upstream.body straight through — do not await a full text() read.
  // Upstream objects run up to ~409 KB (member-search-index.js); reading them
  // into memory defeats the point of a streaming proxy.
  const response = new Response(upstream.body, {
    status: upstream.status,
    headers,
  });

  context.waitUntil(cache.put(context.request, response.clone()));

  const outgoingHeaders = new Headers(response.headers);
  outgoingHeaders.set('x-cache', 'MISS');
  outgoingHeaders.set('x-version-generated-at', GENERATED_AT);
  return new Response(response.body, {
    status: response.status,
    headers: outgoingHeaders,
  });
}
