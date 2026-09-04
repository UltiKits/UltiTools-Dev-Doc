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
# This block used to record ~6,000 `href="/zh/v<version>/"` hits across dist as
# a known live defect that was out of scope: VitePress's own language switcher
# (VPNavBarTranslations) and overflow menu (VPNavBarExtra) enumerate
# site.locales, @viteplus/versions generated locale keys shaped `zh/v6.2.4`
# with link `/zh/v6.2.4/`, and the site served `/v6.2.4/zh/` instead, so the
# language switcher 404'd from every archived page.
#
# That defect is now fixed at its root. `link: '/zh/'` in locale.zh.mts was
# keying the plugin's localesMap on `/zh/` instead of `zh`, so `zh` was never
# recognised as a language and stayed in the path. With the line removed the
# plugin's emitted URLs and its internal locale keys agree, and `/zh/<version>/`
# is the shape the site serves — which is why the assertion below now expects
# the OPPOSITE shape to be absent.
#
# The assertion is still scoped to this phase's own `data-ut-version-link`
# attribute, because that is the link set this phase is responsible for. The
# unscoped whole-dist counts are covered separately by the per-version scans in
# section 1, which now read both $DIST/<version> and $DIST/<locale>/<version>.
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
# The archived notice bar's own "go to the latest version" link (VER-05).
NOTICE_ATTR='data-ut-notice-link'
BADGE_MARKER='data-ut-unreleased-badge'
# The notice bar's close control (added 2026-09-04) and the two accessible names
# it renders. The labels are duplicated from VersionNoticeBar.vue's dismissLabel
# on purpose: an assertion that re-derived them from the component would pass
# whatever the component happened to say, including nothing.
DISMISS_ATTR='data-ut-notice-dismiss'
DISMISS_LABEL_EN='Dismiss this notice'
DISMISS_LABEL_ZH='关闭此提示'
# The class @viteplus/versions' auto-injected dropdown renders on its own root
# (components/version-switcher.component.vue:100 and :119), which 04-03 turned
# off via versionsConfig.versionSwitcher: false and replaced with
# UtVersionSwitcher.vue. Measured absent (0 hits) on the 04-03 artifact.
#
# This used to search for the two-word English phrase "API Version" — the text
# that dropdown was configured with on master. That is a natural-language
# string over 394 rendered pages: a future doc sentence, table header or
# translated heading would turn a permanent CI gate red for a reason unrelated
# to what it tests, and the failure message would point at the version
# switcher. The class cannot collide with prose, and it is what the component
# renders unconditionally rather than what it happened to be configured with.
OLD_SWITCHER_CLASS='VP(Screen)?VersionSwitcher'
# Present in every built page, whatever this phase does — the control for the
# zero-hit assertions below.
CONTROL_MARKER='__VP_SITE_DATA__'
SNAPSHOT_DIR_NAME='v6.3.0-SNAPSHOT'
# Chinese archived pages are served at /<locale>/<version>/..., not
# /<version>/<locale>/.... Every per-version scan below has to look in both
# places or it silently sees only the English half.
LOCALE_SEGMENT='zh'

