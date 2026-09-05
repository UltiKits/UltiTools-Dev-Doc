// Fetches an upstream URL and classifies the outcome into exactly one of
// five kinds. This classification is the technical foundation D-06/D-07's
// two-page/two-status-code split rests on:
//
//   ok               upstream responded 2xx — content exists
//   not-found        upstream responded 404 — javadoc.io itself says no
//   redirect-blocked upstream responded 3xx — see G-02-7 below
//   upstream-error   upstream responded some other non-2xx status
//   unreachable      fetch() itself threw (DNS failure, connection refused,
//                    or the AbortSignal.timeout below firing)
//
// fetch() only rejects on a network-layer failure. Any HTTP status code —
// including 404 and 500 — is a normal resolve, never a catch. Mixing "fetch
// threw" and "fetch resolved with a bad status" into one branch is exactly
// the mistake that would collapse the not-indexed/upstream-down distinction
// this module exists to keep separate (01-RESEARCH.md Pattern 2).
//
// Timeout uses fetch's own `signal` option with AbortSignal.timeout — not a
// Promise.race against a sleep. A race only makes the calling Promise settle
// early; the underlying fetch keeps running in the background and the
// connection is never actually cancelled. AbortSignal.timeout is part of the
// Fetch standard and genuinely aborts the in-flight request.
//
// G-02-7: redirect is explicitly 'manual', and every 3xx is classified as
// redirect-blocked — never followed. This is checked BEFORE the "non-2xx"
// range check below, because without a dedicated classification a 3xx would
// fall into upstream-error, a strictly weaker signal that loses the
// distinction this module exists to preserve. Four facts, verified against
// the live upstream during planning, back the "reject every 3xx" choice:
//
// 1. Every single-segment version root (`/static/{ga}/6.2.5`, `/static/{ga}
//    /foo`, `/static/{ga}/9.9.9`) returns 303 to `/doc/...` — a path OUTSIDE
//    UPSTREAM_PATH_PREFIX entirely, javadoc.io's own site chrome rather than
//    javadoc content. A directory path with a trailing slash
//    (`/static/{ga}/6.2.5/com/ultikits/ultitools/`) returns 301 to the same
//    path minus the trailing slash — still INSIDE the prefix — which then
//    404s. `index.html`, `stylesheet.css`, class pages,
//    `member-search-index.js`, `allclasses-index.html` all return 200
//    directly, no redirect at all.
// 2. Therefore nothing this Function ever constructs today depends on
//    following a redirect to get content: the only prefix-internal redirect
//    observed is triggered by a trailing slash, and every upstream URL this
//    Function builds is produced via `segments.join('/')` on a
//    non-empty-segment array, which never has a trailing slash.
// 3. Why not "follow only when the redirect stays inside the prefix": even
//    one followed hop means the bytes served came from a URL this Function
//    never itself constructed — and "the upstream host and path prefix live
//    only in [[path]].js" is exactly the SSRF mitigation (T-01-01,
//    01-01-PLAN.md). Teaching this module the prefix (to check "did the
//    Location stay inside it") — or threading the prefix in as a parameter —
//    both add a second exit from that boundary. Rejecting every 3xx is a
//    superset of "reject only prefix-escaping 3xx" and needs no new
//    cross-module constant.
// 4. The cost, and why it's acceptable: if upstream ever adds a
//    prefix-internal redirect that actually leads to content, a reader gets
//    the "not yet indexed" page instead of that content. That is a loud,
//    visible failure — scripts/verify-api-proxy.sh and readers see it
//    immediately — unlike today's silent "serve a foreign page as if it were
//    javadoc" failure this module exists to close.
const UPSTREAM_TIMEOUT_MS = 8000;

export async function fetchUpstream(url, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    });
  } catch (err) {
    // DNS failure, connection refused, or the AbortSignal.timeout above
    // firing (surfaces as an AbortError) all land here — none of them mean
    // "upstream said no", they mean "never got an answer at all".
    return { kind: 'unreachable', status: null, res: null, err };
  }

  if (res.status === 404) {
    return { kind: 'not-found', status: res.status, res };
  }
  if (res.status >= 300 && res.status < 400) {
    // G-02-7: never followed (redirect: 'manual' above), never served as
    // content. `location` is exposed for the caller to log/observe — it
    // must never be echoed back to the browser (T-02-08-03).
    return {
      kind: 'redirect-blocked',
      status: res.status,
      res,
      location: res.headers.get('location'),
    };
  }
  if (res.status < 200 || res.status >= 300) {
    return { kind: 'upstream-error', status: res.status, res };
  }
  return { kind: 'ok', status: res.status, res };
}
