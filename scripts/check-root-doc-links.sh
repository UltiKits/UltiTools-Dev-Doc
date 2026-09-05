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

# md_link_targets <markdown-file> — extracts the targets of inline
# `](target)` Markdown links, one per line. Keeps only targets ending in
# `.md` and not containing `://` (external links are out of scope for a
# root-doc reachability gate). Prints nothing when the file has no
# qualifying links — callers must not treat an empty result as success.
md_link_targets() {
  local file="$1"
  [ -f "$file" ] || return 0
  grep -oE '\]\([^)]+\)' "$file" 2>/dev/null \
    | sed -E 's/^\]\(//; s/\)$//' \
    | grep -E '\.md$' \
    | grep -v '://' \
    || true
}

# links_resolve <markdown-file> <base-dir> — returns 0 only when
# md_link_targets finds at least one target AND every target resolves to a
# real, existing regular file under <base-dir>. An empty target list
# returns 1: an extractor that found nothing must not report green — that
# is the same failure this repository has already paid for twice.
links_resolve() {
  local file="$1"
  local base_dir="$2"
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

# self_check — the positive control. Builds three fixtures in a mktemp -d
# (no tracked fixture files, following verify-sw.sh's self_check pattern)
# and asserts links_resolve's verdict on each:
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
self_check() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  local target_doc="$tmp/target.md"
  local fixture_a="$tmp/fixture-a.md"
  local fixture_b="$tmp/fixture-b.md"
  local fixture_c="$tmp/fixture-c.md"

  printf '# Target\n\nThis file exists.\n' > "$target_doc"
  printf '# Fixture A\n\nSee [the target](target.md) for details.\n' > "$fixture_a"
  printf '# Fixture B\n\nSee [a target that does not exist](does-not-exist.md) for details.\n' > "$fixture_b"
  printf '# Fixture C\n\nThis page has no Markdown links at all, just prose.\n' > "$fixture_c"

  local a_result=1 b_result=0 c_result=0
  links_resolve "$fixture_a" "$tmp"; a_result=$?
  links_resolve "$fixture_b" "$tmp"; b_result=$?
  links_resolve "$fixture_c" "$tmp"; c_result=$?

  if [ "$a_result" -eq 0 ] && [ "$b_result" -eq 1 ] && [ "$c_result" -eq 1 ]; then
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

# 4 — self_check, the positive control. All three fixture verdicts must be
# right (including fixture C, which isolates the empty-link-list branch)
# or the item is FAIL.
if self_check; then
  record "4 自检（拒绝『目标不存在』与『零链接』，接受『目标存在』）" "三个 fixture 均判定正确" 0
else
  record "4 自检（拒绝『目标不存在』与『零链接』，接受『目标存在』）" "fixture 判定有误，见上方 stderr" 1
fi

echo
if [ "$status" -eq 0 ]; then
  echo "全部通过"
else
  echo "存在 FAIL，见上方"
fi
exit "$status"
