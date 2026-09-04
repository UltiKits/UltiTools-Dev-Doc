#!/usr/bin/env bash
# Build-artifact assertion gate for the self-destroying rescue worker
# (CACHE-02). Runs AFTER a build, against .vitepress/dist.
#
# This script is the verification carrier this phase uses in place of a test
# runner. This repository has no test runner and no test files, and
# REQUIREMENTS.md FUT-04 defers introducing one past v1.0, so the three
# carriers available are: the existing repo gates, assertions over the build
# artifact (this script), and enumerated manual observation.
#
# Two modes:
#   (no argument)   the CI gate. Zero-argument mode is what docs-ci.yml's
#                   `build` job calls, immediately after `npm run build`,
#                   following scripts/check-rendered-links.sh's pattern — no
#                   separate job, no live URL needed for the CI gate itself.
#                   Exit code comes ONLY from the five numbered assertions
#                   below.
#   <base-url>      adds a live-URL half: fetches <base-url>/sw.js and
#                   records its edge response headers, a cache-busted etag
#                   comparison, and a classifier verdict on the served bytes,
#                   as evidence for the CACHE-01 audit (05-AUDIT.md). This
#                   half is evidence, not a gate — it never assigns to
#                   `status`, so an unreachable host or a network failure can
#                   never turn the CI gate red. There is no mandatory-argument
#                   guard here (unlike scripts/verify-api-proxy.sh and
#                   scripts/verify-snapshot.sh): the whole point of the CI
#                   gate is that a filename/scope mistake is caught before
#                   any deployed URL exists.
#
# set -uo pipefail, not set -e: one failed assertion must not abort the
# remaining ones — the value of a numbered-assertion script is a complete
# report from a single run.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/.vitepress/dist"
status=0

record() { # record <label> <observed> <0|1>  (verbatim from verify-api-proxy.sh)
  if [ "$3" -eq 0 ]; then
    printf 'PASS  %-56s  %s\n' "$1" "$2"
  else
    printf 'FAIL  %-56s  %s\n' "$1" "$2"
    status=1
  fi
}

# is_self_destroying_worker <file> — the content classifier. Returns 0 when
# <file> is the vite-plugin-pwa `selfDestroying` rescue template, 1
# otherwise (including when the file is missing or unreadable, so a missing
# artifact is a failure and never a silent pass).
#
# Positive half: all three substrings the rescue template's install/activate
# handlers carry (05-RESEARCH.md § Code Examples, confirmed against the
# installed vite-plugin-pwa@0.21.2 package and a real local build).
# Negative half: absence of the AMD module-wrapper prefix that opens the
# workbox precache worker's first line — production's sw.js today begins
# with that wrapper followed by a hashed workbox chunk name.
#
# Every check below greps a file already on disk — never a captured shell
# variable piped through printf into grep -q. grep -q exits on first match
# and closes its stdin; under pipefail a writer's SIGPIPE death on the far
# side of that pipe would propagate as a non-zero pipeline exit even though
# the match succeeded (scripts/verify-snapshot.sh:27-34, a reproduced defect
# in this repository).
is_self_destroying_worker() {
  local file="$1"
  [ -f "$file" ] && [ -r "$file" ] || return 1
  grep -q 'self\.skipWaiting()' "$file" || return 1
  grep -q 'self\.registration\.unregister()' "$file" || return 1
  grep -q 'self\.caches\.delete(cacheName)' "$file" || return 1
  grep -q 'define(\[' "$file" && return 1
  return 0
}

