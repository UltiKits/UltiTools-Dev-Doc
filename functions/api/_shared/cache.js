// Wraps caches.default in a read-through cache for the reverse proxy's 2xx
// path only. Error responses (404/5xx/unreachable) never reach cache.put —
// that decision is made by the caller BEFORE this module is even asked to
// cache anything (see readThrough below): the status/kind check happens
// first, and cache.put is called only inside the branch that already proved
// the result is cacheable. D-07 must not depend on cache.put itself
// rejecting a bad response shape — that would be relying on a runtime error
// to enforce a business rule.
import { fetchUpstream } from './upstream.js';

// readThrough(context, request, upstreamUrl, options) -> {
//   cached: boolean,          // true if served from caches.default
//   kind: 'ok'|'not-found'|'upstream-error'|'unreachable',
//   status: number|null,      // upstream's raw status (null when unreachable)
//   response: Response|null,  // present when kind === 'ok'; caller returns
//                              // this as-is (already carries x-cache)
//   upstreamRes: Response|null, // present on failure kinds, for callers that
//                                 // want to inspect/stream the upstream body
// }
//
// options (added Phase 2, D-20/D-27) is an optional object with two optional
// fields, both no-ops when omitted so pre-Phase-2 callers are unaffected:
//
//   cacheKey   Request used for cache.match / cache.put instead of `request`.
//              Defaults to `request` itself. The caller is responsible for
//              the key's URL being same-origin with the request.
//   transformOk  async (Response) => Response. Called on the upstream
//              response, ONLY on the 2xx path, BEFORE `toStore` is built.
//              Its return value's body and headers become `toStore`'s
//              source — the copy written into caches.default is the
//              TRANSFORMED one, not the raw upstream bytes. This is the
//              precondition for 304 revalidation to work at all once a
//              transform is involved: caches.default matches a stored
//              response's ETag against the request's If-None-Match, so if
//              the stored copy were the untransformed upstream body, an
//              ETag we compute from the transformed bytes would never
//              match what's actually stored, and conditional requests down
//              this path would always fall through to a full 200.
export async function readThrough(context, request, upstreamUrl, options = {}) {
  const { cacheKey = request, transformOk } = options;
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
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

  // 2xx: run the caller's transform (if any) BEFORE cloning/stripping
  // headers, so X-Robots-Tag and the link-header deletion below always run
  // last and can't be undone by a transform that happens to clone headers
  // from its input. transformOk's return value — body AND headers — is
  // what gets stored; when it's absent, `transformed` is just the raw
  // upstream response and behavior is byte-identical to pre-Phase-2.
  const upstream = result.res;
  const transformed = transformOk ? await transformOk(upstream) : upstream;

  const storeHeaders = new Headers(transformed.headers);
  storeHeaders.delete('link');
  storeHeaders.set('X-Robots-Tag', 'noindex');

  const toStore = new Response(transformed.body, {
    status: transformed.status,
    headers: storeHeaders,
  });

  // Upstream's own cache-control (e.g. max-age=31536000 for a released
  // version's immutable static assets) is left untouched for responses that
  // pass through with no transformOk — we don't invent a second TTL policy
  // on top of it there. That posture stops holding once transformOk is
  // supplied: the upstream's one-year max-age backs the claim "this
  // release's javadoc is immutable", and a transformed response already
  // has this repository's own bytes mixed in (a palette override block, an
  // injected backlink <li>), a claim the upstream's TTL was never meant to
  // cover. Callers that pass transformOk are expected to set their own
  // Cache-Control (and, for stylesheet.css, Cloudflare-CDN-Cache-Control)
  // inside that function — this module does not impose one, since the two
  // Phase 2 transform call sites need different TTLs for the browser vs.
  // the edge copy.
  context.waitUntil(cache.put(cacheKey, toStore.clone()));

  // The copy written into caches.default deliberately does NOT carry
  // x-cache — that header is a property of "how this particular response
  // to this particular reader was served", not of the cached content
  // itself. Adding it before cache.put would poison every future HIT with
  // whatever value happened to be set on the response that got cached.
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
