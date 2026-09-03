#!/usr/bin/env bash
# Build-artifact assertion gate for the version-state notice bar and the links
# this phase emits. Runs AFTER a build, against .vitepress/dist.
#
# This script is the verification carrier this phase uses in place of a test
# runner. This repository has no test runner and no test files, and
# REQUIREMENTS.md FUT-04 defers introducing one past v1.0, so the three carriers
# available are: the existing repo gates, assertions over the build artifact
# (this script), and enumerated manual observation. Anything that would need a
# test runner is out of contract.
#
# ── The mode argument is not cosmetic ───────────────────────────────────────
# docs/archive/v6.3.0-SNAPSHOT/ is gitignored. A plain local `npm run build`
# picks it up whenever an earlier `npm run build:with-alpha` left it on disk,
# while a clean CI checkout never has it. The same assertion suite therefore has
# two different correct answers depending on which side it runs on, and getting
# that wrong reads as a defect when it is only a difference in inputs.
#
#   --clean       asserts the six committed archived versions, and additionally
#                 asserts that dist/v6.3.0-SNAPSHOT does not exist at all. This
#                 is the clean-checkout side — what CI sees. Reproduce it
#                 locally with `npm run clean:snapshot` before `npm run build`.
#   --with-alpha  asserts all seven versions plus the alpha-specific checks.
#                 This is what `npm run build:with-alpha` produces, and what a
#                 local machine that has ever run it produces thereafter.
#
# ── Why the Chinese-path assertion is scoped to this phase's own attribute ──
# Measured on the 2026-09-04 baseline, BEFORE this phase changed anything:
# `grep -rohE 'href="/zh/v[0-9][^/"]*"' .vitepress/dist --include='*.html'`
# returns roughly 6,000 hits, spread across all seven versions (v6.1.0 827,
# v6.2.0 857, v6.2.1 857, v6.2.2 863, v6.2.3 863, v6.2.4 863, SNAPSHOT 869).
# They are not produced by the version switcher. They come from VitePress's own
# language switcher (VPNavBarTranslations) and overflow menu (VPNavBarExtra),
# which enumerate site.locales, and @viteplus/versions generates locale keys
# shaped `zh/v6.2.4` with link `/zh/v6.2.4/` while the site actually serves
# `/v6.2.4/zh/`. That is a real live defect — it is why the language switcher
# 404s from an archived English page today — but it is a separate, larger
# problem with its own todo, and it is not this phase's to fix.
#
# So the assertion below counts only hrefs carried on this phase's own
# `data-ut-version-link` attribute. Do NOT "tighten" it into an unscoped search
# across all of dist: that would be red on a baseline this phase never touched,
# while saying nothing about the links this phase emits.
#
# ── Reporting shape ─────────────────────────────────────────────────────────
# Follows scripts/check-sidebar-links.sh: every count is echoed before it is
# compared, so a failing run states the observed number rather than only that
# something was wrong. Expected per-version page counts are derived by counting
# markdown files under the matching source directory, never hardcoded, so adding
# an archived version needs no edit here — but they are compared PER VERSION,
# not as a sum, because a sum cannot tell one version losing its bar apart from
# another gaining pages (04-CONTEXT.md 裁定 4).
#
# Every zero-hit assertion is paired with a positive control evaluated over the
# same file set in the same block. A search that silently reads no files also
# returns zero; the control is the only thing that distinguishes the two.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DIST=".vitepress/dist"
STATE_MARKER='data-ut-version-state'
LINK_ATTR='data-ut-version-link'
# Present in every built page, whatever this phase does — the control for the
# zero-hit assertions below.
CONTROL_MARKER='__VP_SITE_DATA__'
SNAPSHOT_DIR_NAME='v6.3.0-SNAPSHOT'

failures=0

