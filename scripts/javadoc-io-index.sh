#!/usr/bin/env bash
# Triggers javadoc.io indexing for UltiTools-API releases, replacing the
# manual "someone opens the versions page and clicks a button" step (D-31).
#
# Single-invariant posture (set -euo pipefail), same stance as
# check-version-consistency.sh, not check-container-length.sh's multi-unit
# scan: a single index operation (one version) is one linear pipeline —
# fetch, validate, POST, poll — and any step failing means the whole
# operation failed. --backfill loops this pipeline over a fixed set of
# versions, but each iteration is still evaluated as its own pass/fail.
set -euo pipefail

UPSTREAM_GROUP="com.ultikits"
UPSTREAM_ARTIFACT="UltiTools-API"
VERSIONS_PAGE_URL="https://javadoc.io/versions/${UPSTREAM_GROUP}/${UPSTREAM_ARTIFACT}"
UPSTREAM_ORIGIN="https://javadoc.io"
SYNC_PATH="/versions/${UPSTREAM_GROUP}/${UPSTREAM_ARTIFACT}/sync"
UPLOAD_PATH="/versions/${UPSTREAM_GROUP}/${UPSTREAM_ARTIFACT}/upload"
STATIC_BASE="${UPSTREAM_ORIGIN}/static/${UPSTREAM_GROUP}/${UPSTREAM_ARTIFACT}"

# Self-describing, not disguised as a browser — javadoc.io has no published
# API, this is the only way it can identify and, if needed, contact us.
USER_AGENT="UltiTools-Dev-Doc-indexer/1 (+https://github.com/UltiKits/UltiTools-Dev-Doc)"

# Written to match docs/archive/'s directory names on `master` (v-prefix
# stripped), NOT scraped from upstream's "all undiscovered versions" list.
# Upstream has 28 versions, 27 undiscovered; iterating "everything upstream
# doesn't have yet" would turn this into a bulk trigger against a free
# third-party service for versions this site has no archive for and no
# reader will ever reach (D-33, D-12). When a new archived version is added
# to docs/archive/, this list must be updated by hand at the same time.
BACKFILL_VERSIONS=(6.1.0 6.2.0 6.2.1 6.2.2 6.2.3 6.2.4)

# Overridable only so D-32's timeout path can be exercised in seconds
# instead of the real 5-minute wait — that is the only reason these two
# knobs exist. Combined with --poll-only and a version guaranteed to be
# unindexed (9.9.9, same fixed value verify-api-proxy.sh already uses as
# NEVER_INDEXED_VERSION), the timeout path completes within a single GET
# and touches no upstream state at all.
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-15}"
POLL_MAX_ATTEMPTS="${POLL_MAX_ATTEMPTS:-20}"

VERSION=""
BACKFILL=false
DRY_RUN=false
CHECK_FORMS_ONLY=false
PAGE_FILE=""
PAGE_FILE_AFTER_SYNC=""
POLL_ONLY=false

usage() {
  cat <<'USAGE' >&2
用法: javadoc-io-index.sh (--version <v> | --backfill) [--dry-run] [--check-forms-only] [--page-file <path>] [--page-file-after-sync <path>] [--poll-only]

  --version <v>              对单个版本触发 sync + 有条件的 upload + 轮询
  --backfill                 对站点归档集合内的固定版本清单串行执行（含 30 秒间隔）
  --dry-run                  跑完全部解析与判定，但不发起任何 POST，也不轮询
  --check-forms-only         只做结构断言后退出，不触碰上游状态（配合 --page-file 可离线自检）
  --page-file <path>         用本地文件代替 GET 版本页
  --page-file-after-sync <path>
                             只影响引导重试（G-02-11）的第二次取页：设了就读它，没设就
                             退回读 --page-file。唯一存在的理由是让引导路径可以离线自检
                             ——真实运行永远走 fetch_page() 的网络分支重取
  --poll-only                跳过页面解析与两个 POST，只对 --version 指定的版本执行有界轮询

环境变量：
  POLL_INTERVAL_SECONDS  轮询间隔秒数，默认 15
  POLL_MAX_ATTEMPTS      轮询次数上限，默认 20

退出码：
  0  就绪或无事可做
  1  上游表单结构不符合预期，脚本需要重写
  2  轮询超时或取版本列表页失败，暂态，不代表脚本坏了
USAGE
}

