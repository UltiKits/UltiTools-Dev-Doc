// Wraps caches.default in a read-through cache for the reverse proxy's 2xx
// path only. Error responses (404/5xx/unreachable) never reach cache.put —
// that decision is made by the caller BEFORE this module is even asked to
// cache anything (see readThrough below): the status/kind check happens
// first, and cache.put is called only inside the branch that already proved
// the result is cacheable. D-07 must not depend on cache.put itself
// rejecting a bad response shape — that would be relying on a runtime error
// to enforce a business rule.
import { fetchUpstream } from './upstream.js';

// readThrough(context, request, upstreamUrl) -> {
//   cached: boolean,          // true if served from caches.default
//   kind: 'ok'|'not-found'|'upstream-error'|'unreachable',
//   status: number|null,      // upstream's raw status (null when unreachable)
//   response: Response|null,  // present when kind === 'ok'; caller returns
//                              // this as-is (already carries x-cache)
//   upstreamRes: Response|null, // present on failure kinds, for callers that
//                                 // want to inspect/stream the upstream body
// }
export async function readThrough(context, request, upstreamUrl) {
  const cache = caches.default;

  const cached = await cache.match(request);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-cache', 'HIT');
    return {
      cached: true,
      kind: 'ok',
      status: cached.status,
      response: new Response(cached.body, { status: cached.status, headers }),
      upstreamRes: null,
    };
  }

  const result = await fetchUpstream(upstreamUrl);

  if (result.kind !== 'ok') {
    // Not cacheable — status/kind decided this before cache.put is ever
    // reachable. Caller (index.js / [[path]].js) builds the appropriate
    // degraded response and sets its own Cache-Control: no-store.
    return {
      cached: false,
      kind: result.kind,
      status: result.status,
      response: null,
      upstreamRes: result.res,
    };
  }

  // 2xx: clone headers (fetch's Headers object is immutable), strip the
  // upstream canonical link (D-05 — always points off-site), mark noindex.
  // Upstream's own cache-control (e.g. max-age=31536000 for a released
  // version's immutable static assets) is left untouched — we don't invent
  // a second TTL policy on top of it.
  const upstream = result.res;
  const storeHeaders = new Headers(upstream.headers);
  storeHeaders.delete('link');
  storeHeaders.set('X-Robots-Tag', 'noindex');

  const toStore = new Response(upstream.body, {
    status: upstream.status,
    headers: storeHeaders,
  });

  // The copy written into caches.default deliberately does NOT carry
  // x-cache — that header is a property of "how this particular response
  // to this particular reader was served", not of the cached content
  // itself. Adding it before cache.put would poison every future HIT with
  // whatever value happened to be set on the response that got cached.
  context.waitUntil(cache.put(request, toStore.clone()));

  const outgoingHeaders = new Headers(toStore.headers);
  outgoingHeaders.set('x-cache', 'MISS');

  return {
    cached: false,
    kind: 'ok',
    status: toStore.status,
    response: new Response(toStore.body, {
      status: toStore.status,
      headers: outgoingHeaders,
    }),
    upstreamRes: null,
  };
}
