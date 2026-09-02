// Fetches an upstream URL and classifies the outcome into exactly one of
// four kinds. This classification is the technical foundation D-06/D-07's
// two-page/two-status-code split rests on:
//
//   ok             upstream responded 2xx — content exists
//   not-found      upstream responded 404 — javadoc.io itself says no
//   upstream-error upstream responded some other non-2xx status
//   unreachable    fetch() itself threw (DNS failure, connection refused,
//                  or the AbortSignal.timeout below firing)
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
const UPSTREAM_TIMEOUT_MS = 8000;

export async function fetchUpstream(url, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    // DNS failure, connection refused, or the AbortSignal.timeout above
    // firing (surfaces as an AbortError) all land here — none of them mean
    // "upstream said no", they mean "never got an answer at all".
    return { kind: 'unreachable', status: null, res: null, err };
  }

  if (res.status === 404) {
    return { kind: 'not-found', status: res.status, res };
  }
  if (res.status < 200 || res.status >= 300) {
    return { kind: 'upstream-error', status: res.status, res };
  }
  return { kind: 'ok', status: res.status, res };
}
