#!/usr/bin/env bash
# End-to-end test harness for check-version-consistency.sh's exit-code tiers
# and $GITHUB_OUTPUT contract (02-01-PLAN.md Task 1). This does NOT reimplement
# any of the script's parsing/comparison logic — every case runs the real
# scripts/check-version-consistency.sh in an isolated fixture tree and asserts
# on its exit code and written outputs. Duplicating the logic here would just
# create a second copy that could silently drift from the thing it's supposed
# to be testing.
#
# Output style mirrors check-bilingual-parity.sh: one PASS/FAIL line per case,
# a single status variable collected across all cases, one exit at the end.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/check-version-consistency.sh"

status=0
skipped=""

# ─────────────────────────────────────────────────────────────────────────────
# Fixture helpers
# ─────────────────────────────────────────────────────────────────────────────

# Builds a temp tree shaped like the real repo root (only the three paths the
# script actually touches: scripts/, .vitepress/config.mts, examples/pom.xml),
# with the real script copied in. The script locates its root via
# `ROOT="$(cd "$(dirname "$0")/.." && pwd)"`, so copying it into
# <tmp>/scripts/check-version-consistency.sh makes ROOT resolve to <tmp> —
# no path-rewriting needed.
make_fixture() {
  local dir doc_ver="$1" pom_ver="$2"
  dir=$(mktemp -d)
  mkdir -p "$dir/scripts" "$dir/.vitepress" "$dir/examples"
  cp "$SCRIPT" "$dir/scripts/check-version-consistency.sh"
  chmod +x "$dir/scripts/check-version-consistency.sh"
  if [ -n "$doc_ver" ]; then
    echo "  current: 'v${doc_ver}'," > "$dir/.vitepress/config.mts"
  else
    echo "  current: 'not-a-version'," > "$dir/.vitepress/config.mts"
  fi
  if [ -n "$pom_ver" ]; then
    echo "<ultitools.version>${pom_ver}</ultitools.version>" > "$dir/examples/pom.xml"
  else
    echo "<ultitools.version>not-a-version</ultitools.version>" > "$dir/examples/pom.xml"
  fi
  printf '%s' "$dir"
}