# Derived, not hardcoded, matching this file's own convention of deriving
# expected values from source rather than writing them twice.
# 三点都不是多余的。set -euo pipefail 下，简单赋值取命令替换的退出码，所以
# grep 不命中会直接在赋值那一行以裸 exit 1 中止，下面那条友好诊断和刻意的
# exit 2 是够不到的。行首锚定是因为注释里的 current: '…' 同样会被匹配，
# 而 grep -oE 会吐出两行，让 CURRENT_VERSION 变成多行字符串，之后每一次比较
# 都静默不成立。行数断言是这两点的兜底。参照 scripts/generate-version-pages.mjs
# 的同名解析（那份也锚定，也断言唯一命中）。
if ! CURRENT_VERSION="$(grep -oE "^[[:space:]]*current:[[:space:]]*'[^']*'" .vitepress/config.mts \
      | sed -E "s/.*'(.*)'.*/\1/")" \
   || [ -z "$CURRENT_VERSION" ] \
   || [ "$(printf '%s\n' "$CURRENT_VERSION" | wc -l)" -ne 1 ]; then
  echo "check-rendered-links: 无法从 .vitepress/config.mts 唯一解析 versionsConfig.current" >&2
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

  # expected counts every .md under docs/archive/<version>/, which includes the
  # Chinese half. That half is emitted to $DIST/<locale>/<version>/, so both
  # trees have to be scanned; scanning only $DIST/<version> reports exactly the
  # English half and reads as a 50% regression.
  version_dirs=""
  [ -d "$DIST/$version" ] && version_dirs="$DIST/$version"
  [ -d "$DIST/$LOCALE_SEGMENT/$version" ] && version_dirs="$version_dirs $DIST/$LOCALE_SEGMENT/$version"

  if [ -z "$version_dirs" ]; then
    fail "  $version observed=(产物目录不存在) expected=$expected"
    continue
  fi

  # shellcheck disable=SC2086
  observed="$({ grep -rl "$STATE_MARKER" $version_dirs --include='*.html' || true; } | wc -l)"

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

# A version directory now appears at two depths: $DIST/<version> (English) and
# $DIST/<locale>/<version> (Chinese). Excluding only the first left all 145
# Chinese archived pages classified as "latest", which made the zero-notice-bar
# assertion below read 145 instead of 0.
latest_files="$(find "$DIST" -type f -name '*.html' | grep -vE "^$DIST/(v[0-9]|$LOCALE_SEGMENT/v[0-9])" || true)"
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
link_version_first="$({ grep -rhoE "$LINK_ATTR=\"/v[0-9][^\"]*/zh/[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      ${LINK_ATTR}_total=$link_total zh_first=$link_zh_first version_first=$link_version_first"

if [ "$link_total" -gt 0 ]; then
  pass "  $LINK_ATTR observed=$link_total expected>0"
else
  fail "  $LINK_ATTR observed=$link_total expected>0 —— 每个产物页都应带有该属性（04-03 已交付），零命中说明这条断言已经失去了检查对象"
fi

# 这两条的期望值互换过一次。中文归档页曾经服务在 /<版本>/zh/，因为 locale.zh.mts
# 里的 link: '/zh/' 让 @viteplus/versions 认不出 zh 是一门语言；那时 /zh/<版本>/
# 是坏形状。删掉那一行之后，插件发出的与它内部 locale key 一致的 /zh/<版本>/ 才是
# 站点真正服务的形状，坏的那个反过来成了 /<版本>/zh/。
if [ "$link_version_first" -eq 0 ]; then
  pass "  version_first observed=$link_version_first expected=0（总数 $link_total 为对照组，证明搜索确实读到了属性）"
else
  fail "  version_first observed=$link_version_first expected=0 —— 中文页版本切换会 404（站点服务的是 /zh/<版本>/…）"
fi

if [ "$link_zh_first" -gt 0 ]; then
  pass "  zh_first observed=$link_zh_first expected>0（中文页确实发出了带 locale 段的版本链接）"
else
  fail "  zh_first observed=$link_zh_first expected>0 —— 上面那个零是假的：中文版本链接根本没发出来"
fi

# 上面那条只证明「没有 /zh/<版本>/ 这个坏形状」。它证明不了中文页发出的是对的形状：
# 一次把 locale 段整个丢掉的回归（中文页发出 /v6.2.4/guide/introduction.html）在它
# 和 link_total 上都是绿的，然后在生产上 404。所以这里补一条正向形状断言，并且跑在
# --clean 一侧——CI 每个 PR 跑的就是这一侧。

zh_page="$DIST/zh/v6.2.1/guide/introduction.html"
if [ ! -f "$zh_page" ]; then
  fail "  中文归档样本页 observed=(不存在) expected=$zh_page"
