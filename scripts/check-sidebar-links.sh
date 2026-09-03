#!/usr/bin/env bash
# Reverse direction of scripts/check-bilingual-parity.sh. That script asks
# "does every docs/src/ page have a sidebar entry?" (page -> sidebar). This
# script asks the opposite: "does every sidebar/nav link value resolve to a
# real page?" (sidebar/nav -> page). check-bilingual-parity.sh's own header
# declared this direction out of scope and left it for a separate script
# (.planning/todos/pending/sidebar-nav-link-gate-blind-spot.md) — this is
# that script.
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
# Pages Function routes, not files under docs/src/ or docs/archive/ — /api/
# is the first and (as of this script) only case. The list is intentionally
# an exact-match set, never a wildcard or path-prefix pattern.
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
NAV_EN="$ROOT/.vitepress/config/nav.en.mts"
NAV_ZH="$ROOT/.vitepress/config/nav.zh.mts"

# Exact link values that are Cloudflare Pages Function routes, not files.
# See the header comment above for why this must stay an exact-match list.
RUNTIME_ROUTE_EXEMPT=(
  '/api/'
)

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
      if [ ! -f "$path" ]; then
        fail_line "$const_name -> ${version:-latest} -> $(rel_path "$path")"
      fi
    done <<<"$pairs"
  done
}

# API constants (sidebarApiEN/ZH) declare no base: field at all; their links
# hang directly off each version's own .../api/ key.
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
      local path="$root/api/$link.md"
      total=$((total + 1))
      if [ ! -f "$path" ]; then
        fail_line "$const_name -> $version -> $(rel_path "$path")"
      fi
    done <<<"$pairs"
  done
}

# nav.{en,zh}.mts: three entries per language. One resolves to a real page
# (/guide/introduction), one is the Function route (/api/, exempt), one is an
# external http(s) address (skipped entirely — not counted, not a
# violation). Chinese nav's link value carries no /zh/ prefix; VitePress
# resolves it against the zh locale root, which is what root_for_lang below
# mirrors.
check_nav() {
  local file="$1" lang="$2"
  local links
  # WR-04 (02-REVIEW.md): reuses LINK_RE (dual-quote-aware, defined above
  # for extract_base_link_pairs) instead of a separate single-quote-only
  # ad hoc pattern. nav.en.mts/nav.zh.mts happen to use single quotes
  # throughout today, so the old pattern passed, but it was a latent,
  # silent under-extraction — a future double-quoted nav entry would not
  # match, and because other entries in the same file still use single
  # quotes, $links would stay non-empty, so the "0 extracted" self-check
  # below would never catch the gap.
  links="$(grep -oE "$LINK_RE" "$file" | sed -E "s/$LINK_RE/\1/")"
  if [ -z "$links" ]; then
    echo "FAIL: nav in $(rel_path "$file") extracted 0 link: entries — treating as script self-failure, not zero violations"
    self_check_failed=1
    return
  fi
  local root="$ROOT/docs/src"
  [ "$lang" = "zh" ] && root="$ROOT/docs/src/zh"
  while IFS= read -r link; do
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
    if [ ! -f "$path" ]; then
      fail_line "nav($lang) -> $link -> $(rel_path "$path")"
    fi
  done <<<"$links"
}

check_guide_constant "sidebarGuideEN" "$SIDEBAR_EN" en ""
check_guide_constant "sidebarGuideEN_v624" "$SIDEBAR_EN" en v6.2.4 v6.2.3 v6.2.2
check_guide_constant "sidebarGuideEN_v620" "$SIDEBAR_EN" en v6.2.1 v6.2.0
check_guide_constant "sidebarGuideEN_v610" "$SIDEBAR_EN" en v6.1.0
check_api_constant "sidebarApiEN" "$SIDEBAR_EN" en v6.2.4 v6.2.3 v6.2.2 v6.2.1 v6.2.0 v6.1.0

check_guide_constant "sidebarGuideZH" "$SIDEBAR_ZH" zh ""
check_guide_constant "sidebarGuideZH_v624" "$SIDEBAR_ZH" zh v6.2.4 v6.2.3 v6.2.2
check_guide_constant "sidebarGuideZH_v620" "$SIDEBAR_ZH" zh v6.2.1 v6.2.0
check_guide_constant "sidebarGuideZH_v610" "$SIDEBAR_ZH" zh v6.1.0
check_api_constant "sidebarApiZH" "$SIDEBAR_ZH" zh v6.2.4 v6.2.3 v6.2.2 v6.2.1 v6.2.0 v6.1.0

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