# Builds a PATH with `gh` genuinely unreachable — checked by looking for an
# executable named `gh` in every PATH directory, not just the one directory
# `command -v gh` happened to report first. On a merged-/usr system (Ubuntu,
# and GitHub Actions' ubuntu-latest runners are merged-/usr too) `/bin` is a
# symlink to `/usr/bin`, and a typical PATH lists both; stripping only the
# one directory `command -v gh` resolves to leaves `gh` reachable via its
# sibling entry — `command -v gh` still finds it, just under the other name.
#
# A directory that contains `gh` can't simply be dropped from PATH wholesale
# though: on the same merged-/usr systems this is guarding against, that
# directory is also where core utilities the target script itself needs
# (grep, curl, sort, ...) live — dropping it takes those with it and the
# script under test fails for an unrelated reason (rc 127, command not
# found) before it ever reaches its own `command -v gh` check. So instead,
# for each PATH directory that contains `gh`, this rebuilds it as a shim
# directory of symlinks to every entry EXCEPT `gh`, and substitutes that shim
# in PATH in the same position — every other tool in that directory stays
# reachable, only `gh` itself is genuinely gone. Non-`gh` directories pass
# through unchanged. Cached per-run since PATH doesn't change between cases.
_GH_SHIM_PATH=""
strip_gh_from_path() {
  if [ -n "$_GH_SHIM_PATH" ]; then
    printf '%s' "$_GH_SHIM_PATH"
    return 0
  fi
  local p result="" shim_root=""
  IFS=':' read -ra _psplit <<< "$PATH"
  for p in "${_psplit[@]}"; do
    [ -z "$p" ] && continue
    if [ -x "$p/gh" ]; then
      [ -z "$shim_root" ] && shim_root=$(mktemp -d)
      local shim_dir entry base
      shim_dir="$shim_root/$(printf '%s' "$p" | tr '/' '_')"
      mkdir -p "$shim_dir"
      for entry in "$p"/*; do
        [ -e "$entry" ] || continue
        base=$(basename "$entry")
        [ "$base" = "gh" ] && continue
        ln -s "$entry" "$shim_dir/$base" 2>/dev/null || true
      done
      result="${result:+$result:}$shim_dir"
    else
      result="${result:+$result:}$p"
    fi
  done
  _GH_SHIM_PATH="$result"
  printf '%s' "$result"
}

# Runs the fixture's copy of the script with `gh` removed from PATH, so it
# always takes the early-return branch (script lines ~90-96) instead of
# making 19 `gh api` calls per case. This also happens to exercise exactly
# the exit path RESEARCH Anti-Pattern 1 warns about — output must be written
# before this early `exit`, not just before the script's final exit.
#
# Note: the script's tail exit (its very last line) is NOT covered by this
# harness — it shares the same write-before-exit point as the early-return
# path this harness does cover, so covering one covers the property for both.
run_without_gh() {
  local dir="$1" out_file="$2"
  shift 2
  local filtered_path
  filtered_path=$(strip_gh_from_path)
  set +e
  ( cd "$dir" && PATH="$filtered_path" GITHUB_OUTPUT="$out_file" "$@" "./scripts/check-version-consistency.sh" >/dev/null 2>&1 )
  local rc=$?
  set -e
  return $rc
}

get_output_value() {
  local out_file="$1" key="$2"
  grep -E "^${key}=" "$out_file" 2>/dev/null | tail -1 | cut -d= -f2-
}

report() {
  local name="$1" ok="$2" detail="$3"
  if [ "$ok" = "0" ]; then
    echo "  PASS: $name"
  else
    echo "  FAIL: $name — $detail"
    status=1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Case A: unresolvable version → exit 2, kind=unknown, doc_ver empty
# ─────────────────────────────────────────────────────────────────────────────

run_case_a() {
  local dir out_file rc
  dir=$(make_fixture "" "6.2.4")
  out_file=$(mktemp)
  rc=0
  run_without_gh "$dir" "$out_file" || rc=$?
  local kind doc_ver
  kind=$(get_output_value "$out_file" kind)
  doc_ver=$(get_output_value "$out_file" doc_ver)
  local ok=0
  [ "$rc" = "2" ] || { ok=1; }
  [ "$kind" = "unknown" ] || { ok=1; }
  [ -z "$doc_ver" ] || { ok=1; }
  report "A_exit2_unknown" "$ok" "rc=$rc kind=$kind doc_ver=$doc_ver (want rc=2 kind=unknown doc_ver=empty)"
  rm -rf "$dir" "$out_file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case B: both versions pinned below the real Central release → exit 1, behind
# ─────────────────────────────────────────────────────────────────────────────

run_case_b() {
  local central="$1"
  local dir out_file rc
  dir=$(make_fixture "6.2.4" "6.2.4")
  out_file=$(mktemp)
  rc=0
  run_without_gh "$dir" "$out_file" || rc=$?
  local kind doc_ver pom_ver
  kind=$(get_output_value "$out_file" kind)
  doc_ver=$(get_output_value "$out_file" doc_ver)
  pom_ver=$(get_output_value "$out_file" pom_ver)
  local ok=0
  [ "$rc" = "1" ] || { ok=1; }
  [ "$kind" = "behind" ] || { ok=1; }
  [ "$doc_ver" = "6.2.4" ] || { ok=1; }
  [ "$pom_ver" = "6.2.4" ] || { ok=1; }
  report "B_exit1_behind" "$ok" "rc=$rc kind=$kind doc_ver=$doc_ver pom_ver=$pom_ver (want rc=1 kind=behind doc_ver=pom_ver=6.2.4, central=$central)"
  rm -rf "$dir" "$out_file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case F: two-digit PATCH regression guard (02-02 Task 1's red case).
#
# The fixture used to be hardcoded at 6.2.10 against whatever the real
# Central release happened to be. That only worked while Central's real
# <release> stayed below 6.2.10 — once Central reaches 6.2.10 the three
# values become equal (rc=0, not 1) and past it the shape flips to "behind"
# (rc=1, kind=behind) — either way the fixed `kind=ahead` assertion goes red
# on a date that has nothing to do with a real regression in this script.
#
# So the fixture is derived from the real fetched `central` value instead:
# `segment_is_trap_usable`/`lex_trap_value` (below) construct a segment one
# digit longer than the corresponding central segment, leading with '1' and
# zero-filled after — e.g. central patch "5" -> trap "10", central patch
# "25" -> trap "100". This is always both (a) numerically greater than the
# original segment (an N+1-digit number is always greater than any N-digit
# number) and (b) lexicographically LESS than it as a plain string, UNLESS
# the original segment's own string is already the minimal representative of
# its digit-length class — i.e. "0", or "1" followed only by zeros (1, 10,
# 100, ...; proof: no string representing an integer greater than 10^k can
# be a lexicographic prefix-match-then-undercut of "1" + k zeros, since every
# digit in "1"+zeros is already at its minimum for a valid, non-leading-zero
# representation). `segment_is_trap_usable` rejects exactly those inputs, and
# the case cascades from patch to minor to major until it finds a segment the
# trap can be built on — which also means the case still goes red if
# `version_lt` were reverted to lexicographic string comparison, the actual
# regression RESEARCH Pitfall 3 describes, regardless of what Central's real
# release happens to be on the day this runs.
# ─────────────────────────────────────────────────────────────────────────────

# True (rc 0) iff `s` (a decimal integer segment, no leading zeros) can host
# the two-digit trap described above — false only for "0" and pure powers of
# ten ("1", "10", "100", ...), where the segment's digits are already at
# their minimum for that digit length and cannot be undercut.
segment_is_trap_usable() {
  local s="$1"
  [ "$s" = "0" ] && return 1
  printf '%s' "$s" | grep -qE '^10*$' && return 1
  return 0
}

# Given a usable segment string, returns the smallest trap value: one digit
# longer, leading '1', the rest zeros (i.e. 10^len(s)).
lex_trap_value() {
  local s="$1" len zeros=""
  len=${#s}
  local i=0
  while [ "$i" -lt "$len" ]; do zeros="${zeros}0"; i=$((i + 1)); done
  printf '1%s' "$zeros"
}

run_case_f() {
  local central="$1"
  local c_major c_minor c_patch
  IFS='.' read -r c_major c_minor c_patch <<< "$central"

  local fixture_major="$c_major" fixture_minor="$c_minor" fixture_patch="$c_patch" trap_segment
  if segment_is_trap_usable "$c_patch"; then
    fixture_patch=$(lex_trap_value "$c_patch")
    trap_segment="patch"
  elif segment_is_trap_usable "$c_minor"; then
    fixture_minor=$(lex_trap_value "$c_minor")
    trap_segment="minor"
  elif segment_is_trap_usable "$c_major"; then
    fixture_major=$(lex_trap_value "$c_major")
    trap_segment="major"
  else
    # No segment can host the trap: patch, minor, and major are all "0" or a
    # pure power of ten (e.g. central "1.0.0"). Applying lex_trap_value to
    # the major segment unconditionally here (the prior behavior) would
    # silently build a fixture like "10.0.0", which both a correct numeric
    # compare AND a reverted lexicographic compare classify as "ahead" —
    # the case would pass either way, so a version_lt regression at exactly
    # this boundary would go undetected while the case still reports green.
    # Reporting a SKIP (and failing the run, same as the network-unreachable
    # path below) keeps that hole visible instead of quietly waving it
    # through. Not expected to trigger against a real Maven Central release
    # for this project (currently 6.2.5), since that would require Central's
    # <release> itself to be something like "1.0.0".
    echo "  SKIP: F_two_digit_patch (central=$central has no trap-usable segment — major, minor, and patch are all \"0\" or a power of ten; the regression guard cannot be constructed for this input)"
    skipped="${skipped:+$skipped }F_two_digit_patch"
    status=1
    return 0
  fi
  local fixture_ver="${fixture_major}.${fixture_minor}.${fixture_patch}"

  local dir out_file rc
  dir=$(make_fixture "$fixture_ver" "$fixture_ver")
  out_file=$(mktemp)
  rc=0
  run_without_gh "$dir" "$out_file" || rc=$?
  local kind
  kind=$(get_output_value "$out_file" kind)
  local ok=0
  [ "$rc" = "1" ] || { ok=1; }
  [ "$kind" = "ahead" ] || { ok=1; }
  report "F_two_digit_patch" "$ok" "rc=$rc kind=$kind (want rc=1 kind=ahead; fixture=doc=pom=$fixture_ver > central=$central, trap built on the $trap_segment segment — a lexicographic-compare bug would report kind=behind or mismatch instead)"
  rm -rf "$dir" "$out_file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case G: internal mismatch — config.mts and pom.xml disagree with each other.
# Guards judgment ORDER: `doc != pom` must be checked before the direction
# comparison, or "changed one file but forgot the other" gets misreported as
# a direction problem (behind/ahead) instead of what it actually is.
# ─────────────────────────────────────────────────────────────────────────────

run_case_g() {
  local dir out_file rc
  dir=$(make_fixture "6.2.5" "6.2.4")
  out_file=$(mktemp)
  rc=0
  run_without_gh "$dir" "$out_file" || rc=$?
  local kind doc_ver pom_ver
  kind=$(get_output_value "$out_file" kind)
  doc_ver=$(get_output_value "$out_file" doc_ver)
  pom_ver=$(get_output_value "$out_file" pom_ver)
  local ok=0
  [ "$rc" = "1" ] || { ok=1; }
  [ "$kind" = "mismatch" ] || { ok=1; }
  [ "$doc_ver" = "6.2.5" ] || { ok=1; }
  [ "$pom_ver" = "6.2.4" ] || { ok=1; }
  report "G_mismatch" "$ok" "rc=$rc kind=$kind doc_ver=$doc_ver pom_ver=$pom_ver (want rc=1 kind=mismatch doc_ver=6.2.5 pom_ver=6.2.4)"
  rm -rf "$dir" "$out_file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case C: both versions match the real Central release → exit 0, kind empty
# ─────────────────────────────────────────────────────────────────────────────

run_case_c() {
  local central="$1"
  local dir out_file rc
  dir=$(make_fixture "$central" "$central")
  out_file=$(mktemp)
  rc=0
  run_without_gh "$dir" "$out_file" || rc=$?
  local kind
  kind=$(get_output_value "$out_file" kind)
  local ok=0
  [ "$rc" = "0" ] || { ok=1; }
  [ -z "$kind" ] || { ok=1; }
  report "C_exit0_ok" "$ok" "rc=$rc kind=$kind (want rc=0 kind=empty, central=$central)"
  rm -rf "$dir" "$out_file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case D: output file has all four keys before both failing exits
# (RESEARCH Anti-Pattern 1: output written after exit is never readable)
# ─────────────────────────────────────────────────────────────────────────────

run_case_d() {
  local ok=0

  local dir_a out_a
  dir_a=$(make_fixture "" "6.2.4")
  out_a=$(mktemp)
  run_without_gh "$dir_a" "$out_a" || true
  if [ ! -s "$out_a" ]; then
    ok=1
  else
    for key in doc_ver pom_ver central_ver kind; do
      grep -q "^${key}=" "$out_a" || ok=1
    done
  fi
  rm -rf "$dir_a" "$out_a"

  local dir_b out_b
  dir_b=$(make_fixture "6.2.4" "6.2.4")
  out_b=$(mktemp)
  run_without_gh "$dir_b" "$out_b" || true
  if [ ! -s "$out_b" ]; then
    ok=1
  else
    for key in doc_ver pom_ver central_ver kind; do
      grep -q "^${key}=" "$out_b" || ok=1
    done
  fi
  rm -rf "$dir_b" "$out_b"

  report "D_output_before_exit" "$ok" "both failing fixtures must produce a \$GITHUB_OUTPUT file with all four keys present"
}

# ─────────────────────────────────────────────────────────────────────────────
# Case E: GITHUB_OUTPUT unset → script does not error under set -u, same rc
# ─────────────────────────────────────────────────────────────────────────────

run_case_e() {
  local dir rc_with rc_without
  dir=$(make_fixture "6.2.4" "6.2.4")
  local out_file
  out_file=$(mktemp)
  rc_with=0
  run_without_gh "$dir" "$out_file" || rc_with=$?

  local filtered_path
  filtered_path=$(strip_gh_from_path)
  set +e
  ( cd "$dir" && PATH="$filtered_path" env -u GITHUB_OUTPUT "./scripts/check-version-consistency.sh" >/dev/null 2>&1 )
  rc_without=$?
  set -e

  local ok=0
  [ "$rc_with" = "$rc_without" ] || { ok=1; }
  report "E_no_github_output" "$ok" "rc_with_output=$rc_with rc_without_output=$rc_without (want equal, want no error from set -u)"
  rm -rf "$dir" "$out_file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Network-dependent setup for B/C: fetch the real Central release once.
# A/D/E never touch the network and always run.
# ─────────────────────────────────────────────────────────────────────────────

echo "test-version-signal: probing Maven Central for the real <release> value"
real_central=$(curl -sfL --connect-timeout 10 --max-time 30 \
  https://repo1.maven.org/maven2/com/ultikits/UltiTools-API/maven-metadata.xml 2>/dev/null \
  | grep -oE '<release>[^<]+</release>' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true

echo
run_case_a
run_case_d
run_case_e

if [ -n "$real_central" ]; then
  run_case_b "$real_central"
  run_case_c "$real_central"
  run_case_f "$real_central"
  run_case_g
else
  echo "  SKIP: B_exit1_behind (Maven Central unreachable)"
  echo "  SKIP: C_exit0_ok (Maven Central unreachable)"
  echo "  SKIP: F_two_digit_patch (Maven Central unreachable)"
  echo "  SKIP: G_mismatch (Maven Central unreachable)"
  skipped="B_exit1_behind C_exit0_ok F_two_digit_patch G_mismatch"
  status=1
fi

echo
if [ -n "$skipped" ]; then
  echo "SKIPPED (network unavailable, does not count as passed):$skipped"
fi
if [ "$status" = "0" ]; then
  echo "test-version-signal: all cases PASS"
else
  echo "test-version-signal: FAILED (see above)"
fi

exit "$status"
