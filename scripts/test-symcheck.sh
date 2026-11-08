#!/usr/bin/env bash
# Regression test for symcheck.py. Compiles the fixture under
# scripts/fixtures/symcheck/ into a framework JAR, a "trimmed" framework JAR
# (one interface method removed) and a module JAR, then runs the real
# symcheck.py against both framework JARs. Needs a JDK (javac, jar, javap).
#
#   full    : exit 0, nothing missing. The module calls java.lang.Object
#             methods through framework interfaces and classes; symcheck.py
#             once reported those (e.g. Operator.getClass) as missing.
#   trimmed : exit 1, exactly one missing member, Operator.removable. This is
#             the control that the Object fallback does not hide a real miss.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIX="$ROOT/scripts/fixtures/symcheck"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/fw-src" "$WORK/fw" "$WORK/fw-trim" "$WORK/mod"
cp -R "$FIX/fw/." "$WORK/fw-src/"
javac --release 8 -nowarn -d "$WORK/fw" $(find "$WORK/fw-src" -name '*.java')
jar cf "$WORK/fw.jar" -C "$WORK/fw" .

grep -v 'REMOVABLE' "$FIX/fw/com/ultikits/ultitools/interfaces/Operator.java" \
  > "$WORK/fw-src/com/ultikits/ultitools/interfaces/Operator.java"
javac --release 8 -nowarn -d "$WORK/fw-trim" $(find "$WORK/fw-src" -name '*.java')
jar cf "$WORK/fw-trim.jar" -C "$WORK/fw-trim" .

javac --release 8 -nowarn -cp "$WORK/fw" -d "$WORK/mod" $(find "$FIX/module" -name '*.java')
jar cf "$WORK/mod.jar" -C "$WORK/mod" .

status=0

set +e
full_out=$(python3 "$ROOT/scripts/symcheck.py" "$WORK/mod.jar" "$WORK/fw.jar" 2>&1)
full_exit=$?
trim_out=$(python3 "$ROOT/scripts/symcheck.py" "$WORK/mod.jar" "$WORK/fw-trim.jar" 2>&1)
trim_exit=$?
set -e

if [ "$full_exit" = "0" ]; then
  echo "PASS full: exit 0, no Object method reported missing"
else
  echo "FAIL full: exit $full_exit, expected 0"
  printf '%s\n' "$full_out"
  status=1
fi

missing=$(printf '%s\n' "$trim_out" | grep -c 'missing member' || true)
if [ "$trim_exit" = "1" ] && [ "$missing" = "1" ] \
   && printf '%s\n' "$trim_out" | grep -q 'Operator.removable:()V'; then
  echo "PASS trimmed: exit 1, exactly Operator.removable reported"
else
  echo "FAIL trimmed: exit $trim_exit with $missing missing members, expected exit 1 with only Operator.removable"
  printf '%s\n' "$trim_out"
  status=1
fi

exit "$status"