else
  zh_rows_total="$({ grep -oE "$LINK_ATTR=\"[^\"]*\"" "$zh_page" || true; } | wc -l)"
  zh_rows_localised="$({ grep -oE "$LINK_ATTR=\"[^\"]*\"" "$zh_page" || true; } | { grep -c '/zh/' || true; })"
  zh_rows_versioned="$({ grep -oE "$LINK_ATTR=\"/zh/v[0-9][^\"]*\"" "$zh_page" || true; } | wc -l)"

  echo "      中文样本页 rows=$zh_rows_total 带 /zh/ 段=$zh_rows_localised locale 在前且带版本=$zh_rows_versioned"

  if [ "$zh_rows_total" -gt 0 ]; then
    pass "  对照组：中文样本页的切换器行数 observed=$zh_rows_total expected>0"
  else
    fail "  对照组：中文样本页的切换器行数 observed=$zh_rows_total expected>0 —— 下面两条的零都是假的，切换器根本没渲染"
  fi

  if [ "$zh_rows_localised" -eq "$zh_rows_total" ]; then
    pass "  中文样本页每一行都带 /zh/ 段 observed=$zh_rows_localised expected=$zh_rows_total"
  else
    fail "  中文样本页每一行都带 /zh/ 段 observed=$zh_rows_localised expected=$zh_rows_total —— 有行把 locale 段丢了，会 404"
  fi

  if [ "$zh_rows_versioned" -gt 0 ]; then
    pass "  中文样本页的版本行形状 /zh/<版本>/… observed=$zh_rows_versioned expected>0"
  else
    fail "  中文样本页的版本行形状 /zh/<版本>/… observed=$zh_rows_versioned expected>0 —— 只剩当前版本那一行了？"
  fi
fi

# VER-05：归档提示条自己的「去最新版」链接。它是提示条存在的理由，而在 04-04 之前
# 这个文件里对它一条断言都没有——一次把 href 发成空字符串的回归，在 285 个归档页上
# 可以全绿通过。三条断言互为对照：总数是后两条的正控制，总数本身以「带 archived
# 状态的页面数」为期望值，两者由同一棵树上的两次独立扫描得出。

echo "3b. 归档提示条的一键到最新版链接（VER-05）"

archived_pages="$({ grep -rl "$STATE_MARKER=\"archived\"" "$DIST" --include='*.html' || true; } | wc -l)"
notice_total="$({ grep -rhoE "$NOTICE_ATTR=\"[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"
notice_empty="$({ grep -rhoF "$NOTICE_ATTR=\"\"" "$DIST" --include='*.html' || true; } | wc -l)"
notice_relative="$({ grep -rhoE "$NOTICE_ATTR=\"[^/\"][^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      archived_pages=$archived_pages ${NOTICE_ATTR}_total=$notice_total 空值=$notice_empty 非绝对路径=$notice_relative"

if [ "$archived_pages" -gt 0 ] && [ "$notice_total" -eq "$archived_pages" ]; then
  pass "  $NOTICE_ATTR observed=$notice_total expected=$archived_pages（每个归档页恰好一条）"
else
  fail "  $NOTICE_ATTR observed=$notice_total expected=$archived_pages（每个归档页恰好一条）—— 归档页数为零也算不成立，那说明这条断言已经没有检查对象了"
fi

if [ "$notice_empty" -eq 0 ]; then
  pass "  $NOTICE_ATTR 空值 observed=$notice_empty expected=0（总数 $notice_total 为对照组）"
else
  fail "  $NOTICE_ATTR 空值 observed=$notice_empty expected=0 —— 提示条的链接指向空，VER-05 形同虚设"
fi

if [ "$notice_relative" -eq 0 ]; then
  pass "  $NOTICE_ATTR 非绝对路径 observed=$notice_relative expected=0（总数 $notice_total 为对照组）"
else
  fail "  $NOTICE_ATTR 非绝对路径 observed=$notice_relative expected=0 —— 相对路径在归档子目录下会解析到错的地方"
fi