if [ "$#" -eq 0 ]; then
  usage
  exit 2
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      VERSION="${2:?--version 需要一个值}"
      shift 2
      ;;
    --backfill)
      BACKFILL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --check-forms-only)
      CHECK_FORMS_ONLY=true
      shift
      ;;
    --page-file)
      PAGE_FILE="${2:?--page-file 需要一个路径}"
      shift 2
      ;;
    --page-file-after-sync)
      PAGE_FILE_AFTER_SYNC="${2:?--page-file-after-sync 需要一个路径}"
      shift 2
      ;;
    --poll-only)
      POLL_ONLY=true
      shift
      ;;
    *)
      echo "javadoc-io-index: 未知参数：$1" >&2
      usage
      exit 2
      ;;
  esac
done

# Session cookie material lives only for the duration of this run, in a
# directory nothing else on the runner can predict the name of, and is
# deleted on every exit path (including the exit-1/exit-2 paths below).
# Never written into the working tree or $GITHUB_WORKSPACE.
COOKIE_DIR="$(mktemp -d)"
trap 'rm -rf "$COOKIE_DIR"' EXIT
COOKIE_JAR="${COOKIE_DIR}/cookies.txt"

# Writes both output keys together so a downstream workflow step never reads
# index_result without a matching index_version. Called on every exit path
# that has a verdict — check-version-consistency.sh's header comment records
# why this placement discipline matters: a script with more than one exit
# path silently hands the next step empty values if the write is missed on
# any of them.
emit_result() {
  local result="$1" version="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      echo "index_result=${result}"
      echo "index_version=${version}"
    } >> "$GITHUB_OUTPUT"
  fi
}

# Set by validate_and_extract(): "ok" (structurally fine, checkbox found),
# "skipped" (target version already UPLOADED — legitimate no-op, not the
# same condition as "broken"), or "bootstrap-needed" (G-02-11: structure is
# fine, but the listing doesn't have this version yet). "bootstrap-needed"
# is only ever produced by a "tolerant"-mode call to validate_and_extract,
# and only the bootstrap retry (ensure_form_ready, below) ever passes
# "tolerant" — a "strict"-mode call never sets it, it fails closed instead,
# see validate_and_extract's own comment. A "broken" verdict never returns
# through this variable — it exits the whole script immediately, see below.
FORM_STATUS=""
CSRF_TOKEN=""

# GET the versions page (or read a local file in its place). Optional first
# argument is the path to read instead of GETting; defaults to $PAGE_FILE so
# every existing call site (no argument) is unchanged. The bootstrap retry's
# second pass (G-02-11) is the only caller that ever passes an explicit
# argument, so it can read --page-file-after-sync instead of --page-file
# without this function needing to know why. This hop is allowed to fail
# legitimately — network down, upstream unreachable — and is guarded with
# `|| true` followed immediately by the emptiness check below, the same
# convention check-version-consistency.sh uses: a failure here is "couldn't
# reach a conclusion", not "the script is broken".
fetch_page() {
  local path_override="${1:-$PAGE_FILE}"
  if [ -n "$path_override" ]; then
    cat "$path_override"
    return 0
  fi
  local page
  page=$(curl -sS --fail --connect-timeout 10 --max-time 30 \
         --cookie-jar "$COOKIE_JAR" \
         --user-agent "$USER_AGENT" \
         "$VERSIONS_PAGE_URL") || true
  if [ -z "$page" ]; then
    echo "javadoc-io-index: 取不到 javadoc.io 版本列表页（网络问题），不是脚本本身判定错误。" >&2
    exit 2
  fi
  printf '%s' "$page"
}