usage() {
  cat <<'USAGE' >&2
用法: check-rendered-links.sh <--clean|--with-alpha>

  --clean       断言干净检出（CI）那一侧的产物：六个已提交的归档版本，
                且 dist/v6.3.0-SNAPSHOT 必须不存在。
                本地复现方式：npm run clean:snapshot && npm run build
  --with-alpha  断言本地 build:with-alpha 那一侧的产物：七个版本，
                外加 alpha 专有断言（commit 令牌、SNAPSHOT 覆盖数）。

模式是必填的：SNAPSHOT 目录是 gitignore 的，本地与 CI 看到的版本集不同，
同一套断言在两侧有两个不同的正确答案。
USAGE
}

pass() {
  echo "PASS  $1"
}

fail() {
  echo "FAIL  $1"
  failures=$((failures + 1))
}

skip() {
  echo "SKIP  $1"
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

MODE="$1"
case "$MODE" in
  --clean|--with-alpha) ;;
  *)
    echo "check-rendered-links: 未知模式 '$MODE'" >&2
    usage
    exit 2
    ;;
esac

if [ ! -d "$DIST" ]; then
  echo "check-rendered-links: 找不到 $DIST —— 本脚本断言的是构建产物，请先跑一次 npm run build" >&2
  exit 2
fi

echo "check-rendered-links: mode=$MODE dist=$DIST"
echo "----------------------------------------"

# ── 1. Per-version notice-bar coverage ──────────────────────────────────────
# Expected counts derived from the source tree, compared one version at a time.

echo "1. 逐版本提示条覆盖（期望值由源码 markdown 数推出，不写死）"