# ── 3c. Dismiss control on every notice bar ────────────────────────────────
# The close button was added on maintainer request (2026-09-04) after the bar
# had already shipped as non-dismissible. It is client-side behaviour, but its
# markup is server-rendered, and that is the part this file can hold: the
# control must exist in the built HTML of every bar, be a real <button> so it is
# keyboard-reachable without a role/tabindex graft, and carry a non-empty
# accessible name in the reader's own language.
#
# The two locale labels are counted separately and required to sum to the total.
# A single "at least one aria-label" assertion would pass a regression that
# wired only English, which is the shape a bilingual site actually regresses in.
#
# What the count equality does and does not prove (second-pass review, 2026-09-04).
# It counts the attribute across all of dist and compares against the bar count;
# it does not assert the control sits INSIDE the bar. That is deliberate. The
# realistic form of that regression -- the button moved out of the template's
# root element -- is already caught here, because the root element is the
# v-if: a button outside it renders on every page including the current release,
# where no bar exists, so dismiss_total exceeds bars_total and this section
# fails. The only variant that slips through is a button deliberately wrapped in
# a second v-if="visible" beside the bar, which no refactor produces by
# accident. A containment assertion written in grep would have to hard-code
# attribute order and Vue's scoped-style data attributes, and a gate that goes
# red on a harmless markup reshuffle costs more than the case it guards.

echo "3c. 提示条的关闭控件（2026-09-04 维护者要求追加）"

bars_total="$({ grep -rhoE "$STATE_MARKER=\"[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"
dismiss_total="$({ grep -rhoF "$DISMISS_ATTR" "$DIST" --include='*.html' || true; } | wc -l)"
dismiss_buttons="$({ grep -rhoE "<button[^>]*$DISMISS_ATTR[^>]*>" "$DIST" --include='*.html' || true; } | wc -l)"
label_en="$({ grep -rhoF "aria-label=\"$DISMISS_LABEL_EN\"" "$DIST" --include='*.html' || true; } | wc -l)"
label_zh="$({ grep -rhoF "aria-label=\"$DISMISS_LABEL_ZH\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      bars=$bars_total ${DISMISS_ATTR}=$dismiss_total button元素=$dismiss_buttons 英文名=$label_en 中文名=$label_zh"

if [ "$bars_total" -gt 0 ] && [ "$dismiss_total" -eq "$bars_total" ]; then
  pass "  $DISMISS_ATTR observed=$dismiss_total expected=$bars_total（每条提示条恰好一个关闭控件）"
else
  fail "  $DISMISS_ATTR observed=$dismiss_total expected=$bars_total（提示条数为零也算不成立，那说明这条断言已经没有检查对象了）"
fi

if [ "$dismiss_total" -gt 0 ] && [ "$dismiss_buttons" -eq "$dismiss_total" ]; then
  pass "  关闭控件是 <button> observed=$dismiss_buttons expected=$dismiss_total"
else
  fail "  关闭控件是 <button> observed=$dismiss_buttons expected=$dismiss_total —— 换成 <a>/<div> 后 Tab 到不了，键盘读者没有关闭途径"
fi

if [ "$label_en" -gt 0 ] && [ "$label_zh" -gt 0 ] && [ $((label_en + label_zh)) -eq "$dismiss_total" ]; then
  pass "  可访问名称双语齐备 英文=$label_en 中文=$label_zh 合计=$dismiss_total"
else
  fail "  可访问名称双语齐备 英文=$label_en 中文=$label_zh 合计应为 $dismiss_total —— 任一语种为零即为只接了一侧"
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

  # 上面那条经过 sort -u，看的是「取值」不是「出现次数」，N 份相同的副本会塌成
  # 一个值照样通过。而切换器每页确实被服务端渲染两份：VitePress 自己的
  # VPNavBarMenu.vue:21-25 与本仓库的 SecondNavBar.vue:82 都会遍历 theme.nav 并
  # 渲染 component 分支，第二份只是被 Layout.vue 的
  # `.VPNavBar .content-body > .VPNavBarMenu.menu { display: none !important }`
  # 藏住了——一条先于本 Phase 存在、与切换器无关的规则。把出现次数一并断言，
  # 第三个消费方出现、或那条隐藏规则被动过，才会有信号。
  # 实测：393 个含标记的页面，每一页恰好 2 次。
  local occurrences
  occurrences="$({ grep -oE "${ACTIVE_MARKER}=\"[^\"]*\"" "$file" || true; } | wc -l)"
  if [ "$occurrences" -eq 2 ]; then
    pass "  $label 出现次数 observed=$occurrences expected=2（导航栏一份 + tab 栏一份）"
  else
    fail "  $label 出现次数 observed=$occurrences expected=2 —— 消费 theme.nav 的地方变了，或 Layout.vue 里那条隐藏规则被动过"
  fi
}

