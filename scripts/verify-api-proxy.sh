#!/usr/bin/env bash
# curl-only verification for functions/api/[[path]].js and functions/api/index.js
# against a real deployed URL (a PR preview or production). Cloudflare Pages
# Functions have no local emulator that reproduces caches.default or the edge
# routing layer faithfully (01-RESEARCH.md disqualifies `wrangler pages dev`
# for exactly this reason — it has a known AbortSignal.timeout bug that
# produces false negatives). This script covers the ROADMAP.md Phase 1
# acceptance criteria that CAN be expressed with curl (see 01-VALIDATION.md's
# Manual-Only Verifications table, which this script turns into a repeatable
# command instead of a one-off manual curl session).
#
# Not wired into CI. .github/workflows/docs-ci.yml's three jobs (build,
# bilingual-parity, container-length) only ever read the repository — none of
# them have a deployed URL to hit, and this script needs one as its first
# argument.
#
# The base URL is a required first positional argument on purpose: hardcoding
# a domain here would make the script usable against exactly one deployment,
# defeating the reason it exists — running the same checks against a PR
# preview BEFORE the thing they verify ever reaches production, then again
# against production after merge.
#
# Contract note for 01-03-PLAN.md: functions/api/_shared/pages.js (01-03's
# artifact) does not exist yet as of this script being written in 01-02. The
# NOT_INDEXED_MARKER string below is this script's executable spec for that
# page's content — 01-03's notIndexedPage() must contain it verbatim
# (case-insensitive), or item 3 below fails once 01-03 lands and this script
# is re-run against a preview.
#
# set -uo pipefail, not set -e: a failed curl or a failed assertion must not
# abort the run early. Every item below has to execute regardless of earlier
# results, so one run gives a complete picture instead of stopping at the
# first FAIL.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
status=0

usage() {
  cat <<'USAGE' >&2
用法: verify-api-proxy.sh <base-url> [version]

  base-url  必填，不带尾斜杠。PR preview 域名（Cloudflare Pages 为每个 PR
            自动生成）或生产域名（从 Cloudflare Pages 项目设置里读取，本脚本
            不写死任何具体域名，两处都能跑）。
  version   可选。默认从 examples/pom.xml 的 <ultitools.version> 解析，与
            scripts/generate-api-version.mjs 用同一条正则读同一行。

示例：verify-api-proxy.sh https://<deployment-id>.pages.dev
USAGE
}

if [ "$#" -lt 1 ] || [ -z "${1:-}" ]; then
  usage
  exit 2
fi

BASE_URL="${1%/}"

if [ -n "${2:-}" ]; then
  CURRENT_VERSION="$2"
else
  # Same regex shape as scripts/generate-api-version.mjs's
  # /<ultitools\.version>([^<]+)<\/ultitools\.version>/ — both read the same
  # one line of examples/pom.xml, so a release bump never requires touching
  # this script.
  CURRENT_VERSION=$(grep -oE '<ultitools\.version>[^<]+</ultitools\.version>' "$ROOT/examples/pom.xml" \
    | sed -E 's#</?ultitools\.version>##g')
  if [ -z "${CURRENT_VERSION:-}" ]; then
    echo "verify-api-proxy: 无法从 examples/pom.xml 解析出 <ultitools.version>，且未提供第二个参数" >&2
    exit 2
  fi
fi

# A version guaranteed to never be indexed on javadoc.io (D-09: "version
# exists but unindexed" and "version never existed" are indistinguishable
# upstream — both are a bare 404 on /static/ — so one fixture covers both).
NEVER_INDEXED_VERSION="9.9.9"

echo "base url : $BASE_URL"
echo "version  : $CURRENT_VERSION"
echo

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
seq_n=0
API_HEADERS=()

record() {
  # record <label> <observed-value> <result: 0=pass 1=fail> — one printed
  # line per item, carrying the item name, the observed value, and PASS/FAIL.
  if [ "$3" -eq 0 ]; then
    printf 'PASS  %-56s  %s\n' "$1" "$2"
  else
    printf 'FAIL  %-56s  %s\n' "$1" "$2"
    status=1
  fi
}

