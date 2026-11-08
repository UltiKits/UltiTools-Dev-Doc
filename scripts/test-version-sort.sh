#!/usr/bin/env bash
# Regression test: version names must sort numerically (v6.10.0 after v6.2.5),
# with a -SNAPSHOT label just before its release. Runs the real
# generate-version-pages.mjs in a fixture tree and checks KNOWN_VERSIONS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/scripts" "$WORK/.vitepress/config" "$WORK/docs/src"
cp "$ROOT"/scripts/generate-version-pages.mjs "$WORK/scripts/"
cp "$ROOT"/scripts/version-compare.mjs "$WORK/scripts/" 
echo "  current: 'v6.10.0'," > "$WORK/.vitepress/config.mts"
echo "# x" > "$WORK/docs/src/index.md"
for v in v6.2.5 v6.10.0 v6.3.2 v6.4.0 v6.4.0-SNAPSHOT v6.1.0; do
  mkdir -p "$WORK/docs/archive/$v"
done

(cd "$WORK" && node scripts/generate-version-pages.mjs)

actual=$(sed -n 's/^export const KNOWN_VERSIONS = //p' "$WORK/.vitepress/config/version-pages.generated.mjs" | tr -d ';')
expected='["v6.1.0","v6.2.5","v6.3.2","v6.4.0-SNAPSHOT","v6.4.0","v6.10.0"]'
if [ "$actual" = "$expected" ]; then
  echo "PASS: KNOWN_VERSIONS sorted numerically"
else
  echo "FAIL: KNOWN_VERSIONS"
  echo "  expected: $expected"
  echo "  actual:   $actual"
  exit 1
fi