# self_check — the positive control. Applies is_self_destroying_worker to
# two bundled fixtures, one that must be rejected and one that must be
# accepted. This is what stops the gate from reporting green after the
# classifier has stopped discriminating.
self_check() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  local fixture_workbox="$tmp/workbox-shaped.js"
  local fixture_rescue="$tmp/rescue-shaped.js"

  # Fixture A — shaped like the workbox precache worker's opening line: the
  # AMD module-wrapper prefix followed by a quoted hashed workbox chunk
  # name. Must be REJECTED (is_self_destroying_worker returns 1).
  printf 'define(["./workbox-7883ad30ea6ce6a4bf1c37fb1f7c1c1f"], function (workbox) {\n  "use strict";\n  importScripts("workbox-7883ad30ea6ce6a4bf1c37fb1f7c1c1f");\n});\n' \
    > "$fixture_workbox"

  # Fixture B — carries the three substrings the rescue template carries.
  # Must be ACCEPTED (is_self_destroying_worker returns 0).
  cat > "$fixture_rescue" <<'FIXTURE'
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => {
        if (client instanceof WindowClient)
          client.navigate(client.url);
      });
      return Promise.resolve();
    })
    .then(() => {
      self.caches.keys().then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) => {
            return self.caches.delete(cacheName);
          }),
        );
      })
    });
});
FIXTURE

  local workbox_result=0 rescue_result=0
  is_self_destroying_worker "$fixture_workbox"; workbox_result=$?
  is_self_destroying_worker "$fixture_rescue"; rescue_result=$?

  if [ "$workbox_result" -eq 1 ] && [ "$rescue_result" -eq 0 ]; then
    return 0
  fi
  if [ "$workbox_result" -ne 1 ]; then
    echo "self_check: workbox-shaped fixture was NOT rejected (expected reject)" >&2
  fi
  if [ "$rescue_result" -ne 0 ]; then
    echo "self_check: rescue-shaped fixture was NOT accepted (expected accept)" >&2
  fi
  return 1
}

# 1 — dist/sw.js exists at the unchanged filename. Makes a build-less run
# fail loudly instead of reporting green over an empty artifact tree.
if [ -f "$DIST/sw.js" ]; then
  record "1 dist/sw.js 存在（文件名未变）" "$DIST/sw.js" 0
else
  record "1 dist/sw.js 存在（文件名未变）" "$DIST/sw.js" 1
fi

# 2 — content is the self-destroying rescue template, not a workbox
# precache worker.
if is_self_destroying_worker "$DIST/sw.js"; then
  record "2 sw.js 内容是自毁 worker（非 workbox precache worker）" "$DIST/sw.js" 0
else
  record "2 sw.js 内容是自毁 worker（非 workbox precache worker）" "$DIST/sw.js" 1
fi

# 3 — size ceiling. The rescue template is ~608 bytes; the workbox precache
# worker currently on production is 131,881 bytes. A size ceiling is used
# rather than asserting the absence of a workbox runtime file elsewhere in
# dist: this project's PWA output directory sits outside Vite's root, so a
# stale file from an earlier local build can survive into a later one and
# would make a file-absence check red locally and green in CI for reasons
# that have nothing to do with the change.
if [ -f "$DIST/sw.js" ]; then
  sw_size=$(wc -c < "$DIST/sw.js" | tr -d ' ')
  if [ "$sw_size" -lt 4096 ]; then
    record "3 sw.js 小于 4096 字节（自毁模板约 608B，生产 workbox worker 131,881B）" "${sw_size} bytes" 0
  else
    record "3 sw.js 小于 4096 字节（自毁模板约 608B，生产 workbox worker 131,881B）" "${sw_size} bytes" 1
  fi
else
  record "3 sw.js 小于 4096 字节（自毁模板约 608B，生产 workbox worker 131,881B）" "<无文件>" 1
fi

# 4 — the compiled registration chunk is present and still constructs its
# worker against the literal /sw.js at the literal root scope. This is the
# assertion that catches the failure this phase exists to avoid: if the
# registration code is dropped, a reader who has not yet run an update check
# never fetches the rescue bytes at all, and nothing local would reveal it.
chunk=$(find "$DIST/assets/chunks" -maxdepth 1 -iname 'virtual_pwa-register.*.js' 2>/dev/null | head -1)
chunk_result=1
if [ -n "$chunk" ] && grep -q '"/sw.js"' "$chunk" && grep -q 'scope:"/"' "$chunk"; then
  chunk_result=0
fi
record "4 注册代码仍在 bundle 内，/sw.js 与根 scope 字面量未变" "chunk=${chunk:-<未找到>}" "$chunk_result"

# 5 — self_check, the positive control. Both verdicts must be right or the
# item is FAIL.
if self_check; then
  record "5 内容分类器自检（拒绝 workbox 样例、接受 rescue 样例）" "两个 fixture 均判定正确" 0
else
  record "5 内容分类器自检（拒绝 workbox 样例、接受 rescue 样例）" "fixture 判定有误，见上方 stderr" 1
fi