assert_active_version "$DIST/v6.2.1/guide/introduction.html" "v6.2.1" "archived-en (v6.2.1/guide/introduction.html)"
assert_active_version "$DIST/zh/v6.2.1/guide/introduction.html" "v6.2.1" "archived-zh (zh/v6.2.1/guide/introduction.html)"
assert_active_version "$DIST/guide/introduction.html" "$CURRENT_VERSION" "latest-en (guide/introduction.html)"

old_switcher_total="$({ grep -rhoE "$OLD_SWITCHER_CLASS" "$DIST" --include='*.html' || true; } | wc -l)"
marker_total="$({ grep -rhoE "${ACTIVE_MARKER}=\"[^\"]*\"" "$DIST" --include='*.html' || true; } | wc -l)"

echo "      old_switcher_total=$old_switcher_total ${ACTIVE_MARKER}_total=$marker_total"

if [ "$old_switcher_total" -eq 0 ]; then
  pass "  自动注入的旧下拉 \"$OLD_SWITCHER_CLASS\" observed=$old_switcher_total expected=0"
else
  fail "  自动注入的旧下拉 \"$OLD_SWITCHER_CLASS\" observed=$old_switcher_total expected=0 —— versionsConfig.versionSwitcher 被打开了？"
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
    # Both trees, for the same reason as section 1: the Chinese half is emitted
    # to $DIST/<locale>/<version>/, so scanning only $DIST/<version> reports
    # exactly half and reads as a 50% coverage regression.
    snapshot_dirs="$DIST/$SNAPSHOT_DIR_NAME"
    [ -d "$DIST/$LOCALE_SEGMENT/$SNAPSHOT_DIR_NAME" ] && snapshot_dirs="$snapshot_dirs $DIST/$LOCALE_SEGMENT/$SNAPSHOT_DIR_NAME"
    # shellcheck disable=SC2086
    observed="$({ grep -rl "$STATE_MARKER" $snapshot_dirs --include='*.html' || true; } | wc -l)"
    if [ "$observed" -eq "$expected" ]; then
      pass "  $SNAPSHOT_DIR_NAME observed=$observed expected=$expected"
    else
      fail "  $SNAPSHOT_DIR_NAME observed=$observed expected=$expected"
    fi

    # 03-CONTEXT.md D-43: the visible injection metadata is the only channel by
    # which a silently auto-disabled nightly sync is detectable. Exactly one
    # token per page, both locales — zero means the detector is gone, more than
    # one means it is being rendered somewhere it should not be.
    for page in \
      "$DIST/$SNAPSHOT_DIR_NAME/guide/introduction.html" \
      "$DIST/$LOCALE_SEGMENT/$SNAPSHOT_DIR_NAME/guide/introduction.html"; do
      rel="${page#$DIST/}"
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
      "zh/guide/introduction.html:/$LOCALE_SEGMENT/$SNAPSHOT_DIR_NAME/guide/introduction.html"; do
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
  echo "7. --with-alpha：注入后 latest 与已发布归档源码树都保持未修改（替代 verify-snapshot.sh 第 12 条曾单独提供的溢出方向哨兵）"

  # 路径原本只有 docs/src，于是「注入溢出进某个已发布的归档树」既不被这条覆盖，
  # 也不被 verify-snapshot.sh 第 12 条覆盖。加上 docs/archive 不花任何代价：
  # 唯一会被注入写入的归档子目录 docs/archive/v6.3.0-SNAPSHOT 本身就是
  # gitignore 的（.gitignore:156），所以正常注入不会让这条变红。
  porcelain_paths="docs/src docs/archive"
  porcelain_dirty="$(git status --porcelain -- $porcelain_paths | wc -l)"
  echo "      $porcelain_paths porcelain 行数=$porcelain_dirty"

  if [ "$porcelain_dirty" -eq 0 ]; then
    pass "  latest 与已发布归档源码树 porcelain observed=$porcelain_dirty expected=0"
  else
    fail "  latest 与已发布归档源码树 porcelain observed=$porcelain_dirty expected=0 —— 注入写到了 SNAPSHOT 树之外"
  fi

  # 正控制：在两条路径上各制造一个真实的未跟踪文件，再跑一次同样的命令，证明
  # 上面那个 0 不是因为 git status 压根没在读这两条路径。归档侧的控制文件放在
  # 一个已发布版本目录下，不放 SNAPSHOT 目录——后者是 gitignore 的，放在那里
  # 的控制文件永远不会出现在 porcelain 输出里，那样的「对照组」自己就是假的。
  # trap 先于任何可能失败的命令注册。set -e + pipefail 下，下一行那条管道失败会
  # 直接中止脚本，Ctrl-C 同样，两种情况都会把控制文件留在 docs/src 里——正是这条
  # 检查用来证明其干净的那棵树。下一次运行于是从上一次的残留里读出一个假的脏树。
  control_src="$(mktemp docs/src/.porcelain-control-XXXXXX)"
  control_archive="$(mktemp docs/archive/v6.2.4/.porcelain-control-XXXXXX)"
  trap 'rm -f "$control_src" "$control_archive"' EXIT INT TERM
  control_dirty="$(git status --porcelain -- $porcelain_paths | wc -l)"
  rm -f "$control_src" "$control_archive"
  trap - EXIT INT TERM

  echo "      对照组在两条路径各放一个未跟踪文件后 porcelain 行数=$control_dirty"

  if [ "$control_dirty" -eq 2 ]; then
    pass "  对照组：制造未跟踪文件后 porcelain observed=$control_dirty expected=2（两条路径各一条）"
  else
    fail "  对照组：制造未跟踪文件后 porcelain observed=$control_dirty expected=2 —— 上面那个 0 是假的，git status 至少有一条路径没在读"
  fi
