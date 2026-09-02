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
# 8. 路径穿越：含双点路径段的请求被拒绝
# ─────────────────────────────────────────────────────────────────────────────
fetch --path-as-is "$BASE_URL/api/$CURRENT_VERSION/com/../../etc/passwd"
API_HEADERS+=("$HEADERS_FILE")
r=0
[ "$HTTP_STATUS" = "400" ] || r=1
record "8 含双点路径段被拒绝" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 6. 每一条 /api/ 响应（含 302、301、404）都带 noindex，且都不带 link 头
# ─────────────────────────────────────────────────────────────────────────────
r=0
detail=""
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
done
record "6 /api/ 全部响应带 noindex 且无 link 头" "检查了 ${#API_HEADERS[@]} 个响应${detail:+  异常:$detail}" "$r"

echo
if [ "$status" -eq 0 ]; then
  echo "全部通过"
else
  echo "存在 FAIL，见上方"
fi
exit "$status"