# Optional live-URL half — evidence for the CACHE-01 audit, never a gate.
# Entered only when the first positional argument is present and non-empty;
# there is no exit-2 mandatory-argument guard (verify-api-proxy.sh and
# verify-snapshot.sh both have one — inverted here on purpose, see header).
if [ "$#" -ge 1 ] && [ -n "${1:-}" ]; then
  BASE_URL="${1%/}"

  livetmp=$(mktemp -d)
  trap 'rm -rf "$livetmp"' EXIT

  # fetch_sw_headers <url> <outfile> — populates <outfile> with the response
  # headers for <url>. Follows scripts/verify-snapshot.sh's fetch() shape:
  # body/headers written straight to disk by curl, never captured into a
  # shell variable that a later grep would have to pipe through.
  fetch_sw_headers() {
    local url="$1"
    local outfile="$2"
    curl -sS -D "$outfile" -o /dev/null -w '%{http_code}' \
      --max-time 30 --connect-timeout 10 "$url"
  }

  # field <header-name> <headers-file> — prints the header line if present,
  # or the field name with an explicit empty marker if absent. A missing
  # line and an absent header must not look the same in recorded evidence.
  field() {
    local name="$1"
    local file="$2"
    local val
    val=$(grep -i "^${name}:" "$file" 2>/dev/null | tr -d '\r' | head -1)
    if [ -n "$val" ]; then
      echo "$val"
    else
      echo "${name}: <空>"
    fi
  }

  headers_plain="$livetmp/headers-plain.txt"
  http_status=$(fetch_sw_headers "$BASE_URL/sw.js" "$headers_plain")

  echo "AUDIT  http-status: $http_status"
  echo "AUDIT  $(field 'cache-control' "$headers_plain")"
  echo "AUDIT  $(field 'etag' "$headers_plain")"
  echo "AUDIT  $(field 'cf-cache-status' "$headers_plain")"
  echo "AUDIT  $(field 'content-length' "$headers_plain")"

  # Cache-busted comparison — 05-RESEARCH.md's one genuinely open question:
  # whether Cloudflare's edge (a layer separate from the browser's HTTP
  # cache, and outside the update-cache mode that provably bypasses the
  # browser's own cache) could serve a stale /sw.js to an update-check
  # fetch. Answered empirically: fetch a second time with a timestamp query
  # parameter and compare etags. Equal etags rules the concern out; unequal
  # etags is the one result that must be surfaced to the maintainer rather
  # than absorbed into a PASS.
  headers_busted="$livetmp/headers-busted.txt"
  fetch_sw_headers "$BASE_URL/sw.js?_cachebust=$(date +%s)" "$headers_busted" >/dev/null

  etag_plain=$(grep -i '^etag:' "$headers_plain" 2>/dev/null | tr -d '\r' | head -1)
  etag_busted=$(grep -i '^etag:' "$headers_busted" 2>/dev/null | tr -d '\r' | head -1)
  cf_status_plain=$(grep -i '^cf-cache-status:' "$headers_plain" 2>/dev/null | tr -d '\r' | head -1)
  cf_status_busted=$(grep -i '^cf-cache-status:' "$headers_busted" 2>/dev/null | tr -d '\r' | head -1)

  echo "AUDIT  cache-busted 对比: plain [${etag_plain:-<空>} / ${cf_status_plain:-<空>}]  vs  cache-busted [${etag_busted:-<空>} / ${cf_status_busted:-<空>}]"
  if [ -n "$etag_plain" ] && [ "$etag_plain" = "$etag_busted" ]; then
    echo "AUDIT  verdict: etags matched — 无边缘陈旧字节的证据"
  else
    echo "AUDIT  verdict: etags did NOT match — 需要向维护者呈报，见 05-AUDIT.md"
  fi

  # Content confirmation on the live URL — reuses the Task 1 classifier
  # is_self_destroying_worker; no second copy is written.
  body_file="$livetmp/sw-body.js"
  curl -sS -o "$body_file" --max-time 30 --connect-timeout 10 "$BASE_URL/sw.js" || true
  if is_self_destroying_worker "$body_file"; then
    echo "AUDIT  classifier verdict on served /sw.js: IS the self-destroying rescue template"
  else
    echo "AUDIT  classifier verdict on served /sw.js: is NOT the self-destroying rescue template"
  fi
fi

echo
if [ "$status" -eq 0 ]; then
  echo "全部通过"
else
  echo "存在 FAIL，见上方"
fi
exit "$status"
