#!/usr/bin/env bash
# Reverse direction of scripts/check-bilingual-parity.sh. That script asks
# "does every docs/src/ page have a sidebar entry?" (page -> sidebar). This
# script asks the opposite: "does every sidebar/nav link value resolve to a
# real page?" (sidebar/nav -> page). check-bilingual-parity.sh's own header
# declared this direction out of scope and left it for a separate script
# (.planning/todos/pending/sidebar-nav-link-gate-blind-spot.md) — this is
# that script.
#
# For archived versions it also checks page -> sidebar: every page in
# docs/archive/<version>/{,zh/}guide must be linked from the sidebar that
# .vitepress/config/archive-sidebars.mjs assigns to that version, so a wrong
# version -> sidebar mapping fails even when every link it does have resolves.
#
# set -uo pipefail, not -e: this is a multi-unit scan across many constants
# and many prefixes. One bad resolution must not abort the scan before the
# rest are checked — same posture as check-container-length.sh, which is a
# multi-file/multi-block scanner for the same reason.
#
# Zero arguments is not an error: this script reads a fixed set of config
# files (sidebar.{en,zh}.mts, nav.{en,zh}.mts), not a caller-supplied file
# list. But extracting ZERO link: lines from a constant that is expected to
# have some IS treated as the script's own failure (exit 2), not as "zero
# violations" (exit 0) — the same fail-closed posture as
# check-bilingual-parity.sh's check_extraction(). A renamed or restructured
# constant must never silently read as "all good".
#
# ── Extraction: anchored to line start, inherited caveat ────────────────────
# Constant boundaries are found by anchoring on "^const <name>: " (not by
# hardcoded line numbers, which break silently the moment a constant grows or
# shrinks). Within a constant's region, `base:` and `link:` fields are matched
# anchored to (optional leading whitespace then) line start — not as a
# substring search anywhere in the line. An unanchored search would treat any
# byte sequence matching `link: '...'` as a real entry, including one that
# happens to appear inside a quoted `text:` value; anchoring rules that out.
#
# Known boundary (inherited verbatim from check-bilingual-parity.sh, and
# still true here): a decoy appearing at the START of a continuation line
# (e.g. the second line of a wrapped `text:` value) would still slip past
# this anchor. Eliminating that class of false-positive entirely requires
# actually parsing the sidebar arrays as JS/TS rather than scanning the
# source text line by line — deferred to the next time this script needs a
# rewrite, not attempted here.
#
# ── Exemption: exact link value, never a path prefix ─────────────────────────
# RUNTIME_ROUTE_EXEMPT below lists exact link values that are Cloudflare
# Pages Function routes, not files under docs/src/ or docs/archive/. The
# reviewed exact values are /api/, /api/6.4.0/index.html, /api/6.3.2/index.html,
# /api/6.3.1/index.html, /api/6.3.0/index.html and /api/6.2.5/index.html;
# the versioned ones are handled by functions/api/[[path]].js, which
# proxies /api/{version}/… to javadoc.io. The list is intentionally an
# exact-match set, never a wildcard or path-prefix pattern.
# scripts/check-container-length.sh's header carries the full argument for
# why: a path-prefix exemption (e.g. "/api/*") would silently exempt every
# current AND FUTURE link under that prefix, whereas an exact-value exemption
# bounds the exception to one known, reviewed case — the next reader can grep
# this file's RUNTIME_ROUTE_EXEMPT declaration and see exactly what's
# excluded and why, instead of trusting an open-ended pattern. Repeated here,
# not just cross-referenced, because a reader of THIS script should not have
# to go read a different script's header to trust this one's severity claim.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SIDEBAR_EN="$ROOT/.vitepress/config/sidebar.en.mts"
SIDEBAR_ZH="$ROOT/.vitepress/config/sidebar.zh.mts"
# NAV_EN / NAV_ZH may be overridden from the environment so CI can rehearse
# the nav extraction on a fixture (scripts/fixtures/nav-trailing-close.mts).
NAV_EN="${NAV_EN:-$ROOT/.vitepress/config/nav.en.mts}"
NAV_ZH="${NAV_ZH:-$ROOT/.vitepress/config/nav.zh.mts}"

# Exact link values that are Cloudflare Pages Function routes, not files.
# See the header comment above for why this must stay an exact-match list.
RUNTIME_ROUTE_EXEMPT=(
  '/api/'
  '/api/6.4.0/index.html'
  '/api/6.3.2/index.html'
  '/api/6.3.1/index.html'
  '/api/6.3.0/index.html'
  '/api/6.2.5/index.html'
)

