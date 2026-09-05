#!/usr/bin/env bash
# Reachability gate for root-level tracked Markdown (CACHE-04).
#
# No existing docs-ci.yml job scans the repository root for Markdown — the
# `build` job's dead-link checker only walks docs/src and docs/archive
# (VitePress's srcDir), `bilingual-parity`/`container-length` are explicitly
# scoped to docs/src, and `sidebar-links` checks sidebar/nav targets, not
# README.md's own links. A rename or deletion of the root conclusion
# document (CACHING.md) would silently orphan the README pointer to it, and
# no gate would turn red. This script is that gate.
#
# Zero arguments. Exit code comes ONLY from the four numbered assertions
# below.
#
# set -uo pipefail, not set -e: one failed assertion must not abort the
# remaining ones — the value of a numbered-assertion script is a complete
# report from a single run (scripts/verify-sw.sh's header comment gives the
# same reasoning).
#
# Extractor scope (WR-01/02/03 from 06-REVIEW.md):
#   - Inline `](target)` links are recognized with an optional trailing
#     " title" and/or #anchor, both stripped before the `.md` filter.
#   - Fenced code blocks (``` ... ```) are stripped before extraction, so a
#     Markdown link written as a literal example inside a fence is never
#     treated as a real link. Tilde fences (~~~) are out of scope — this
#     repo's root docs only ever use backtick fences.
#   - Reference-style links (`[text][ref]` / `[ref]: target.md`) are NOT
#     resolved. Resolving them correctly (case-insensitive label matching,
#     the `[text][]` shorthand, definitions anywhere in the file) is
#     disproportionate to this script's one job — README/CACHING.md
#     reachability — so instead their presence is detected and reported as
#     a loud, named failure (see has_reference_style_links) rather than
#     silently falling through to "zero targets found". An explicit
#     "not supported" failure is a visible gap; a silent empty-target list
#     is exactly the failure mode this gate exists to avoid.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
status=0

record() { # record <label> <observed> <0|1>  (verbatim from verify-sw.sh / verify-api-proxy.sh)
  if [ "$3" -eq 0 ]; then
    printf 'PASS  %-56s  %s\n' "$1" "$2"
  else
    printf 'FAIL  %-56s  %s\n' "$1" "$2"
    status=1
  fi
}

# strip_fenced_blocks <file> — prints <file> with every line inside a
# ``` ... ``` fence removed, including the fence lines themselves (WR-02).
# Only backtick fences are recognized — see the scope note in the header
# comment.
strip_fenced_blocks() {
  local file="$1"
  awk '
    /^```/ { infence = !infence; next }
    infence { next }
    { print }
  ' "$file"
}

# has_reference_style_links <file> — true (0) when the file, with fenced
# code stripped first, contains reference-style Markdown link syntax: a
# usage `[text][ref]` (including the shorthand `[text][]`) or a definition
# line `[ref]: target` (WR-03). Command substitution below fully drains
# strip_fenced_blocks's awk process before grep -q ever runs, so there is
# no live upstream pipe for grep -q's early exit to SIGPIPE — same
# here-string idiom as the WR-04 fix, applied proactively.
has_reference_style_links() {
  local file="$1"
  [ -f "$file" ] || return 1
  local content
  content=$(strip_fenced_blocks "$file")
  grep -qE '\]\[[^][]*\]' <<< "$content" && return 0
  grep -qE '^[[:space:]]{0,3}\[[^][]+\]:[[:space:]]*[^[:space:]]' <<< "$content" && return 0
  return 1
}

# md_link_targets <markdown-file> — extracts the targets of inline
# `](target)` Markdown links, one per line, after stripping fenced code
# blocks (WR-02). Strips an optional trailing " title" and/or #anchor from
# each captured target before filtering (WR-01). Keeps only targets ending
# in `.md` and not containing `://` (external links are out of scope for a
# root-doc reachability gate). Prints nothing when the file has no
# qualifying links — callers must not treat an empty result as success.
# Reference-style links are out of scope here entirely — see
# has_reference_style_links and the header comment.
md_link_targets() {
  local file="$1"
  [ -f "$file" ] || return 0
  strip_fenced_blocks "$file" \
    | grep -oE '\]\([^)]+\)' \
    | sed -E 's/^\]\(//; s/\)$//' \
    | sed -E 's/[[:space:]]+"[^"]*"$//' \
    | sed -E 's/#[^#]*$//' \
    | grep -E '\.md$' \
    | grep -v '://' \
    || true
}

