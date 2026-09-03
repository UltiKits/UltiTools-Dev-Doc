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
ACTIVE_MARKER='data-ut-active-version'
BADGE_MARKER='data-ut-unreleased-badge'
# The label @viteplus/versions' auto-injected dropdown used to render before
# 04-03 turned it off (versionsConfig.versionSwitcher: false) and wired in
# UtVersionSwitcher.vue. Measured absent (0 hits) on the 04-03 artifact.
OLD_LABEL='API Version'
# Present in every built page, whatever this phase does — the control for the
# zero-hit assertions below.
CONTROL_MARKER='__VP_SITE_DATA__'
SNAPSHOT_DIR_NAME='v6.3.0-SNAPSHOT'

# Derived, not hardcoded, matching this file's own convention of deriving
# expected values from source rather than writing them twice.
CURRENT_VERSION="$(grep -oE "current: *'[^']*'" .vitepress/config.mts | sed -E "s/.*'(.*)'.*/\1/")"
if [ -z "$CURRENT_VERSION" ]; then
  echo "check-rendered-links: 无法从 .vitepress/config.mts 解析 versionsConfig.current" >&2
  exit 2
fi

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
#
# 04-01 left this assertion able to SKIP (data-ut-version-link did not exist
# yet). 04-03 delivered the switcher that emits it, so this is now a hard
# requirement, not a conditional one — a SKIP here would silently stop
# proving anything the moment the attribute regressed to absent.

echo "3. 版本切换器发出的链接形状（04-03 已交付，不再允许跳过）"

link_total="$({ grep -rhoE "$LINK_ATTR=\"[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"
link_zh_first="$({ grep -rhoE "$LINK_ATTR=\"/zh/v[0-9][^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      ${LINK_ATTR}_total=$link_total zh_version_first=$link_zh_first"

if [ "$link_total" -gt 0 ]; then
  pass "  $LINK_ATTR observed=$link_total expected>0"
else
  fail "  $LINK_ATTR observed=$link_total expected>0 —— 每个产物页都应带有该属性（04-03 已交付），零命中说明这条断言已经失去了检查对象"
fi

if [ "$link_zh_first" -eq 0 ]; then
  pass "  zh_version_first observed=$link_zh_first expected=0（总数 $link_total 为对照组，证明搜索确实读到了属性）"
else
  fail "  zh_version_first observed=$link_zh_first expected=0 —— 中文页版本切换会 404（实测 /zh/v6.2.4/... 返回 404）"
fi

# ── 4. Active-version marker (VER-04) + old fixed label must be gone ───────
# Three named files, three expected values, each echoed before comparison
# (04-CONTEXT.md 裁定 4: exact values, not a lower bound — a page silently
# reverting to the old fixed label would not move any total).

echo "4. 切换器的当前版本标记（VER-04）"

assert_active_version() {
  local file="$1" expected="$2" label="$3"
  if [ ! -f "$file" ]; then
    fail "  $label observed=(页面不存在) expected=$expected"
    return
  fi
  local values
  values="$({ grep -oE "${ACTIVE_MARKER}=\"[^\"]*\"" "$file" | sed -E 's/.*="(.*)"$/\1/' | sort -u || true; })"
  local distinct
  distinct="$(printf '%s\n' "$values" | grep -c . || true)"
  if [ "$distinct" -eq 1 ] && [ "$values" = "$expected" ]; then
    pass "  $label observed=$values expected=$expected"
  else
    fail "  $label observed=${values:-（无标记）} expected=$expected"
  fi
}

assert_active_version "$DIST/v6.2.1/guide/introduction.html" "v6.2.1" "archived-en (v6.2.1/guide/introduction.html)"
assert_active_version "$DIST/v6.2.1/zh/guide/introduction.html" "v6.2.1" "archived-zh (v6.2.1/zh/guide/introduction.html)"
assert_active_version "$DIST/guide/introduction.html" "$CURRENT_VERSION" "latest-en (guide/introduction.html)"

old_label_total="$({ grep -rhoE "$OLD_LABEL" "$DIST" --include='*.html' || true; } | wc -l)"
marker_total="$({ grep -rhoE "${ACTIVE_MARKER}=\"[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      old_label_total=$old_label_total ${ACTIVE_MARKER}_total=$marker_total"

if [ "$old_label_total" -eq 0 ]; then
  pass "  写死标签 \"$OLD_LABEL\" observed=$old_label_total expected=0"
else
  fail "  写死标签 \"$OLD_LABEL\" observed=$old_label_total expected=0"
fi

if [ "$marker_total" -gt 0 ]; then
  pass "  对照组：同一棵树里 ${ACTIVE_MARKER} observed=$marker_total expected>0"
else
  fail "  对照组：同一棵树里 ${ACTIVE_MARKER} observed=$marker_total expected>0 —— 上面那个零是假的，搜索根本没读到文件"
fi

# ── 5. Mode-specific alpha assertions ───────────────────────────────────────

if [ "$MODE" = "--clean" ]; then
  echo "5. --clean：产物里不含 SNAPSHOT"
  if [ -d "$DIST/$SNAPSHOT_DIR_NAME" ]; then
    n="$(find "$DIST/$SNAPSHOT_DIR_NAME" -type f -name '*.html' | wc -l)"
    fail "  dist/$SNAPSHOT_DIR_NAME observed=存在（$n 个页面） expected=不存在 —— 这次断言跑在本地那一侧，不是 CI 那一侧；先跑 npm run clean:snapshot"
  else
    pass "  dist/$SNAPSHOT_DIR_NAME observed=不存在 expected=不存在"
  fi