fi


# ── 8. Rendered sidebar hrefs must resolve in the build output ─────────────
# scripts/check-sidebar-links.sh 检查的是配置里的 link 字面量，并且自己动手把
# 它拼成一个 URL。那份重拼与 @viteplus/versions 的 populateSidebar 实际发出的
# 不是同一个值——check_api_constant 里写死了一段 `api/`（`$root/api/$link.md`），
# 而运行时注入的 base 只到版本根，于是门禁解析到存在的
# docs/archive/v6.2.4/api/version-wrapper.md 并转绿，读者点到的却是
# /v6.2.4/version-wrapper.html，实测 404，24 条地址、72 次出现。
#
# 「门禁自己重新实现一遍框架的路径拼接」这个写法本身就是缺陷来源：两份实现
# 只要有一处不同，门禁就会在缺陷存在时报绿。本节从相反方向断言——取 VitePress
# 真正渲染进侧边栏的 href，要求每一条要么在产物里解析得到文件，要么落在
# Cloudflare Function 的路由范围内。字面量那一侧永远看不见这一类缺陷。
echo "8. 侧边栏渲染出的 href 在产物里可解析"

sidebar_report="$(python3 - "$DIST" "$ROOT/functions" <<'PY'
import os, re, sys, collections

dist, functions_root = sys.argv[1], sys.argv[2]

