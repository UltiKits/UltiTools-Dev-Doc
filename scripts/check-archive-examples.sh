#!/usr/bin/env bash
# Archive example freeze guard (maintainer decision 2026-10-07, "Dev-Doc archive freezing before 6.3.0").
# 归档示例冻结门禁。
#
# An archived page under docs/archive/ must show the code it showed when it was archived. A page that
# includes `<<< @/../examples/...` shows whatever examples/ holds today, so every later change to an
# example silently rewrites an archived page, and a deleted or renamed example breaks the archive's
# build. Archived pages therefore include the frozen copy under examples-archive/<version>/ instead.
# docs/archive/ 下的页面必须引用 examples-archive/<版本>/ 下的冻结副本，不能引用会随发版变化的 examples/。
#
# Checks, over every .md file under <root>/docs/archive:
#   1. LIVE        a `<<< @/../examples/` reference (the live folder). The trailing slash matters:
#                  examples-archive/ and examples-snapshot/ are different folders and are not matched.
#   2. UNRESOLVED  a `<<< @/../examples-archive/<path>` reference whose file is not under
#                  <root>/examples-archive/. VitePress turns a missing snippet file into an uncaught
#                  ENOENT that kills the whole build, so it is named here with its file and line.
# Exit 0: none of either. Exit 1: at least one, each printed as `file:line  LIVE|UNRESOLVED  reference`.
# Exit 2: no markdown file found under docs/archive (a guard that read nothing must not pass).
#
# Capability boundary: only the `<<<` snippet-include syntax is checked, not a live path written in prose
# or inside a code block, and not the content of the frozen files. docs/archive/v*-SNAPSHOT/ is generated
# at build time by inject-alpha.mjs (gitignored) and includes examples-snapshot/, which is also not matched.
#
# Usage: bash scripts/check-archive-examples.sh [root]      (root defaults to the repository root)
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
ARCHIVE="$ROOT/docs/archive"
if [ ! -d "$ARCHIVE" ]; then
  echo "check-archive-examples.sh: $ARCHIVE does not exist, refusing to pass" >&2
  exit 2
fi
files=$(find "$ARCHIVE" -name '*.md' -type f | wc -l)
if [ "$files" -eq 0 ]; then
  echo "check-archive-examples.sh: no .md file under $ARCHIVE, refusing to pass" >&2
  exit 2
fi
found=0
# CRLF pages: tr removes the CR so a reference's path never carries one.
while IFS= read -r -d '' f; do
  while IFS=: read -r line text; do
    [ -z "$line" ] && continue
    rel="${f#"$ROOT"/}"
    case "$text" in
      *'@/../examples/'*)
        printf '%s:%s  LIVE  %s\n' "$rel" "$line" "$text"
        found=1
        ;;
      *'@/../examples-archive/'*)
        path="${text#*@/../examples-archive/}"
        path="${path%%[ {#]*}"
        if [ ! -f "$ROOT/examples-archive/$path" ]; then
          printf '%s:%s  UNRESOLVED  %s\n' "$rel" "$line" "$text"
          found=1
        fi
        ;;
    esac
  done < <(tr -d '\r' < "$f" | grep -nE '^[[:space:]]*<<<[[:space:]]*@/\.\./examples(-archive)?/')
done < <(find "$ARCHIVE" -name '*.md' -type f -print0)
if [ "$found" -eq 0 ]; then
  echo "check-archive-examples.sh: $files archived pages checked, no live or unresolved example reference"
fi
exit "$found"