# Archived pages that were published without a sidebar entry and stay that
# way, because archives are frozen. Exact paths, same reasoning as
# RUNTIME_ROUTE_EXEMPT. These five Chinese-only version-wrapper pages are the
# ones docs/public/_redirects already documents (their English counterpart
# never existed); they were reachable only by in-page links.
ARCHIVE_ORPHAN_EXEMPT=(
  'docs/archive/v6.2.4/zh/guide/essentials/version-wrapper.md'
  'docs/archive/v6.2.3/zh/guide/essentials/version-wrapper.md'
  'docs/archive/v6.2.2/zh/guide/essentials/version-wrapper.md'
  'docs/archive/v6.2.1/zh/guide/essentials/version-wrapper.md'
  'docs/archive/v6.2.0/zh/guide/essentials/version-wrapper.md'
)

is_orphan_exempt() {
  local val="$1" e
  for e in "${ARCHIVE_ORPHAN_EXEMPT[@]}"; do
    [ "$val" = "$e" ] && return 0
  done
  return 1
}

total=0
bad=0
self_check_failed=0

rel_path() {
  printf '%s\n' "${1#"$ROOT"/}"
}

is_exempt() {
  local val="$1" e
  for e in "${RUNTIME_ROUTE_EXEMPT[@]}"; do
    [ "$val" = "$e" ] && return 0
  done
  return 1
}

fail_line() {
  echo "FAIL: $1"
  bad=$((bad + 1))
}

# Regexes built as double-quoted strings (not inline in [[ ]]) to avoid
# nested-quote escaping ambiguity: single quotes need no escaping inside a
# double-quoted bash string, and \" produces a literal double quote — this
# reliably assembles the bracket expression ['"] regardless of which quote
# style a given base/link declaration uses (sidebar.zh.mts mixes both).
BASE_RE="base:[[:space:]]*['\"]([^'\"]*)['\"]"
LINK_RE="^[[:space:]]*link:[[:space:]]*['\"]([^'\"]*)['\"]"

# Emits "base|link" pairs for every link: found inside the named constant's
# region. base carries forward from the most recent base: line seen within
# that region (group-scoped, exactly how the sidebar arrays are structured);
# it is empty for constants that never declare base: (sidebarApiEN/ZH).
extract_base_link_pairs() {
  local const_name="$1" file="$2" cur_base=""
  while IFS= read -r line; do
    if [[ "$line" =~ $BASE_RE ]]; then
      cur_base="${BASH_REMATCH[1]}"
    fi
    if [[ "$line" =~ $LINK_RE ]]; then
      printf '%s|%s\n' "$cur_base" "${BASH_REMATCH[1]}"
    fi
  done < <(awk -v c="$const_name" '$0 ~ "^const " c ": " {flag=1; next} /^const /{flag=0} flag' "$file")
}

guide_root() {
  local lang="$1" version="$2"
  if [ -z "$version" ]; then
    if [ "$lang" = "en" ]; then printf '%s\n' "$ROOT/docs/src"; else printf '%s\n' "$ROOT/docs/src/zh"; fi
  else
    if [ "$lang" = "en" ]; then printf '%s\n' "$ROOT/docs/archive/$version"; else printf '%s\n' "$ROOT/docs/archive/$version/zh"; fi
  fi
}

