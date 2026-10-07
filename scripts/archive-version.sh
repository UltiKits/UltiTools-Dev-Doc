#!/usr/bin/env bash
# Cut a documentation archive and freeze the examples it includes, in one step.
# 发版归档：复制 docs/src 到 docs/archive/<版本>/，同一步把它引用的示例冻结到 examples-archive/<版本>/。
#
# Why one step: archived pages include code with `<<< @/../examples/...`. examples/ moves on with every
# release, so an archive that keeps pointing at it changes after it is cut (measured on v6.2.4: 11 of the
# 78 files it includes had changed by the time v6.2.5 was released). This script copies each referenced
# example into examples-archive/<version>/ and rewrites the archived pages to include that copy, and
# scripts/check-archive-examples.sh (docs-ci job `archive-examples`) fails any archive that does not.
#
# What it does, for <version> such as v6.2.5 (the release being archived, i.e. the previous one):
#   1. copies docs/src/{guide,zh,api,index.md} to docs/archive/<version>/ (whichever exist)
#   2. copies every examples/<path> those pages include to examples-archive/<version>/<path>
#   3. rewrites `<<< @/../examples/` to `<<< @/../examples-archive/<version>/` in the copied pages
#   4. runs scripts/check-archive-examples.sh
# Run it BEFORE the three-way version bump (versionsConfig.current, examples/pom.xml, examples sources), so
# examples/ still holds the code the pages were written against. If it must run later, name the commit that
# archived the version: EXAMPLES_REF=<commit> bash scripts/archive-version.sh v6.2.5
#
# It does not touch .vitepress/config*, the sidebar constants or examples/pom.xml: those remain the manual
# steps of the release procedure (CONTRIBUTING.md, "发版归档").
#
# Usage: bash scripts/archive-version.sh <version>      e.g. bash scripts/archive-version.sh v6.2.5
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-}"
if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "archive-version.sh: expected a version like v6.2.5, got '${version}'" >&2
  exit 2
fi
dest="docs/archive/$version"
frozen="examples-archive/$version"
for d in "$dest" "$frozen"; do
  if [ -e "$d" ]; then
    echo "archive-version.sh: $d already exists; an archive is cut once and then frozen" >&2
    exit 1
  fi
done
[ -d docs/src ] || { echo "archive-version.sh: docs/src not found" >&2; exit 1; }

mkdir -p "$dest"
for part in guide zh api index.md; do
  [ -e "docs/src/$part" ] && cp -r "docs/src/$part" "$dest/$part"
done

# Unique example paths included by the copied pages ("\r" stripped: some pages are CRLF).
refs=$(find "$dest" -name '*.md' -type f -print0 \
  | xargs -0 cat \
  | tr -d '\r' \
  | grep -oE '^[[:space:]]*<<<[[:space:]]*@/\.\./examples/[^ {#]+' \
  | sed -E 's#.*@/\.\./examples/##' | sort -u || true)

count=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  mkdir -p "$frozen/$(dirname "$path")"
  if [ -n "${EXAMPLES_REF:-}" ]; then
    git show "$EXAMPLES_REF:examples/$path" > "$frozen/$path"
  elif [ -f "examples/$path" ]; then
    cp "examples/$path" "$frozen/$path"
  else
    echo "archive-version.sh: examples/$path is included by the archive but does not exist" >&2
    exit 1
  fi
  count=$((count + 1))
done <<< "$refs"

find "$dest" -name '*.md' -type f -print0 | while IFS= read -r -d '' f; do
  sed "s#<<< @/\\.\\./examples/#<<< @/../examples-archive/$version/#" "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
done

echo "archive-version.sh: $dest cut, $count example files frozen in $frozen"
bash scripts/check-archive-examples.sh
echo "Still manual: the sidebar constants and locale mapping in .vitepress/config/, versionsConfig, examples/pom.xml (CONTRIBUTING.md, \"发版归档\")."