else
  echo "5. --with-alpha：SNAPSHOT 覆盖与 commit 元数据"

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

# ── 6. Unreleased-badge assertions — --with-alpha side ONLY ────────────────
# The SNAPSHOT version exists only after injection. Running these on a clean
# checkout would assert the absence of something that was never built, which
# proves nothing — so this block is guarded by mode, not just by directory
# existence, and the guard is stated here rather than left implicit.

if [ "$MODE" = "--with-alpha" ]; then
  echo "6. --with-alpha：未发布徽章只出现在别处的下拉里，不出现在它自己的下拉里（VER-01）"

  if [ ! -d "$DIST/$SNAPSHOT_DIR_NAME" ]; then
    fail "  dist/$SNAPSHOT_DIR_NAME observed=不存在 expected=存在 —— 本条断言只在注入产物上有意义"
  else
    for pair in \
      "guide/introduction.html:/$SNAPSHOT_DIR_NAME/guide/introduction.html" \
      "zh/guide/introduction.html:/$SNAPSHOT_DIR_NAME/zh/guide/introduction.html"; do
      rel="${pair%%:*}"
      expected_href="${pair##*:}"
      page="$DIST/$rel"

      if [ ! -f "$page" ]; then
        fail "  $rel observed=(页面不存在) expected=存在"
        continue
      fi

      badge_n="$({ grep -o "$BADGE_MARKER" "$page" || true; } | wc -l)"
      href_n="$({ grep -oF "${LINK_ATTR}=\"${expected_href}\"" "$page" || true; } | wc -l)"

      echo "      $rel badge=$badge_n snapshot_row_href($expected_href)=$href_n"

      if [ "$badge_n" -gt 0 ]; then
        pass "  $rel 的下拉里徽章 observed=$badge_n expected>0"
      else
        fail "  $rel 的下拉里徽章 observed=$badge_n expected>0"
      fi

      if [ "$href_n" -gt 0 ]; then
        pass "  $rel 的 SNAPSHOT 行指向同一篇文章 observed=$href_n expected>0"
      else
        fail "  $rel 的 SNAPSHOT 行指向同一篇文章 observed=$href_n expected>0 —— 期望 $expected_href（同一篇文章），不是 SNAPSHOT 首页"
      fi
    done

    snap_page="$DIST/$SNAPSHOT_DIR_NAME/guide/introduction.html"
    if [ ! -f "$snap_page" ]; then
      fail "  SNAPSHOT 自己的页面 observed=(不存在) expected=存在"
    else
      badge_on_self="$({ grep -o "$BADGE_MARKER" "$snap_page" || true; } | wc -l)"
      rows_present="$({ grep -oF "${LINK_ATTR}=\"" "$snap_page" || true; } | wc -l)"

      echo "      SNAPSHOT 自己的下拉 badge=$badge_on_self rows=$rows_present"

      if [ "$badge_on_self" -eq 0 ]; then
        pass "  SNAPSHOT 自己的下拉里徽章 observed=$badge_on_self expected=0（活跃版本行会被过滤掉，不该带徽章）"
      else
        fail "  SNAPSHOT 自己的下拉里徽章 observed=$badge_on_self expected=0"
      fi

      if [ "$rows_present" -gt 0 ]; then
        pass "  对照组：SNAPSHOT 自己的下拉行数 observed=$rows_present expected>0"
      else
        fail "  对照组：SNAPSHOT 自己的下拉行数 observed=$rows_present expected>0 —— 上面那个零是假的，下拉根本没渲染"
      fi
    fi
  fi
fi

# ── 7. Injecting build must not write outside the injected tree ────────────
# --with-alpha side ONLY. This is not a rendered-link assertion; it is the
# replacement for the overflow-direction control verify-snapshot.sh item 12
# used to provide before D-59 (see 04-02-SUMMARY.md's handover, and this
# file's own header note on item 12). It carries its own positive control
# (plan-checker advisory 2): a temporary untracked file is created under
# docs/src, `git status --porcelain` is re-run over the same path and must
# report a non-zero count, then the file is removed. A clean result above is
# only meaningful once this control has shown the command CAN report dirt.

if [ "$MODE" = "--with-alpha" ]; then
  echo "7. --with-alpha：注入后 latest 源码树保持未修改（替代 verify-snapshot.sh 第 12 条曾单独提供的溢出方向哨兵）"

  porcelain_dirty="$(git status --porcelain -- docs/src | wc -l)"
  echo "      docs/src porcelain 行数=$porcelain_dirty"

  if [ "$porcelain_dirty" -eq 0 ]; then
    pass "  latest 源码树 porcelain observed=$porcelain_dirty expected=0"
  else
    fail "  latest 源码树 porcelain observed=$porcelain_dirty expected=0 —— 注入写到了 latest 源码树外"
  fi

  # 正控制：制造一个真实的未跟踪文件，再跑一次同样的命令，证明上面那个 0
  # 不是因为 git status 压根没在读 docs/src 这条路径。
  control_tmp="$(mktemp docs/src/.porcelain-control-XXXXXX)"
  control_dirty="$(git status --porcelain -- docs/src | wc -l)"
  rm -f "$control_tmp"

  echo "      对照组制造未跟踪文件后 porcelain 行数=$control_dirty"

  if [ "$control_dirty" -gt 0 ]; then
    pass "  对照组：制造未跟踪文件后 porcelain observed=$control_dirty expected>0"
  else
    fail "  对照组：制造未跟踪文件后 porcelain observed=$control_dirty expected>0 —— 上面那个 0 是假的，git status 根本没在读这条路径"
  fi
fi

echo "----------------------------------------"
echo "不成立条数: $failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