# Fail-closed structural assertions (D-34) plus the "already UPLOADED"
# exception. No `|| true` anywhere in this function — every failure here
# means our script and the upstream page have diverged, which is a
# permanent condition, not a transient one, and must not be silently
# swallowed the way a network hiccup is upstream in fetch_page().
#
# Second argument `mode` is "tolerant" or "strict" (G-02-11). Every
# assertion here except three-point-two behaves identically in both modes —
# broken and `exit 1` the moment it fails, no exceptions, no sync ever
# triggered. Only assertion three-point-two (this specific version isn't in
# the listing yet, even though the versionId CONTROL itself is present) is
# soft under "tolerant": it records FORM_STATUS="bootstrap-needed" instead
# of failing, giving the bootstrap retry (ensure_form_ready, below) exactly
# one chance to refresh upstream and check again. "strict" mode runs this
# same assertion with no soft branch at all — it is what that retry's
# SECOND call uses, after a refresh has already happened, and a version
# still missing at that point is treated exactly like every other
# structural break.
#
# Between each GET and the POST that uses the token it extracted, this
# function's own parsing is the only thing that happens — nothing else in
# this script issues a request in between — because csrfToken's first two
# segments regenerate on every GET even against the same session cookie
# (02-RESEARCH.md §2.3); caching a token across invocations or interleaving
# another request would hand the POST a token the session no longer
# recognizes. The bootstrap retry (G-02-11) introduces a SECOND GET; the
# token it extracts overwrites CSRF_TOKEN from the first call, and each
# GET/POST pairing is independently self-consistent — the second pass never
# uses a token the first pass extracted, and vice versa.
validate_and_extract() {
  local page="$1" mode="$2"

  if ! printf '%s' "$page" | grep -qE '<form[^>]*action="[^"]*/sync"[^>]*method="post"' \
     && ! printf '%s' "$page" | grep -qE '<form[^>]*method="post"[^>]*action="[^"]*/sync"'; then
    echo "javadoc-io-index: 断言一失败——找不到 action 指向 /sync 的 post 表单。上游页面结构变了，脚本需要重写。" >&2
    emit_result "broken" "$VERSION"
    exit 1
  fi

  local upload_block
  upload_block=$(awk '/<form[^>]*action="[^"]*\/upload"/{flag=1} flag{print} flag && /<\/form>/{exit}' <<< "$page")
  if [ -z "$upload_block" ]; then
    echo "javadoc-io-index: 断言二失败——找不到 action 指向 /upload 的 post 表单。上游页面结构变了，脚本需要重写。" >&2
    emit_result "broken" "$VERSION"
    exit 1
  fi

  # Bash regex match inside an `if` condition, not a grep|sed pipe assigned
  # straight to a variable — under `set -euo pipefail`, a multi-stage pipe
  # whose only match-bearing command legitimately finds nothing (grep -oE
  # exits 1 on no match) aborts the whole script the instant it's used as a
  # plain assignment's right-hand side, even though "not found" is exactly
  # the case this function needs to handle itself, not fail on. A command
  # tested by `if` is exempt from that abort regardless of pipefail, so the
  # extraction is done as a regex match rather than a pipe.
  if [[ "$upload_block" =~ name=\"csrfToken\"[^\>]*value=\"([^\"]*)\" ]]; then
    CSRF_TOKEN="${BASH_REMATCH[1]}"
  else
    CSRF_TOKEN=""
  fi
  if [ -z "$CSRF_TOKEN" ]; then
    echo "javadoc-io-index: 断言二失败——upload 表单里抽不到 csrfToken 隐藏域的值。上游页面结构变了，脚本需要重写。" >&2
    emit_result "broken" "$VERSION"
    exit 1
  fi

  # Exception to assertion three: a version already UPLOADED legitimately
  # has no checkbox. This must be distinguished from "structure changed"
  # before assertion three runs, not folded into it — both conditions look
  # identical (no checkbox found) if checked in the wrong order.
  if printf '%s' "$page" | grep -A2 -F "<td>${VERSION}</td>" | grep -q 'title="UPLOADED"'; then
    echo "javadoc-io-index: 版本 ${VERSION} 已经是 UPLOADED 状态，无事可做。"
    FORM_STATUS="skipped"
    return 0
  fi

  # Assertion three-point-one (G-02-11): the versionId CONTROL itself — not
  # this particular version's checkbox, but the presence of ANY versionId
  # checkbox anywhere in the upload form — must still be there. Reads the
  # upload form BLOCK (not the whole page), because this is a question
  # about that form's own structure, the same scope assertion two already
  # uses. Strict in both modes, no exception: a page where the control has
  # vanished entirely is the same "upstream structure changed" condition
  # assertions one and two exist to catch, not "the listing hasn't caught
  # up with this version yet" that tolerant mode exists to give one retry
  # for.
  if ! printf '%s' "$upload_block" | grep -q 'name="versionId"'; then
    echo "javadoc-io-index: 断言三之一失败——upload 表单里一个 versionId 复选框控件都不剩，控件本身已从页面上消失。上游页面结构变了，脚本需要重写。" >&2
    emit_result "broken" "$VERSION"
    exit 1
  fi

  # Assertion three-point-two: the control exists, but this specific
  # version isn't in the listing yet. Reads the whole page (unchanged scope
  # from before this Task — narrowing it would be a behavior change with no
  # relation to this gap). "tolerant" mode records this instead of failing;
  # "strict" mode (the bootstrap retry's second call, after a refresh has
  # already happened) has no more retries left and fails closed exactly
  # like every other assertion here.
  if ! printf '%s' "$page" | grep -qE "name=\"versionId\"[^>]*value=\"${VERSION}\""; then
    if [ "$mode" = "tolerant" ]; then
      FORM_STATUS="bootstrap-needed"
      return 0
    fi
    echo "javadoc-io-index: 断言三之二失败——即便已经刷新过一次，清单里仍然找不到版本 ${VERSION} 对应的 versionId 复选框。上游页面结构变了，脚本需要重写。" >&2
    emit_result "broken" "$VERSION"
    exit 1
  fi

  FORM_STATUS="ok"
  return 0
}

# One-shot bootstrap retry for a version javadoc.io has never listed
# (G-02-11, APIREF-05's "brand new release" path, never exercised before
# this Task). Runs validate_and_extract in "tolerant" mode on the page the
# caller already fetched; assertions one, two, two-point-two, and
# three-point-one are strict regardless and exit the whole script the
# moment any of them fails — only assertion three-point-two (this version
# not yet in the listing) can come back soft here.
#
# If it does come back soft: --check-forms-only reports it and returns
# without touching upstream state at all, matching that flag's whole
# contract; otherwise (a real run, or --dry-run) this re-fetches the page
# (honoring --page-file-after-sync if the caller set one) and calls
# validate_and_extract again in "strict" mode. That second pass has no soft
# branch of its own — "try again, but only once" is expressed by the
# function's own shape, not by a counter that could be set to the wrong
# number.
#
# Returns 0 whenever the second pass ran, or wasn't needed at all — a hard
# structural break at any point calls `exit 1` directly from inside
# validate_and_extract and never returns here. Returns 1 only when the
# bootstrap sync POST itself failed upstream; callers fold that into the
# same "post-failed" handling do_post's own failure already produces (see
# run_single/run_backfill below) — both are "an upstream POST returned an
# HTTP error before this version's readiness was ever polled", and a
# separate result value would say nothing that one doesn't already say.
ensure_form_ready() {
  local version="$1" first_page="$2"

  validate_and_extract "$first_page" tolerant

  if [ "$FORM_STATUS" != "bootstrap-needed" ]; then
    return 0
  fi

  if [ "$CHECK_FORMS_ONLY" = true ]; then
    echo "javadoc-io-index: [check-forms-only][bootstrap-needed] 表单结构完好，清单里还没有版本 ${version}；真实运行会在这里先向上游发一次 sync 刷新，此处不触碰上游状态。"
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "javadoc-io-index: [dry-run][bootstrap-needed] 本该在这里向上游 POST 一次 sync 刷新清单，实际不发送，但仍继续重取页面并以 strict 模式判定第二遍。"
  else
    if ! request_sync "$CSRF_TOKEN"; then
      return 1
    fi
  fi

  local second_page
  second_page="$(fetch_page "$PAGE_FILE_AFTER_SYNC")"
  validate_and_extract "$second_page" strict
  return 0
}

# Bootstrap retry's own sync-only POST (G-02-11) — not a branch added
# inside do_post. Threading a conditional through do_post's body risks
# reopening the exit-status interaction WR-02 (02-REVIEW.md) already had to
# reason through; run_single/run_backfill still call do_post unconditionally
# afterward regardless of whether a bootstrap happened, so a bootstrap run
# POSTs sync twice. The second sync is idempotent, and only happens once,
# for one version upstream had never listed before — not the repeated-burst
# traffic D-33 excludes.
#
# Same request do_post's own sync half issues — same parameters, timeout,
# cookie jar, User-Agent. Exit status is checked explicitly with its own
# `if`, for the identical reason WR-02 (02-REVIEW.md, see do_post's header
# comment) gives for do_post's own two curl calls: this is called from
# inside `if ! request_sync ...`, and bash suppresses `set -e` for a called
# function's entire body while it is being evaluated as an `if`/`while`
# test, not just for the function's own top-level exit status.
request_sync() {
  local token="$1"
  if ! curl -sS --fail --connect-timeout 10 --max-time 60 \
    --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    --user-agent "$USER_AGENT" \
    --data-urlencode "csrfToken=${token}" \
    "${UPSTREAM_ORIGIN}${SYNC_PATH}" >/dev/null; then
    return 1
  fi
}

# POST sync (token only) then POST upload (token + target versionId), using
# the same cookie jar populated by the GET in fetch_page(). Never printed:
# the token, the cookie, or the request body — Actions logs are public, and
# these are session material still inside its validity window even though
# they are not long-lived credentials.
#
# Each curl's exit status is checked explicitly with its own `if`, rather
# than being left to `set -e` to abort the script directly (WR-02,
# 02-REVIEW.md). This function is called from inside an `if ! do_post ...`
# at both call sites specifically so a POST failure can still reach
# emit_result before the caller returns — but bash disables `set -e` for
# the ENTIRE body of a command (including every command a called function
# runs) while that command is being evaluated as an `if`/`while` test, not
# just for do_post's own top-level exit status. Left as two bare
# `curl --fail` statements, a failing sync call would silently NOT abort
# this function when called this way, and the upload call would still run
# and could return 0 on its own, making the function's overall exit status
# falsely report success even though sync never completed. Explicit `if`
# checks make do_post's own return code correct regardless of how — or
# whether — its caller wraps the call.
do_post() {
  local version="$1" token="$2"
  if ! curl -sS --fail --connect-timeout 10 --max-time 60 \
    --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    --user-agent "$USER_AGENT" \
    --data-urlencode "csrfToken=${token}" \
    "${UPSTREAM_ORIGIN}${SYNC_PATH}" >/dev/null; then
    return 1
  fi

  if ! curl -sS --fail --connect-timeout 10 --max-time 60 \
    --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    --user-agent "$USER_AGENT" \
    --data-urlencode "csrfToken=${token}" \
    --data-urlencode "versionId=${version}" \
    "${UPSTREAM_ORIGIN}${UPLOAD_PATH}" >/dev/null; then
    return 1
  fi
}

# Bounded polling of the readiness target. Returns 0 (ready) or 1 (timeout)
# — never calls exit itself, so callers (single-version vs. backfill) can
# decide what a timeout means for the rest of their own run.
poll_ready() {
  local version="$1" attempt=0 code url
  url="${STATIC_BASE}/${version}/index.html"
  while [ "$attempt" -lt "$POLL_MAX_ATTEMPTS" ]; do
    attempt=$((attempt + 1))
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
           --connect-timeout 10 --max-time 30 \
           --user-agent "$USER_AGENT" "$url" || echo "000")
    if [ "$code" = "200" ]; then
      echo "javadoc-io-index: 轮询第 ${attempt} 次命中 200，版本 ${version} 就绪。"
      return 0
    fi
    if [ "$attempt" -lt "$POLL_MAX_ATTEMPTS" ]; then
      sleep "$POLL_INTERVAL_SECONDS"
    fi
  done
  echo "javadoc-io-index: 轮询 ${POLL_MAX_ATTEMPTS} 次仍未就绪（版本 ${version}），判定为上游队列慢，不是脚本或索引失败。"
  return 1
}

# Single-version pipeline: fetch -> validate -> (check-forms-only: stop here)
# -> (dry-run: stop here) -> POST -> poll. Returns the exit code the caller
# (single-version mode or one --backfill iteration) should use.
run_single() {
  VERSION="$1"
  local page
  page="$(fetch_page)"

  # G-02-11: ensure_form_ready runs the tolerant-then-maybe-sync-then-strict
  # bootstrap retry; a hard structural break still exits the whole script
  # directly from inside validate_and_extract, same as before this Task.
  # Only the bootstrap sync POST failing reaches here as a non-zero return
  # — folded into the same "post-failed" result do_post's own failure
  # produces a few lines below, not a new result value (see
  # ensure_form_ready's own comment for why).
  if ! ensure_form_ready "$VERSION" "$page"; then
    echo "javadoc-io-index: POST 请求（sync 或 upload）失败——上游 HTTP 错误，判定为第三方服务暂态问题，不代表脚本坏了。" >&2
    emit_result "post-failed" "$VERSION"
    return 2
  fi

  if [ "$FORM_STATUS" = "skipped" ]; then
    emit_result "skipped" "$VERSION"
    return 0
  fi

  if [ "$CHECK_FORMS_ONLY" = true ]; then
    echo "javadoc-io-index: 结构断言全部通过（版本 ${VERSION}）。"
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "javadoc-io-index: [dry-run] 将 POST sync 与 upload（csrfToken + versionId=${VERSION}），实际不发送，不轮询。"
    return 0
  fi

  # WR-02 (02-REVIEW.md): a POST failure (upstream 4xx/5xx on either sync
  # or upload — plausible for a third-party service under load) must still
  # reach emit_result before this function returns, the same invariant
  # emit_result's own comment states for every other exit path. Distinct
  # result value from "timeout": no polling ever ran here, so reusing
  # "timeout" would tell the diagnostic issue's reader "轮询超时" about a
  # round that never started polling — an assertion the failure never
  # made true (same "worded differently so neither ever asserts something
  # false" posture .github/workflows/examples-ci.yml's own D-32/D-34
  # comment describes for timeout vs. broken).
  if ! do_post "$VERSION" "$CSRF_TOKEN"; then
    echo "javadoc-io-index: POST 请求（sync 或 upload）失败——上游 HTTP 错误，判定为第三方服务暂态问题，不代表脚本坏了。" >&2
    emit_result "post-failed" "$VERSION"
    return 2
  fi

  if poll_ready "$VERSION"; then
    emit_result "ready" "$VERSION"
    return 0
  fi
  emit_result "timeout" "$VERSION"
  return 2
}

run_backfill() {
  local any_timeout=0 first=true v
  # Neither --dry-run nor --check-forms-only ever reaches upstream for a
  # POST, so the 30-second inter-version spacing (D-33's "no burst against
  # a third party we don't control") has nothing to protect against in
  # those two modes — skipping it there keeps a dry-run/self-check pass
  # fast without weakening the real backfill's pacing.
  local skip_sleep=false
  if [ "$DRY_RUN" = true ] || [ "$CHECK_FORMS_ONLY" = true ]; then
    skip_sleep=true
  fi

  for v in "${BACKFILL_VERSIONS[@]}"; do
    if [ "$first" = true ]; then
      first=false
    elif [ "$skip_sleep" = false ]; then
      sleep 30
    fi

    echo "javadoc-io-index: [backfill] 处理版本 ${v}"
    VERSION="$v"
    local page
    page="$(fetch_page)"
    # A structural break halts the entire backfill immediately, not just
    # this iteration — validate_and_extract() (reached via ensure_form_ready,
    # G-02-11) already exits 1 internally for that case, which is the
    # correct behavior here too.
    if ! ensure_form_ready "$v" "$page"; then
      echo "javadoc-io-index: [backfill] 版本 ${v} 的引导刷新（sync）请求失败，视为第三方服务暂态问题；不中断其余版本，下一个周期会自动重试。"
      any_timeout=1
      continue
    fi

    if [ "$FORM_STATUS" = "skipped" ]; then
      echo "javadoc-io-index: [backfill] 版本 ${v} 已是 UPLOADED，跳过。"
      continue
    fi

    if [ "$CHECK_FORMS_ONLY" = true ]; then
      echo "javadoc-io-index: [backfill] 结构断言通过（版本 ${v}）。"
      continue
    fi

    if [ "$DRY_RUN" = true ]; then
      echo "javadoc-io-index: [backfill][dry-run] 将 POST sync 与 upload（csrfToken + versionId=${v}），实际不发送，不轮询。"
      continue
    fi

    # WR-02 (02-REVIEW.md): a POST failure here is folded into the same
    # any_timeout aggregate a poll timeout uses below, rather than given
    # its own emit_result value the way run_single's does — --backfill is
    # never invoked from CI (grep .github/workflows confirms this), so its
    # only reader is whoever ran the script by hand and is reading this
    # loop's own echoed lines, not INDEX_RESULT. The per-line message below
    # still names the real cause (POST failure, not a poll timeout) so that
    # reader isn't told something false; only the final aggregate label is
    # shared.
    if ! do_post "$v" "$CSRF_TOKEN"; then
      echo "javadoc-io-index: [backfill] 版本 ${v} 的 POST 请求（sync 或 upload）失败，视为第三方服务暂态问题；不中断其余版本，下一个周期会自动重试。"
      any_timeout=1
      continue
    fi
    if poll_ready "$v"; then
      echo "javadoc-io-index: [backfill] 版本 ${v} 就绪。"
    else
      echo "javadoc-io-index: [backfill] 版本 ${v} 轮询超时，视为第三方队列慢；不中断其余版本，下一个周期会自动重试。"
      any_timeout=1
    fi
  done

  if [ "$any_timeout" -eq 1 ]; then
    emit_result "timeout" "backfill"
    return 2
  fi
  return 0
}

if [ "$POLL_ONLY" = true ]; then
  if [ -z "$VERSION" ]; then
    echo "javadoc-io-index: --poll-only 需要同时指定 --version" >&2
    usage
    exit 2
  fi
  if poll_ready "$VERSION"; then
    emit_result "ready" "$VERSION"
    exit 0
  fi
  emit_result "timeout" "$VERSION"
  exit 2
fi

if [ "$BACKFILL" = true ]; then
  run_backfill
  exit $?
fi

if [ -z "$VERSION" ]; then
  echo "javadoc-io-index: 必须指定 --version 或 --backfill 之一" >&2
  usage
  exit 2
fi

run_single "$VERSION"
exit $?