# fetch [--path-as-is] <url> — populates $HTTP_STATUS, $HEADERS_FILE,
# $BODY_FILE for one request. No -L: an unfollowed redirect's own status code
# and Location header are exactly what most items below need to assert on.
# --path-as-is is opt-in per call because curl otherwise squashes "/../"
# sequences out of the URL path before ever sending the request, which would
# make item 8's path-traversal probe never reach the Function at all.
fetch() {
  local path_as_is=""
  if [ "$1" = "--path-as-is" ]; then path_as_is="--path-as-is"; shift; fi
  local url="$1"
  seq_n=$((seq_n + 1))
  HEADERS_FILE="$TMPDIR/h.$seq_n"
  BODY_FILE="$TMPDIR/b.$seq_n"
  HTTP_STATUS=$(curl -s $path_as_is -o "$BODY_FILE" -D "$HEADERS_FILE" -w '%{http_code}' --max-time 30 "$url")
}

header_value() {
  # header_value <headers-file> <name> — case-insensitive; last match wins
  # (a single unfollowed response is one status block, so "last" == "only").
  grep -i "^$2:" "$1" 2>/dev/null | tail -1 | sed -E 's/^[^:]+:[[:space:]]*//' | tr -d '\r'
}

has_header() {
  # has_header <headers-file> <name> -> exit 0 if present, 1 if absent
  grep -qi "^$2:" "$1" 2>/dev/null
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. 已索引版本的类页可读
# ─────────────────────────────────────────────────────────────────────────────
url_class="$BASE_URL/api/$CURRENT_VERSION/com/ultikits/ultitools/abstracts/UltiToolsPlugin.html"
fetch "$url_class"
API_HEADERS+=("$HEADERS_FILE")
ctype=$(header_value "$HEADERS_FILE" "content-type")
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
printf '%s' "$ctype" | grep -qi 'text/html' || r=1
record "1 已索引版本类页可读" "status=$HTTP_STATUS content-type=${ctype:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 2. 同一 URL 连续两次请求，第二次命中边缘缓存
# ─────────────────────────────────────────────────────────────────────────────
fetch "$url_class"
API_HEADERS+=("$HEADERS_FILE")
xc_first=$(header_value "$HEADERS_FILE" "x-cache")
fetch "$url_class"
API_HEADERS+=("$HEADERS_FILE")
xc_second=$(header_value "$HEADERS_FILE" "x-cache")
r=0
[ "$xc_second" = "HIT" ] || r=1
record "2 二次请求命中边缘缓存" "第一次 x-cache=${xc_first:-<无>} 第二次 x-cache=${xc_second:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 3. 上游必然未索引的版本：404 + 尚未索引页 + no-store，两次请求都不进缓存
# ─────────────────────────────────────────────────────────────────────────────
NOT_INDEXED_MARKER="has not been indexed"
url_404="$BASE_URL/api/$NEVER_INDEXED_VERSION/index.html"
fetch "$url_404"
API_HEADERS+=("$HEADERS_FILE")
status_404a="$HTTP_STATUS"
body_404a=$(cat "$BODY_FILE" 2>/dev/null || true)
cc_404a=$(header_value "$HEADERS_FILE" "cache-control")
xc_404a=$(header_value "$HEADERS_FILE" "x-cache")
fetch "$url_404"
API_HEADERS+=("$HEADERS_FILE")
status_404b="$HTTP_STATUS"
xc_404b=$(header_value "$HEADERS_FILE" "x-cache")

r=0
[ "$status_404a" = "404" ] || r=1
[ "$status_404b" = "404" ] || r=1
printf '%s' "$body_404a" | grep -qi "$NOT_INDEXED_MARKER" || r=1
printf '%s' "$cc_404a" | grep -qi 'no-store' || r=1
[ "$xc_404a" != "HIT" ] || r=1
[ "$xc_404b" != "HIT" ] || r=1
marker_hit="未命中"
printf '%s' "$body_404a" | grep -qi "$NOT_INDEXED_MARKER" && marker_hit="命中"
record "3 未索引版本 404 加尚未索引页" \
  "status=${status_404a}/${status_404b} cache-control=${cc_404a:-<无>} x-cache=${xc_404a:-<无>}/${xc_404b:-<无>} marker=${marker_hit}" \
  "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 4. 裸的 /api 与 /api/ 都 302 到当前发布版首页
# ─────────────────────────────────────────────────────────────────────────────
for bare_path in "/api" "/api/"; do
  fetch "$BASE_URL$bare_path"
  API_HEADERS+=("$HEADERS_FILE")
  loc=$(header_value "$HEADERS_FILE" "location")
  r=0
  [ "$HTTP_STATUS" = "302" ] || r=1
  printf '%s' "$loc" | grep -q "$CURRENT_VERSION" || r=1
  printf '%s' "$loc" | grep -q "index.html" || r=1
  record "4 裸路径 ${bare_path} 302 到当前版首页" "status=$HTTP_STATUS location=${loc:-<无>}" "$r"
done

# ─────────────────────────────────────────────────────────────────────────────
# 5. 两个退役路径 301；且 301 目标本身可达（避免 301 永久缓存指向一个 404）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/api/version-wrapper"
API_HEADERS+=("$HEADERS_FILE")
loc_vw=$(header_value "$HEADERS_FILE" "location")
r=0
[ "$HTTP_STATUS" = "301" ] || r=1
printf '%s' "$loc_vw" | grep -q "com/ultikits/ultitools/interfaces/VersionWrapper.html" || r=1
record "5a version-wrapper 301 到 javadoc 目标" "status=$HTTP_STATUS location=${loc_vw:-<无>}" "$r"

if [ -n "$loc_vw" ]; then
  fetch "$loc_vw"
  API_HEADERS+=("$HEADERS_FILE")
  r=0
  [ "$HTTP_STATUS" = "200" ] || r=1
  record "5a-follow version-wrapper 301 目标本身 200" "status=$HTTP_STATUS" "$r"
else
  record "5a-follow version-wrapper 301 目标本身 200" "上一步未取得 Location，跳过" 1
fi

fetch "$BASE_URL/api/ulti-tools-plugin"
API_HEADERS+=("$HEADERS_FILE")
loc_utp=$(header_value "$HEADERS_FILE" "location")
r=0
[ "$HTTP_STATUS" = "301" ] || r=1
printf '%s' "$loc_utp" | grep -q "/guide/advanced/ulti-tools-plugin" || r=1
record "5b ulti-tools-plugin 301 到新讲解页位置" "status=$HTTP_STATUS location=${loc_utp:-<无>}" "$r"

if [ -n "$loc_utp" ]; then
  fetch "$loc_utp"
  r=0
  [ "$HTTP_STATUS" = "200" ] || r=1
  record "5b-follow ulti-tools-plugin 301 目标本身 200" "status=$HTTP_STATUS" "$r"
else
  record "5b-follow ulti-tools-plugin 301 目标本身 200" "上一步未取得 Location，跳过" 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. 边界项：/api/ 之外的站内页面不带本 Phase 新增的响应头
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/"
r=0
for h in x-cache x-version-generated-at x-upstream-status; do
  has_header "$HEADERS_FILE" "$h" && r=1
done
record "7 站内页面不带 /api/ 专属响应头" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 8. 路径穿越：请求不产生 200，响应体不泄露 /api/ 挂载点之外的内容
# ─────────────────────────────────────────────────────────────────────────────
# Rewritten in 02-01 (Rule 1 bug fix, per 01-03-SUMMARY.md's explicit
# handoff). The original assertion checked for a literal 400 from this
# repo's own isValidSegment(). 01-03's investigation established that
# literal payload can never reach that check: Cloudflare's edge normalizes
# "../" segments (RFC 3986 §6.2.2.3-style) BEFORE context.params.path is
# populated, so `com/../../etc/passwd` already arrives here as the ordinary
# -looking segments `etc/passwd`, which pass validation and 404 upstream.
# Multi-variant testing in that investigation (raw, single- and
# double-URL-encoded, over-traversal past the mount root, a colon segment)
# confirmed the actual security property — never a 200, never content
# leaked outside the intended upstream prefix — holds in every case, even
# though this one literal-status-code expectation cannot be satisfied by
# any code change available in functions/. This assertion now tests that
# property directly instead of a status code no code path here can produce.
fetch --path-as-is "$BASE_URL/api/$CURRENT_VERSION/com/../../etc/passwd"
API_HEADERS+=("$HEADERS_FILE")
body_traversal=$(cat "$BODY_FILE" 2>/dev/null || true)
r=0
[ "$HTTP_STATUS" != "200" ] || r=1
printf '%s' "$body_traversal" | grep -qE 'root:.*:0:0:' && r=1
record "8 路径穿越请求不产生 200 且不泄露挂载点外内容" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 9. stylesheet 响应体含覆盖块标记
# ─────────────────────────────────────────────────────────────────────────────
# 与 functions/api/_shared/palette.js 的 PALETTE_MARKER 逐字一致——脚本与
# Function 之间的契约，与既有的 NOT_INDEXED_MARKER 同一形状。
PALETTE_MARKER='/* ultitools-dev-doc site palette override */'
url_stylesheet="$BASE_URL/api/$CURRENT_VERSION/stylesheet.css"
fetch "$url_stylesheet"
API_HEADERS+=("$HEADERS_FILE")
body_stylesheet_a=$(cat "$BODY_FILE" 2>/dev/null || true)
r=0
printf '%s' "$body_stylesheet_a" | grep -qF "$PALETTE_MARKER" || r=1
record "9 stylesheet 响应体含覆盖块标记" "标记=${PALETTE_MARKER}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 10. stylesheet 响应体含深色媒体查询
# ─────────────────────────────────────────────────────────────────────────────
r=0
printf '%s' "$body_stylesheet_a" | grep -q 'prefers-color-scheme: dark' || r=1
record "10 stylesheet 响应体含深色媒体查询" "" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 11. stylesheet Cache-Control 的 max-age 是 3600
# ─────────────────────────────────────────────────────────────────────────────
cc_stylesheet_a=$(header_value "$HEADERS_FILE" "cache-control")
r=0
printf '%s' "$cc_stylesheet_a" | grep -qE 'max-age=3600(;|,|$)' || r=1
record "11 stylesheet Cache-Control max-age=3600" "cache-control=${cc_stylesheet_a:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 12. 连续两次请求 stylesheet，ETag 相等且形状是「弱验证器 + 连字符 + 8 位十六进制」
# ─────────────────────────────────────────────────────────────────────────────
etag_stylesheet_a=$(header_value "$HEADERS_FILE" "etag")
fetch "$url_stylesheet"
API_HEADERS+=("$HEADERS_FILE")
etag_stylesheet_b=$(header_value "$HEADERS_FILE" "etag")
r=0
[ -n "$etag_stylesheet_a" ] || r=1
[ "$etag_stylesheet_a" = "$etag_stylesheet_b" ] || r=1
printf '%s' "$etag_stylesheet_a" | grep -qE '^W/"[^"]*-[0-9a-f]{8}"$' || r=1
record "12 stylesheet 两次请求 ETag 相等且形状匹配" "etag=${etag_stylesheet_a:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 13. 带上一步 ETag 作为 If-None-Match 复发，得到 304 且响应体 0 字节
# ─────────────────────────────────────────────────────────────────────────────
seq_n=$((seq_n + 1))
HEADERS_FILE="$TMPDIR/h.$seq_n"
BODY_FILE="$TMPDIR/b.$seq_n"
HTTP_STATUS=$(curl -s -o "$BODY_FILE" -D "$HEADERS_FILE" -w '%{http_code}' --max-time 30 \
  -H "If-None-Match: $etag_stylesheet_a" "$url_stylesheet")
API_HEADERS+=("$HEADERS_FILE")
# curl's -o only creates the output file once it writes at least one byte —
# a genuine 0-byte 304 body means $BODY_FILE never gets created at all, not
# an error. Treat "file absent" the same as "file present and empty".
if [ -f "$BODY_FILE" ]; then
  body_size_304=$(wc -c < "$BODY_FILE" 2>/dev/null | tr -d ' ')
else
  body_size_304=0
fi
r=0
[ "$HTTP_STATUS" = "304" ] || r=1
[ "${body_size_304:-1}" = "0" ] || r=1
record "13 带 If-None-Match 复发得到 304 且响应体 0 字节" "status=$HTTP_STATUS body_size=${body_size_304:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 14. 类页 HTML 含两条回程链接，且注入的 li 出现在 navbar-top-firstrow 之后
# ─────────────────────────────────────────────────────────────────────────────
fetch "$url_class"
API_HEADERS+=("$HEADERS_FILE")
r=0
grep -q "/guide/introduction" "$BODY_FILE" || r=1
grep -q "/zh/guide/introduction" "$BODY_FILE" || r=1
line_nav=$(grep -n "navbar-top-firstrow" "$BODY_FILE" | head -1 | cut -d: -f1)
line_link=$(grep -n "/zh/guide/introduction" "$BODY_FILE" | head -1 | cut -d: -f1)
if [ -z "$line_nav" ] || [ -z "$line_link" ] || [ "$line_link" -lt "$line_nav" ]; then
  r=1
fi
record "14 类页含两条回程链接且位于 navbar-top-firstrow 之后" "nav行=${line_nav:-<无>} link行=${line_link:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 15. 全部 /api/ 响应都带与期望值逐字相等的 Content-Security-Policy——这里只
#     定义 EXPECTED_CSP 并跑 15a 自检；实际消费 API_HEADERS 的校验循环在文件
#     末尾与 6 号项合并执行（见下方说明）。
# ─────────────────────────────────────────────────────────────────────────────
EXPECTED_CSP="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'"

# 15a. EXPECTED_CSP 是本脚本手抄的一份硬编码副本，item 15 的全部价值都建立在
# 这份副本与 headers.js 实际字面量一致的前提上；这条自检直接断言两者相等，把
# 「脚本期望值与 Function 实际值已漂移」和下面 15 号「部署上的 CSP 不对」区分
# 成两种处理方式完全不同的失效，不再只靠人记得两处一起改。
r=0
if grep -qF "$EXPECTED_CSP" "$ROOT/functions/api/_shared/headers.js"; then
  detail="脚本期望值与仓库里的 headers.js 逐字一致"
else
  r=1
  detail="脚本的 EXPECTED_CSP 与 headers.js 的实际字面量已漂移（不是部署上的 CSP 不对——是这两处源码本身不再一致，先去比对 $ROOT/functions/api/_shared/headers.js）"
fi
record "15a EXPECTED_CSP 与 headers.js 源码逐字相等" "$detail" "$r"

# item 15 本身的校验循环（消费完整的 API_HEADERS 数组）被合并进了文件末尾
# 与 6 号项共享的那一次遍历，而不是留在这里——此处 API_HEADERS 只装了 1-14
# 号项的 14 条响应，17-25 号项（版本根重定向、被拦下的 3xx、未索引版本、三次
# stylesheet 抓取、两次类页抓取）此时都还没发生。若循环留在这里，就会像
# 02-REVIEW.md WR-01 指出的那样，永远不会检查后十条响应的 CSP，而 21 号项的
# 注释却在声称"接受 6 号与 15 号项对全部 /api/ 响应的统一检查覆盖"——只有把
# 循环挪到全部 fetch 完成之后，这句注释才是真的。

# ─────────────────────────────────────────────────────────────────────────────
# 16. 类页响应 Cache-Control 的 max-age 是 3600
# ─────────────────────────────────────────────────────────────────────────────
cc_class=$(header_value "$HEADERS_FILE" "cache-control")
r=0
printf '%s' "$cc_class" | grep -qE 'max-age=3600(;|,|$)' || r=1
record "16 类页 Cache-Control max-age=3600" "cache-control=${cc_class:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 17. 版本根（不带尾斜杠）302 到该版本 index.html（G-02-7）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/api/$CURRENT_VERSION"
API_HEADERS+=("$HEADERS_FILE")
loc_verroot_a=$(header_value "$HEADERS_FILE" "location")
r=0
[ "$HTTP_STATUS" = "302" ] || r=1
printf '%s' "$loc_verroot_a" | grep -qE "/api/$CURRENT_VERSION/index\.html\$" || r=1
record "17 版本根（无尾斜杠）302 到该版本 index.html" "status=$HTTP_STATUS location=${loc_verroot_a:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 18. 版本根（带尾斜杠）同样 302 到同一目标——证明两种形态走同一条分支
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/api/$CURRENT_VERSION/"
API_HEADERS+=("$HEADERS_FILE")
loc_verroot_b=$(header_value "$HEADERS_FILE" "location")
r=0
[ "$HTTP_STATUS" = "302" ] || r=1
[ "$loc_verroot_b" = "$loc_verroot_a" ] || r=1
record "18 版本根（带尾斜杠）302 到同一目标" "status=$HTTP_STATUS location=${loc_verroot_b:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 19. 上游必然 3xx 的路径：被拦下而不是原样透出（G-02-7）
# ─────────────────────────────────────────────────────────────────────────────
# /api/foo 既不匹配版本正则也不是两条退役路径之一，落入代理分支；实测上游对
# 该路径返回 303 指向 /doc/...。这一条同时是「Workers 的 fetch 在 manual 模式
# 下确实拿得到真实 3xx 状态码」的实测——x-upstream-status 若不是 303，说明
# Cloudflare Workers 的 redirect:'manual' 假设不成立，必须停下重新设计。
fetch "$BASE_URL/api/foo"
API_HEADERS+=("$HEADERS_FILE")
body_foo=$(cat "$BODY_FILE" 2>/dev/null || true)
xus_foo=$(header_value "$HEADERS_FILE" "x-upstream-status")
xur_foo=$(header_value "$HEADERS_FILE" "x-upstream-redirect")
r=0
[ "$HTTP_STATUS" = "404" ] || r=1
printf '%s' "$body_foo" | grep -qi "$NOT_INDEXED_MARKER" || r=1
[ "$xus_foo" = "303" ] || r=1
[ "$xur_foo" = "blocked" ] || r=1
record "19 上游 3xx 被拦下（/api/foo）" "status=$HTTP_STATUS x-upstream-status=${xus_foo:-<无>} x-upstream-redirect=${xur_foo:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 20. 存在但未索引的版本：版本根 302 后，目标地址给出准确的「尚未索引」而不是
#     「上游挂了」
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/api/$NEVER_INDEXED_VERSION"
API_HEADERS+=("$HEADERS_FILE")
loc_unindexed_root=$(header_value "$HEADERS_FILE" "location")
r=0
[ "$HTTP_STATUS" = "302" ] || r=1
printf '%s' "$loc_unindexed_root" | grep -qE "/api/$NEVER_INDEXED_VERSION/index\.html\$" || r=1
record "20a 未索引版本根 302 到该版本 index.html" "status=$HTTP_STATUS location=${loc_unindexed_root:-<无>}" "$r"

if [ -n "$loc_unindexed_root" ]; then
  fetch "$loc_unindexed_root"
  API_HEADERS+=("$HEADERS_FILE")
  body_unindexed=$(cat "$BODY_FILE" 2>/dev/null || true)
  r=0
  [ "$HTTP_STATUS" = "404" ] || r=1
  printf '%s' "$body_unindexed" | grep -qi "$NOT_INDEXED_MARKER" || r=1
  record "20b 未索引版本根目标落到尚未索引页" "status=$HTTP_STATUS" "$r"
else
  record "20b 未索引版本根目标落到尚未索引页" "上一步未取得 Location，跳过" 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 21. stylesheet 响应体含以深色类为条件的 :root 规则（G-02-8）
# ─────────────────────────────────────────────────────────────────────────────
# 与 scripts/check-contrast.py 的自检各管一段：那边只读源码常量，这里读的是
# 真实发出的字节，接管 check-contrast.py 从「暗色媒体查询字符串」这条断言里
# 移走的部分（见 02-09 对该脚本 docstring 的改写）。独立各取一次响应（而不是
# 复用 9 号项已存的 body_stylesheet_a），让每一条都把自己的响应头登记进
# API_HEADERS，接受 6 号与 15 号项对全部 /api/ 响应的统一检查覆盖。
fetch "$url_stylesheet"
API_HEADERS+=("$HEADERS_FILE")
body_stylesheet_21=$(cat "$BODY_FILE" 2>/dev/null || true)
r=0
printf '%s' "$body_stylesheet_21" | grep -qE ':root\.dark[[:space:]]*\{' || r=1
record "21 stylesheet 含深色类选择器规则" "" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 22. stylesheet 响应体的暗色媒体查询选择器排除浅色类（G-02-8）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$url_stylesheet"
API_HEADERS+=("$HEADERS_FILE")
body_stylesheet_22=$(cat "$BODY_FILE" 2>/dev/null || true)
r=0
printf '%s' "$body_stylesheet_22" | grep -qF ':root:not(.ultitools-appearance-light)' || r=1
record "22 暗色媒体查询选择器排除浅色类" "" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 23. stylesheet 响应体中深色表的一条声明恰好出现两次（媒体查询一次、类选择器
#     一次；G-02-8：两个触发器共用同一份表这件事没有退化成只剩一个）
# ─────────────────────────────────────────────────────────────────────────────
# grep -o 逐个匹配计数，不用 grep -c——后者数的是命中行数，同一行出现两次只算 1。
fetch "$url_stylesheet"
API_HEADERS+=("$HEADERS_FILE")
body_stylesheet_23=$(cat "$BODY_FILE" 2>/dev/null || true)
n_dark_decl=$(printf '%s' "$body_stylesheet_23" | grep -o -- '--body-text-color: #dfdfd6' | wc -l | tr -d ' ')
r=0
[ "$n_dark_decl" = "2" ] || r=1
record "23 深色表声明在产物中出现两次" "count=${n_dark_decl:-0}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 24. 类页 HTML 中注入脚本标识恰好出现一次，且位于 </head> 之前（G-02-8）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$url_class"
API_HEADERS+=("$HEADERS_FILE")
n_appearance=$(grep -o "vitepress-theme-appearance" "$BODY_FILE" | wc -l | tr -d ' ')
line_appearance=$(grep -n "vitepress-theme-appearance" "$BODY_FILE" | head -1 | cut -d: -f1)
line_headend=$(grep -n "</head>" "$BODY_FILE" | head -1 | cut -d: -f1)
r=0
[ "$n_appearance" = "1" ] || r=1
if [ -z "$line_appearance" ] || [ -z "$line_headend" ] || [ "$line_appearance" -gt "$line_headend" ]; then
  r=1
fi
record "24 类页含且仅含一处注入脚本标识且位于 </head> 之前" \
  "count=${n_appearance:-0} appear行=${line_appearance:-<无>} head结束行=${line_headend:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 25. 连续两次请求同一类页，ETag 相等且正文字节数相等（G-02-8：注入脚本的字节
#     对所有访客相同，判定发生在客户端，不引入按访客分裂响应的可观测证据）
# ─────────────────────────────────────────────────────────────────────────────
etag_class_a=$(header_value "$HEADERS_FILE" "etag")
size_class_a=$(wc -c < "$BODY_FILE" 2>/dev/null | tr -d ' ')
fetch "$url_class"
API_HEADERS+=("$HEADERS_FILE")
etag_class_b=$(header_value "$HEADERS_FILE" "etag")
size_class_b=$(wc -c < "$BODY_FILE" 2>/dev/null | tr -d ' ')
r=0
[ -n "$etag_class_a" ] || r=1
[ "$etag_class_a" = "$etag_class_b" ] || r=1
[ "$size_class_a" = "$size_class_b" ] || r=1
record "25 类页连续两次请求 ETag 与字节数相等" \
  "etag=${etag_class_a:-<无>} size=${size_class_a:-<无>}/${size_class_b:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 26. 修复本身：dejavu.css 子路径返回空正文的 200，Content-Type 为 CSS，且带
#     自答标记头（G-02-10）
# ─────────────────────────────────────────────────────────────────────────────
url_dejavu="$BASE_URL/api/$CURRENT_VERSION/resources/fonts/dejavu.css"
fetch "$url_dejavu"
API_HEADERS+=("$HEADERS_FILE")
ctype_dejavu=$(header_value "$HEADERS_FILE" "content-type")
xuf_dejavu=$(header_value "$HEADERS_FILE" "x-upstream-fetch")
size_dejavu=$(wc -c < "$BODY_FILE" 2>/dev/null | tr -d ' ')
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
printf '%s' "$ctype_dejavu" | grep -qi 'css' || r=1
[ "${size_dejavu:-1}" = "0" ] || r=1
[ "$xuf_dejavu" = "skipped" ] || r=1
record "26 dejavu.css 子路径返回空 200 CSS 且带自答标记头" \
  "status=$HTTP_STATUS content-type=${ctype_dejavu:-<无>} size=${size_dejavu:-<无>} x-upstream-fetch=${xuf_dejavu:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 27. 窄范围的反向对照：同目录下真实存在的 glass.png（UAT test 4 确认渲染的
#     搜索放大镜图标）仍按代理正常返回，不带自答标记头（G-02-10）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/api/$CURRENT_VERSION/resources/glass.png"
API_HEADERS+=("$HEADERS_FILE")
ctype_glass=$(header_value "$HEADERS_FILE" "content-type")
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
printf '%s' "$ctype_glass" | grep -qi 'image' || r=1
has_header "$HEADERS_FILE" "x-upstream-fetch" && r=1
record "27 glass.png 仍代理返回且不带自答标记头（范围反向对照）" \
  "status=$HTTP_STATUS content-type=${ctype_glass:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 28. 该分支不发起任何上游请求：一个从未被索引的版本在同一子路径上同样得到
#     空 200（G-02-10）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/api/$NEVER_INDEXED_VERSION/resources/fonts/dejavu.css"
API_HEADERS+=("$HEADERS_FILE")
size_dejavu_unindexed=$(wc -c < "$BODY_FILE" 2>/dev/null | tr -d ' ')
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
[ "${size_dejavu_unindexed:-1}" = "0" ] || r=1
record "28 未索引版本同子路径同样得到空 200（分支不打上游）" \
  "status=$HTTP_STATUS size=${size_dejavu_unindexed:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 6 & 15. 每一条 /api/ 响应（含 302、301、404）都带 noindex 且不带 link 头
#        （6 号），且都带与 EXPECTED_CSP 逐字相等的 Content-Security-Policy
#        （15 号）。两项共享同一次对 API_HEADERS 的遍历——此时全部 fetch 点位
#        都已发生（1-14、17-28 各自 push 一次，18/20b 有条件跳过，共最多 27
#        条，另外 3 次抓取复用同一 fetch 但每次都重新 push，故实际条数以运行
#        时 ${#API_HEADERS[@]} 为准），修复 02-REVIEW.md WR-01：15 号项此前独
#        立成环时位于 17-25 号项之前，从未检查过后十条响应。26-28 号项（G-02-
#        10）同样必须插在这个循环之前——插在其后就重演了 WR-01 修的同一顺序问
#        题：新响应不受 6/15 号项覆盖。两个断言各自独立计数、独立 record，不
#        合并成一条结果，以保留各自的失败定位能力。
# ─────────────────────────────────────────────────────────────────────────────
r=0
detail=""
r15=0
detail15=""
for hf in "${API_HEADERS[@]}"; do
  xr=$(header_value "$hf" "x-robots-tag")
  if ! printf '%s' "$xr" | grep -qi 'noindex'; then
    r=1
    detail="$detail [$hf 无 noindex]"
  fi
  if grep -qi '^link:' "$hf" 2>/dev/null; then
    r=1
    detail="$detail [$hf 含 link 头]"
  fi
  csp=$(header_value "$hf" "content-security-policy")
  if [ "$csp" != "$EXPECTED_CSP" ]; then
    r15=1
    detail15="$detail15 [$hf csp=${csp:-<无>}]"
  fi
done
record "6 /api/ 全部响应带 noindex 且无 link 头" "检查了 ${#API_HEADERS[@]} 个响应${detail:+  异常:$detail}" "$r"
record "15 全部 /api/ 响应 CSP 逐字相等" "检查了 ${#API_HEADERS[@]} 个响应${detail15:+  异常:$detail15}" "$r15"

echo
if [ "$status" -eq 0 ]; then
  echo "全部通过"
else
  echo "存在 FAIL，见上方"
fi
exit "$status"