# Function 路由前缀从 functions/ 的目录布局推出，不写死：
# functions/api/[[path]].js 使 /api/ 及其下所有路径由 Function 提供，
# 产物里没有对应文件是正常的，不是死链。
route_prefixes = []
if os.path.isdir(functions_root):
    for name in sorted(os.listdir(functions_root)):
        if name.startswith('_') or name.startswith('.'):
            continue
        if os.path.isdir(os.path.join(functions_root, name)):
            route_prefixes.append('/' + name + '/')

# 侧边栏条目的 <a>：VPSidebarItem 传入的 link 与 VPLink 自身的 link 叠加成
# class="VPLink link link"。抽样 40 页实测该式命中数与 VPSidebarItem…is-link
# 的块数逐页相等，所以它抽的正好是侧边栏条目，不多不少。
ANCHOR = re.compile(r'<a class="VPLink link link" href="([^"]+)"')

def resolves(href):
    path = href.split('#')[0].split('?')[0]
    if not path.startswith('/'):
        return True          # 外链与相对锚点不在本节范围内
    for p in route_prefixes:
        if path == p.rstrip('/') or path == p or path.startswith(p):
            return True
    local = os.path.join(dist, path.lstrip('/'))
    return (os.path.isfile(local)
            or os.path.isfile(local + '.html')
            or os.path.isfile(os.path.join(local.rstrip('/'), 'index.html')))

occurrences = collections.Counter()
pages = 0
for root, _dirs, files in os.walk(dist):
    if os.sep + 'assets' in root:
        continue
    for fn in files:
        if not fn.endswith('.html'):
            continue
        pages += 1
        with open(os.path.join(root, fn), encoding='utf-8', errors='ignore') as fh:
            for href in ANCHOR.findall(fh.read()):
                occurrences[href] += 1

bad = {h: n for h, n in occurrences.items() if not resolves(h)}

print(f"PAGES {pages}")
print(f"DISTINCT {len(occurrences)}")
print(f"OCCUR {sum(occurrences.values())}")
print("ROUTES " + (",".join(route_prefixes) if route_prefixes else "(none)"))
# 阴性对照：一个必然不存在的地址必须被判为不可解析。没有这一条，上面的
# 「0 条不可解析」有可能只是因为 resolves() 恒真（例如 dist 路径拼错时
# os.path.isfile 全部为假、而某个分支又提前 return True）。
print("CONTROL " + ("unresolvable" if not resolves("/__no_such_page_control__/x.html") else "resolvable"))
for h, n in sorted(bad.items()):
    print(f"BAD {n} {h}")
PY
)"

sidebar_pages="$(printf '%s\n' "$sidebar_report" | awk '/^PAGES /{print $2}')"
sidebar_distinct="$(printf '%s\n' "$sidebar_report" | awk '/^DISTINCT /{print $2}')"
sidebar_occur="$(printf '%s\n' "$sidebar_report" | awk '/^OCCUR /{print $2}')"
sidebar_routes="$(printf '%s\n' "$sidebar_report" | sed -n 's/^ROUTES //p')"
sidebar_control="$(printf '%s\n' "$sidebar_report" | awk '/^CONTROL /{print $2}')"
sidebar_bad="$(printf '%s\n' "$sidebar_report" | grep -c '^BAD ' || true)"

echo "      扫描 $sidebar_pages 个页面，互异侧边栏 href $sidebar_distinct 条 / 共 $sidebar_occur 次；Function 路由前缀=$sidebar_routes"

# 对照组先判，且它不成立时下面那个 0 不算数。
if [ "$sidebar_control" = "unresolvable" ]; then
  pass "  对照组：一个必然不存在的地址被判为不可解析 observed=$sidebar_control"
else
  fail "  对照组：一个必然不存在的地址被判为 observed=$sidebar_control expected=unresolvable —— 解析器恒真，下面的结果不算数"
fi

if [ "${sidebar_distinct:-0}" -gt 0 ]; then
  pass "  对照组：抽到的侧边栏 href observed=$sidebar_distinct expected>0"
else
  fail "  对照组：抽到的侧边栏 href observed=$sidebar_distinct expected>0 —— 抽取式没读到东西，本节结果无意义"
fi