# Guide constants: base is per-group ('/guide/', '/guide/advanced/',
# '/guide/essentials/' are the three values in use), so the extracted base is
# what supplies the middle path segment; the root varies by which version
# prefix(es) this constant is mapped to in locale.{en,zh}.mts.
check_guide_constant() {
  local const_name="$1" file="$2" lang="$3"; shift 3
  local versions=("$@")
  local pairs
  pairs="$(extract_base_link_pairs "$const_name" "$file")"
  if [ -z "$pairs" ]; then
    echo "FAIL: $const_name in $(rel_path "$file") extracted 0 link: entries — treating as script self-failure, not zero violations"
    self_check_failed=1
    return
  fi
  local version
  for version in "${versions[@]}"; do
    local root
    root="$(guide_root "$lang" "$version")"
    local -A linked=()
    while IFS='|' read -r base link; do
      [ -z "$link" ] && continue
      case "$link" in
        /*)
          # Absolute link (a Function route added by D-30). Routed through
          # the same is_exempt() check_nav uses (WR-03, 02-REVIEW.md):
          # previously ANY absolute link skipped file resolution here
          # unconditionally, based on shape alone — exactly the open-ended
          # exemption the header comment above argues against. Only an
          # exact-match entry in RUNTIME_ROUTE_EXEMPT is still skipped
          # (uncounted, matching the "新增 2 条走豁免不计入" carve-out); an
          # absolute link that is NOT in that list is counted and fails
          # loudly instead of being silently waved through.
          if is_exempt "$link"; then
            continue
          fi
          total=$((total + 1))
          fail_line "$const_name -> ${version:-latest} -> unexempted absolute link $link"
          continue
          ;;
      esac
      local base_trimmed path
      base_trimmed="$(printf '%s' "$base" | sed -E 's#^/##; s#/$##')"
      if [ -n "$base_trimmed" ]; then
        path="$root/$base_trimmed/$link.md"
      else
        path="$root/$link.md"
      fi
      total=$((total + 1))
      linked["$path"]=1
      if [ ! -f "$path" ]; then
        fail_line "$const_name -> ${version:-latest} -> $(rel_path "$path")"
      fi
    done <<<"$pairs"
    # Reverse direction, archived versions only (the latest side is
    # check-bilingual-parity.sh's job): every page in the archived guide tree
    # must be reachable from the sidebar the mapping assigns to it. Without
    # this, mapping v6.2.4 to the 6.2.0 sidebar passed: all of that sidebar's
    # links exist in v6.2.4 too, and the two pages 6.2.4 added simply had no
    # navigation entry.
    if [ -n "$version" ] && [ -d "$root/guide" ]; then
      local page
      while IFS= read -r page; do
        is_orphan_exempt "$(rel_path "$page")" && continue
        total=$((total + 1))
        if [ -z "${linked[$page]+x}" ]; then
          fail_line "$const_name -> $version -> $(rel_path "$page") has no entry in the mapped sidebar"
        fi
      done < <(find "$root/guide" -type f -name '*.md' | sort)
    fi
    unset linked
  done
}

# API constants (sidebarApiEN/ZH) declare no base: field at all. Their links are
# resolved against the version root, NOT against that version's api/ directory.
#
# This block used to build the path as "$root/api/$link.md" — it supplied the
# api/ segment itself, on the assumption that the sidebar key 'vX.Y.Z/api/'
# contributes that segment to the emitted URL. It does not. @viteplus/versions'
# populateSidebar (dist/index.js) derives the injected base from the key's lang
# and version only, producing '/<lang>/<version>/'; every other segment of the
# key is dropped. So the gate resolved a file that exists
# (docs/archive/v6.2.4/api/version-wrapper.md) while the rendered href was
# /v6.2.4/version-wrapper.html, which does not exist — 24 addresses, 72
# occurrences, green gate.
#
# A gate that re-implements the framework's path assembly is a defect source in
# its own right: the two implementations only have to differ in one place for
# the gate to report green while the defect is live. The link values now carry
# the api/ prefix themselves and this resolves them as written, with no
# reconstruction. check-rendered-links.sh section 8 covers the same ground from
# the build artifact, which is the side a reader actually clicks.
check_api_constant() {
  local const_name="$1" file="$2" lang="$3"; shift 3
  local versions=("$@")
  local pairs
  pairs="$(extract_base_link_pairs "$const_name" "$file")"
  if [ -z "$pairs" ]; then
    echo "FAIL: $const_name in $(rel_path "$file") extracted 0 link: entries — treating as script self-failure, not zero violations"
    self_check_failed=1
    return
  fi
  local version
  for version in "${versions[@]}"; do
    local root="$ROOT/docs/archive/$version"
    [ "$lang" = "zh" ] && root="$ROOT/docs/archive/$version/zh"
    while IFS='|' read -r _base link; do
      [ -z "$link" ] && continue
      local path="$root/$link.md"
      total=$((total + 1))
      if [ ! -f "$path" ]; then
        fail_line "$const_name -> $version -> $(rel_path "$path")"
      fi
    done <<<"$pairs"
  done
}

# nav.{en,zh}.mts: each entry is checked on its own. An external http(s)
# address is skipped entirely (not counted, not a violation); an exact
# RUNTIME_ROUTE_EXEMPT value such as the Function route /api/ is counted but
# not resolved. Every other link must resolve to a page. Without
# skipVersioning, a link carries no /zh/ prefix: the versioning helper adds it
# on the site, so a zh link is resolved against docs/src/zh. An entry with
# skipVersioning: true bypasses that helper; a zh entry of that kind that
# carries /zh/ itself is resolved from docs/src (see the per-entry rule in the
# loop below). A zh skipVersioning entry without /zh/ is still resolved
# against docs/src/zh and passes, although the site sends Chinese readers to
# the English page; that case is known and not checked.
check_nav() {
  local file="$1" lang="$2"
  local links
  # WR-04 (02-REVIEW.md) asked for dual-quote-aware extraction; the awk
  # below accepts single or double quotes. The "0 extracted" self-check
  # still treats an empty result as a script failure, not zero violations.
  # One "link<TAB>skip" line per nav entry, where skip is 1 when the same
  # entry declares skipVersioning: true. Nav entries are flat objects with one
  # property per line. An entry ends on any line that starts with its closing
  # brace, including `}, // note`; scripts/fixtures/nav-trailing-close.mts
  # covers that layout.
  links="$(awk -v q="'" '
    function strip_link(s) {
      sub(/^[[:space:]]*link:[[:space:]]*/, "", s)
      s = substr(s, 2)
      sub("[\"" q "].*$", "", s)
      return s
    }
    /^[[:space:]]*\{/ { inobj = 1; link = ""; skip = 0 }
    inobj && /^[[:space:]]*link:[[:space:]]*/ { link = strip_link($0) }
    inobj && /^[[:space:]]*skipVersioning:[[:space:]]*true/ { skip = 1 }
    /^[[:space:]]*\}/ {
      if (inobj && link != "") print link "\t" skip
      inobj = 0
    }
  ' "$file")"
  if [ -z "$links" ]; then
    echo "FAIL: nav in $(rel_path "$file") extracted 0 link: entries — treating as script self-failure, not zero violations"
    self_check_failed=1
    return
  fi
  local root="$ROOT/docs/src"
  [ "$lang" = "zh" ] && root="$ROOT/docs/src/zh"
  local link skip
  while IFS=$'\t' read -r link skip; do
    [ -z "$link" ] && continue
    case "$link" in
      http*)
        # External address. Skipped entirely: not counted, not a violation.
        continue
        ;;
    esac
    total=$((total + 1))
    if is_exempt "$link"; then
      continue
    fi
    local path="$root$link.md"
    # The versioning helper adds the /zh/ prefix to zh nav links. An entry
    # with skipVersioning: true bypasses it, so such an entry must carry
    # /zh/ itself and is resolved from docs/src. Without skipVersioning a
    # /zh/ link would be prefixed twice on the site, so it keeps the zh root
    # and fails here.
    if [ "$lang" = "zh" ] && [ "$skip" = "1" ]; then
      case "$link" in
        /zh/*) path="$ROOT/docs/src$link.md" ;;
      esac
    fi
    if [ ! -f "$path" ]; then
      fail_line "nav($lang) -> $link -> $(rel_path "$path")"
    fi
  done <<<"$links"
}

# Latest sidebars resolve against docs/src.
check_guide_constant "sidebarGuideEN" "$SIDEBAR_EN" en ""
check_guide_constant "sidebarGuideZH" "$SIDEBAR_ZH" zh ""

# Archived versions: which frozen constant resolves against which
# docs/archive/<version> tree comes from .vitepress/config/archive-sidebars.mjs,
# the same table the locale configs build their sidebar keys from. It used to
# be written out here a second time, so a wrong mapping in the locale config
# (v6.2.4 pointed at the 6.2.0 sidebar renders 10 dead links) still passed, and
# a version missing from this list was not checked at all.
# archive-sidebars-plan.mjs exits 2 when any docs/archive/v* directory has no
# row (or a row has no directory); that is a self-failure here, not a pass.
# Versions whose row has api: null have no api/ pages; the plan asserts that
# too and emits no api line for them.
if ! plan="$(node "$ROOT/scripts/archive-sidebars-plan.mjs")"; then
  echo "FAIL: scripts/archive-sidebars-plan.mjs could not produce the archived sidebar plan (see the message above)"
  self_check_failed=1
  plan=""
fi
plan_lines=0
while IFS=$'\t' read -r kind const_name lang versions; do
  [ -z "$kind" ] && continue
  plan_lines=$((plan_lines + 1))
  file="$SIDEBAR_EN"
  [ "$lang" = "zh" ] && file="$SIDEBAR_ZH"
  # shellcheck disable=SC2086 # versions is a space-separated list by design
  case "$kind" in
    guide) check_guide_constant "$const_name" "$file" "$lang" $versions ;;
    api) check_api_constant "$const_name" "$file" "$lang" $versions ;;
    *) echo "FAIL: unknown plan line kind '$kind'"; self_check_failed=1 ;;
  esac
done <<<"$plan"
if [ "$self_check_failed" -eq 0 ] && [ "$plan_lines" -eq 0 ]; then
  echo "FAIL: archived sidebar plan was empty — treating as script self-failure, not zero violations"
  self_check_failed=1
fi

check_nav "$NAV_EN" en
check_nav "$NAV_ZH" zh

echo "----------------------------------------"
echo "总解析条数: $total"
echo "不成立条数: $bad"

if [ "$self_check_failed" -eq 1 ]; then
  exit 2
fi
if [ "$bad" -gt 0 ]; then
  exit 1
fi
exit 0