# links_resolve <markdown-file> <base-dir> — returns 0 only when
# md_link_targets finds at least one target AND every target resolves to a
# real, existing regular file under <base-dir>. An empty target list
# returns 1: an extractor that found nothing must not report green — that
# is the same failure this repository has already paid for twice. A file
# using reference-style links is rejected loudly, with a named diagnostic
# on stderr, before extraction even runs (WR-03) — never silently folded
# into the empty-target-list case.
links_resolve() {
  local file="$1"
  local base_dir="$2"
  if has_reference_style_links "$file"; then
    echo "links_resolve: $file uses reference-style Markdown links ([text][ref] / [ref]: target) — this extractor only supports inline ](target) links, treating as unresolved" >&2
    return 1
  fi
  local targets
  targets=$(md_link_targets "$file")
  if [ -z "$targets" ]; then
    return 1
  fi
  local target
  while IFS= read -r target; do
    [ -z "$target" ] && continue
    if [ ! -f "$base_dir/$target" ]; then
      return 1
    fi
  done <<< "$targets"
  return 0
}

# self_check — the positive control. Builds fixtures in a mktemp -d (no
# tracked fixture files, following verify-sw.sh's self_check pattern) and
# asserts links_resolve's verdict on each:
#
#   fixture A — links to a real .md file created in the same temp dir.
#               Must be ACCEPTED (links_resolve returns 0).
#   fixture B — links to a deliberately-not-created .md filename.
#               Must be REJECTED (links_resolve returns 1).
#   fixture C — prose with no Markdown links at all.
#               Must be REJECTED (links_resolve returns 1). This is the
#               fixture that isolates the "empty list" branch: an extractor
#               that silently reports success on zero links is exactly the
#               failure mode this gate exists to catch.
#   fixture D — a titled link, `[t](target.md "Some title")`, to a real
#               target. Must be ACCEPTED. Isolates WR-01's title-stripping
#               branch: without it the captured target is
#               `target.md "Some title"`, fails the `.md$` filter, and the
#               file is wrongly treated as having zero real links.
#   fixture E — an anchored link, `[t](target.md#some-section)`, to a real
#               target. Must be ACCEPTED. Isolates WR-01's anchor-stripping
#               branch the same way fixture D isolates the title branch.
#   fixture F — a fenced ```markdown``` block containing a link-like line
#               pointing at a filename (target.md) that DOES exist on
#               disk, with no real link outside the fence. Must be
#               REJECTED (zero real links). Isolates WR-02's
#               fence-stripping branch: without it, the fenced text is
#               extracted, its target happens to exist on disk, and the
#               file is wrongly ACCEPTED even though it has no real link.
#   fixture G — a reference-style link (`[t][ref]` / `[ref]: target.md`)
#               to a real target. Must be REJECTED, and specifically via
#               the loud has_reference_style_links diagnostic on stderr,
#               not via the silent empty-target-list path — isolates
#               WR-03's detection branch from the ordinary "zero links"
#               case, which would otherwise return the same exit code for
#               the wrong reason.
self_check() {
  local tmp
  tmp=$(mktemp -d) || {
    echo "self_check: mktemp -d failed" >&2
    return 1
  }
  trap 'rm -rf "$tmp"' RETURN

  local target_doc="$tmp/target.md"
  local fixture_a="$tmp/fixture-a.md"
  local fixture_b="$tmp/fixture-b.md"
  local fixture_c="$tmp/fixture-c.md"
  local fixture_d="$tmp/fixture-d.md"
  local fixture_e="$tmp/fixture-e.md"
  local fixture_f="$tmp/fixture-f.md"
  local fixture_g="$tmp/fixture-g.md"

  printf '# Target\n\nThis file exists.\n' > "$target_doc"
  printf '# Fixture A\n\nSee [the target](target.md) for details.\n' > "$fixture_a"
  printf '# Fixture B\n\nSee [a target that does not exist](does-not-exist.md) for details.\n' > "$fixture_b"
  printf '# Fixture C\n\nThis page has no Markdown links at all, just prose.\n' > "$fixture_c"
  printf '# Fixture D\n\nSee [the target](target.md "Target page") for details.\n' > "$fixture_d"
  printf '# Fixture E\n\nSee [the target](target.md#some-section) for details.\n' > "$fixture_e"
  printf '# Fixture F\n\nExample only, not a real link:\n\n```markdown\n[t](target.md)\n```\n\nNo real links in this file.\n' > "$fixture_f"
  printf '# Fixture G\n\nSee [the target][ref] for details.\n\n[ref]: target.md\n' > "$fixture_g"

  local a_result b_result c_result d_result e_result f_result g_result g_stderr
  links_resolve "$fixture_a" "$tmp"; a_result=$?
  links_resolve "$fixture_b" "$tmp"; b_result=$?
  links_resolve "$fixture_c" "$tmp"; c_result=$?
  links_resolve "$fixture_d" "$tmp"; d_result=$?
  links_resolve "$fixture_e" "$tmp"; e_result=$?
  links_resolve "$fixture_f" "$tmp"; f_result=$?
  g_stderr=$(links_resolve "$fixture_g" "$tmp" 2>&1); g_result=$?

  if [ "$a_result" -eq 0 ] && [ "$b_result" -eq 1 ] && [ "$c_result" -eq 1 ] \
    && [ "$d_result" -eq 0 ] && [ "$e_result" -eq 0 ] && [ "$f_result" -eq 1 ] \
    && [ "$g_result" -eq 1 ] && grep -qF 'reference-style' <<< "$g_stderr"; then
    return 0
  fi
  if [ "$a_result" -ne 0 ]; then
    echo "self_check: fixture A (real target) was NOT accepted (expected accept)" >&2
  fi
  if [ "$b_result" -ne 1 ]; then
    echo "self_check: fixture B (missing target) was NOT rejected (expected reject)" >&2
  fi
  if [ "$c_result" -ne 1 ]; then
    echo "self_check: fixture C (zero links) was NOT rejected (expected reject) — empty-list branch is not discriminating" >&2
  fi
  if [ "$d_result" -ne 0 ]; then
    echo "self_check: fixture D (titled link to real target) was NOT accepted (expected accept) — WR-01 title-stripping regression" >&2
  fi
  if [ "$e_result" -ne 0 ]; then
    echo "self_check: fixture E (anchored link to real target) was NOT accepted (expected accept) — WR-01 anchor-stripping regression" >&2
  fi
  if [ "$f_result" -ne 1 ]; then
    echo "self_check: fixture F (fenced link-like text) was NOT rejected (expected reject) — WR-02 fence-stripping regression" >&2
  fi
  if [ "$g_result" -ne 1 ] || ! grep -qF 'reference-style' <<< "$g_stderr"; then
    echo "self_check: fixture G (reference-style link) was NOT rejected with the reference-style diagnostic (expected a loud, named failure) — WR-03 detection regression" >&2
  fi
  return 1
}