if [ "$sidebar_bad" -eq 0 ]; then
  pass "  全部侧边栏 href 可解析 observed=0 不可解析"
else
  fail "  侧边栏 href 不可解析 observed=$sidebar_bad 条互异地址 expected=0"
  printf '%s\n' "$sidebar_report" | sed -n 's/^BAD \([0-9]*\) \(.*\)$/        \1× \2/p'
fi


# ── 9. 导航栏的社交链接确实渲染出来了 ────────────────────────────────────────
# 这一节存在的理由是一个真实发生过、且**类型检查抓不住**的缺陷：
# locale.{en,zh}.mts 曾经写成 `...socialEN`，把 DefaultTheme.SocialLink[] 用展开
# 塞进 themeConfig，两条链接因此落成数字键 0 与 1，而 VitePress 读的是
# themeConfig.socialLinks——导航栏的图标从未渲染过。
#
# 为什么门禁必须放在产物侧：TypeScript 的多余属性检查**不作用于展开表达式**。
# 实测：即便给 localeEN 标注了 LocaleConfig<DefaultTheme.Config>，把 socialLinks
# 改回 `...socialEN` 之后 `npm run typecheck` 仍然退 0。类型层面没有任何标注能
# 抓住它，只有看渲染结果能。
#
# 期望值从配置源码里抽 link: 的取值，不写死也不数括号——social.zh.mts 的第二条是
# 多行写法，按 `{icon:` 数会漏掉它（本节第一版就是这么错的）。
echo "9. 导航栏社交链接在产物里渲染出来"

check_social_links() {
  local src="$1" page="$2" label="$3"
  if [ ! -f "$page" ]; then
    fail "  $label 找不到 $page"
    return
  fi
  local links count container missing
  links=$(grep -oE "link: *'[^']+'" "$src" | sed -E "s/link: *'(.*)'/\1/")
  count=$(printf '%s\n' "$links" | grep -c . || true)

  # 对照组：源码里抽不出链接时，下面的逐条断言会退化成零次检查而全绿。
  if [ "$count" -gt 0 ]; then
    pass "  $label 对照组：从 $(basename "$src") 抽出 $count 条链接 expected>0"
  else
    fail "  $label 对照组：从 $(basename "$src") 抽出 0 条链接 —— 下面的逐条断言等于没跑"
    return
  fi

  container=$(grep -c 'VPNavBarSocialLinks' "$page" || true)
  if [ "$container" -ge 1 ]; then
    pass "  $label 导航栏社交链接容器 observed=$container expected>=1"
  else
    fail "  $label 导航栏社交链接容器 observed=$container expected>=1 —— VitePress 没读到 themeConfig.socialLinks（检查 locale 里是不是写成了展开）"
  fi

  # 在容器之后的一段有界窗口里数锚点，而不是全页数：页面正文里的团队成员卡片
  # 同样渲染 VPSocialLink，全页计数会把它们一起算进来（第一版就是这么错的，
  # 数出 14）。也不能只断言「配置里的 URL 出现在页面某处」——那些 URL 在
  # git-changelog 的 repoURL 与正文里也出现，那样的断言在缺陷在场时照样通过，
  # 是一条不可能失败的断言。
  local window rendered
  window=$(tr -d '\n' < "$page" | sed -n 's/.*VPNavBarSocialLinks//p' | cut -c1-1200)
  rendered=$(printf '%s' "$window" | grep -o 'class="VPSocialLink' | wc -l | tr -d ' ')
  if [ "$rendered" = "$count" ]; then
    pass "  $label 容器内渲染出的社交链接数 observed=$rendered expected=$count"
  else
    fail "  $label 容器内渲染出的社交链接数 observed=$rendered expected=$count（期望值从 $(basename "$src") 的 link: 取值数出）"
  fi
}

check_social_links ".vitepress/config/social.en.mts" "$DIST/guide/introduction.html" "英文"
check_social_links ".vitepress/config/social.zh.mts" "$DIST/zh/guide/introduction.html" "中文"

echo "----------------------------------------"
echo "不成立条数: $failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