for src_dir in docs/archive/*/; do
  [ -d "$src_dir" ] || continue
  version="$(basename "$src_dir")"

  if [ "$MODE" = "--clean" ] && [ "$version" = "$SNAPSHOT_DIR_NAME" ]; then
    skip "  $version 源码目录仍在磁盘上，但 --clean 断言的是不含它的那一侧；下面第 4 条断言它不在产物里"
    continue
  fi

  expected="$(find "$src_dir" -type f -name '*.md' | wc -l)"

  if [ ! -d "$DIST/$version" ]; then
    fail "  $version observed=(产物目录不存在) expected=$expected"
    continue
  fi

  observed="$({ grep -rl "$STATE_MARKER" "$DIST/$version" --include='*.html' || true; } | wc -l)"

  if [ "$observed" -eq "$expected" ]; then
    pass "  $version observed=$observed expected=$expected"
  else
    fail "  $version observed=$observed expected=$expected"
  fi
done

# ── 2. Current-release exclusion, with its control in the same block ────────
# VER-07 is satisfied by rendering no node at all. The latest page set is every
# built HTML file that does not sit under a version directory — that also covers
# index.html and 404.html, not just dist/guide and dist/zh.

echo "2. 当前发布版不含提示条（同一文件集内配对照组）"

latest_files="$(find "$DIST" -type f -name '*.html' | grep -vE "^$DIST/v[0-9]" || true)"
latest_total="$(printf '%s\n' "$latest_files" | grep -c . || true)"

if [ "$latest_total" -eq 0 ]; then
  fail "  latest 文件集为空，断言无意义（产物结构变了？）"
else
  # xargs exits 123 when any grep batch finds nothing, which under set -e would
  # abort the whole run on the very outcome this assertion expects. The `|| true`
  # neutralises that; the file list is still fully scanned, and the paired
  # control below is what proves the scan actually read files.
  observed="$({ printf '%s\n' "$latest_files" | xargs -r grep -l "$STATE_MARKER" 2>/dev/null || true; } | wc -l)"
  control="$({ printf '%s\n' "$latest_files" | xargs -r grep -l "$CONTROL_MARKER" 2>/dev/null || true; } | wc -l)"

  echo "      latest_files=$latest_total notice_bars=$observed positive_control=$control"

  if [ "$observed" -eq 0 ]; then
    pass "  latest 页面上的提示条数 observed=$observed expected=0"
  else
    fail "  latest 页面上的提示条数 observed=$observed expected=0"
  fi

  if [ "$control" -gt 0 ]; then
    pass "  对照组：同一文件集里 $CONTROL_MARKER observed=$control expected>0"
  else
    fail "  对照组：同一文件集里 $CONTROL_MARKER observed=$control expected>0 —— 上面那个零是假的，搜索根本没读到文件"
  fi
fi

# ── 3. Scoped Chinese-path regression assertion ─────────────────────────────
# Counts only hrefs carried on this phase's own attribute. See the header for
# the ~6,000-hit baseline that makes an unscoped version of this assertion red
# before this phase changes anything.

echo "3. 本 Phase 自己发出的版本链接里没有 /zh/<版本>/ 形状"

link_total="$({ grep -rhoE "$LINK_ATTR=\"[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"
link_zh_first="$({ grep -rhoE "$LINK_ATTR=\"/zh/v[0-9][^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      ${LINK_ATTR}_total=$link_total zh_version_first=$link_zh_first"

if [ "$link_total" -eq 0 ]; then
  skip "  $LINK_ATTR 尚未出现在任何产物里（版本切换器由 04-03 交付）——本条断言暂不适用，不是通过"
elif [ "$link_zh_first" -eq 0 ]; then
  pass "  zh_version_first observed=$link_zh_first expected=0（总数 $link_total 为对照组，证明搜索确实读到了属性）"
else
  fail "  zh_version_first observed=$link_zh_first expected=0 —— 中文页版本切换会 404（实测 /zh/v6.2.4/... 返回 404）"
fi

# ── 4. Mode-specific alpha assertions ───────────────────────────────────────

if [ "$MODE" = "--clean" ]; then
  echo "4. --clean：产物里不含 SNAPSHOT"
  if [ -d "$DIST/$SNAPSHOT_DIR_NAME" ]; then
    n="$(find "$DIST/$SNAPSHOT_DIR_NAME" -type f -name '*.html' | wc -l)"
    fail "  dist/$SNAPSHOT_DIR_NAME observed=存在（$n 个页面） expected=不存在 —— 这次断言跑在本地那一侧，不是 CI 那一侧；先跑 npm run clean:snapshot"
  else
    pass "  dist/$SNAPSHOT_DIR_NAME observed=不存在 expected=不存在"
  fi
else
  echo "4. --with-alpha：SNAPSHOT 覆盖与 commit 元数据"

  if [ ! -d "$DIST/$SNAPSHOT_DIR_NAME" ]; then
    fail "  dist/$SNAPSHOT_DIR_NAME observed=不存在 expected=存在 —— --with-alpha 断言的是 npm run build:with-alpha 的产物"
  else
    expected="$(find "docs/archive/$SNAPSHOT_DIR_NAME" -type f -name '*.md' | wc -l)"
    observed="$({ grep -rl "$STATE_MARKER" "$DIST/$SNAPSHOT_DIR_NAME" --include='*.html' || true; } | wc -l)"
    if [ "$observed" -eq "$expected" ]; then
      pass "  $SNAPSHOT_DIR_NAME observed=$observed expected=$expected"
    else
      fail "  $SNAPSHOT_DIR_NAME observed=$observed expected=$expected"
    fi

    # 03-CONTEXT.md D-43: the visible injection metadata is the only channel by
    # which a silently auto-disabled nightly sync is detectable. Exactly one
    # token per page, both locales — zero means the detector is gone, more than
    # one means it is being rendered somewhere it should not be.
    for rel in "guide/introduction.html" "zh/guide/introduction.html"; do
      page="$DIST/$SNAPSHOT_DIR_NAME/$rel"
      if [ ! -f "$page" ]; then
        fail "  commit 令牌 $rel observed=(页面不存在) expected=1"
        continue
      fi
      n="$({ grep -o 'commit [0-9a-f]\{7\}' "$page" || true; } | wc -l)"
      if [ "$n" -eq 1 ]; then
        pass "  commit 令牌 $rel observed=$n expected=1"
      else
        fail "  commit 令牌 $rel observed=$n expected=1"
      fi
    done
  fi
fi

echo "----------------------------------------"
echo "不成立条数: $failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