# 1 — CACHING.md exists at the repository root.
if [ -f "$ROOT/CACHING.md" ]; then
  record "1 CACHING.md 在仓库根目录存在" "$ROOT/CACHING.md" 0
else
  record "1 CACHING.md 在仓库根目录存在" "$ROOT/CACHING.md" 1
fi

# 2 — README.md's Markdown links (the ones this gate cares about) all
# resolve to real files.
if links_resolve "$ROOT/README.md" "$ROOT"; then
  record "2 README.md 的 .md 链接目标均可解析" "$ROOT/README.md" 0
else
  record "2 README.md 的 .md 链接目标均可解析" "$ROOT/README.md" 1
fi

# 3 — README.md specifically links to CACHING.md. Catches a rename that
# orphans the pointer even if some other unrelated .md link still resolves.
readme_targets=$(md_link_targets "$ROOT/README.md")
if grep -qx 'CACHING.md' <<< "$readme_targets"; then
  record "3 README.md 含指向 CACHING.md 的链接" "target=CACHING.md" 0
else
  record "3 README.md 含指向 CACHING.md 的链接" "targets=[${readme_targets:-<空>}]" 1
fi

# 4 — self_check, the positive control. All seven fixture verdicts (plain
# link, missing target, zero links, titled link, anchored link, fenced
# link-like text, reference-style link) must be right or the item is FAIL.
if self_check; then
  record "4 自检（7 个 fixture 均判定正确，含标题/锚点/代码块/引用式链接）" "全部通过" 0
else
  record "4 自检（7 个 fixture 均判定正确，含标题/锚点/代码块/引用式链接）" "fixture 判定有误，见上方 stderr" 1
fi

echo
if [ "$status" -eq 0 ]; then
  echo "全部通过"
else
  echo "存在 FAIL，见上方"
fi
exit "$status"
