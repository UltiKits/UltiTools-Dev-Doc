#!/usr/bin/env bash
# Cut a documentation archive from ONE commit and freeze the examples it includes, in one step.
# 发版归档：页面和示例都从同一个提交读取，复制到 docs/archive/<版本>/ 与 examples-archive/<版本>/。
#
# Why one commit: the archive for vX must show what dev.ultikits.com served for vX. Under the doc-sync
# workflow docs `alpha` already carries the NEXT release's pages and examples, so a cut taken from a
# working tree on `alpha` archives unreleased pages under the old version's name (measured on the v6.2.5
# cut: 48 files mentioning v6.3.0, three whole pages starting "As of v6.3.0 — unreleased"). And archived
# pages that keep including `<<< @/../examples/` change whenever examples/ does (v6.2.4: 11 of its 78
# examples had changed by the time it was archived). So pages AND examples are both read from
# ARCHIVE_REF with `git archive`, never from the working tree, and ARCHIVE_REF must be a commit that
# was published, i.e. one on origin/master.
#
# Usage:   ARCHIVE_REF=<commit> bash scripts/archive-version.sh <version>
#          e.g. ARCHIVE_REF=$(git rev-parse origin/master) bash scripts/archive-version.sh v6.2.5
# Record the commit BEFORE the release's alpha -> master merge: after it, master carries the new
# release's pages (see CONTRIBUTING.md, "发版归档").
#
# Refused (nothing is written):
#   - ARCHIVE_REF unset or not a commit                          exit 2
#   - ARCHIVE_REF not an ancestor of origin/master               exit 1 (alpha carries unreleased pages)
#   - examples/pom.xml at ARCHIVE_REF does not build against <version>      exit 1
#   - versionsConfig.current at ARCHIVE_REF is not <version>               exit 1
#   - docs/archive/<version> or examples-archive/<version> exists  exit 1 (an archive is cut once)
# Once it starts writing, any failure removes what it wrote, so a retry is not refused for a partial cut.
#
# What it does:
#   1. git-archives docs/src and examples/src at ARCHIVE_REF into a temporary directory
#   2. copies {guide,zh,api,index.md} from there to docs/archive/<version>/ (whichever exist)
#   3. copies every example those pages include from there to examples-archive/<version>/<path>
#   4. rewrites `<<< @/../examples/` to `<<< @/../examples-archive/<version>/` in the copied pages
#   5. runs scripts/check-archive-examples.sh
# It does not touch .vitepress/config*, sidebars or examples/pom.xml: those stay manual (CONTRIBUTING.md).
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-}"
if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "archive-version.sh: expected a version like v6.2.5, got '${version}'" >&2
  exit 2
fi
ref="${ARCHIVE_REF:-}"
if [ -z "$ref" ]; then
  echo "archive-version.sh: set ARCHIVE_REF to the commit dev.ultikits.com served for $version" >&2
  echo "  (origin/master as it was BEFORE the release's alpha -> master merge): the source is always a decision" >&2
  exit 2
fi
if ! git rev-parse -q --verify "$ref^{commit}" > /dev/null; then
  echo "archive-version.sh: ARCHIVE_REF '$ref' is not a commit in this repository" >&2
  exit 2
fi
if ! git rev-parse -q --verify origin/master > /dev/null; then
  echo "archive-version.sh: origin/master not found; fetch it first (git fetch origin)" >&2
  exit 1
fi
if ! git merge-base --is-ancestor "$ref" origin/master; then
  echo "archive-version.sh: $ref is not on origin/master; alpha carries unreleased pages, so it cannot be archived as $version" >&2
  exit 1
fi
want="${version#v}"
got=$(git show "$ref:examples/pom.xml" | sed -n 's:.*<ultitools.version>\(.*\)</ultitools.version>.*:\1:p' | head -1)
if [ "$got" != "$want" ]; then
  echo "archive-version.sh: examples/pom.xml at $ref builds against '$got', not $want" >&2
  exit 1
fi
if ! git show "$ref:.vitepress/config.mts" | grep -q "current: '$version'"; then
  echo "archive-version.sh: versionsConfig.current at $ref is not '$version'" >&2
  exit 1
fi
dest="docs/archive/$version"
frozen="examples-archive/$version"
for d in "$dest" "$frozen"; do
  if [ -e "$d" ]; then
    echo "archive-version.sh: $d already exists; an archive is cut once and then frozen" >&2
    exit 1
  fi
done

src=$(mktemp -d)
cut_started=0
cleanup() {
  rc=$?
  rm -rf "$src"
  if [ "$rc" -ne 0 ] && [ "$cut_started" -eq 1 ]; then
    rm -rf "$dest" "$frozen"
    echo "archive-version.sh: failed (exit $rc); the partial $dest and $frozen were removed" >&2
  fi
}
trap cleanup EXIT

git archive "$ref" docs/src examples/src | tar -x -C "$src"
cut_started=1
mkdir -p "$dest"
for part in guide zh api index.md; do
  if [ -e "$src/docs/src/$part" ]; then
    cp -r "$src/docs/src/$part" "$dest/$part"
  fi
done

# Unique example paths included by the copied pages ("\r" stripped: some pages are CRLF).
refs=$(find "$dest" -name '*.md' -type f -print0 \
  | xargs -0 cat \
  | tr -d '\r' \
  | { grep -oE '^[[:space:]]*<<<[[:space:]]*@/\.\./examples/[^ {#]+' || true; } \
  | sed -E 's#.*@/\.\./examples/##' | sort -u)

count=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  if [ ! -f "$src/examples/$path" ]; then
    echo "archive-version.sh: examples/$path is included by the archive but does not exist at $ref" >&2
    exit 1
  fi
  mkdir -p "$frozen/$(dirname "$path")"
  cp "$src/examples/$path" "$frozen/$path"
  count=$((count + 1))
done <<< "$refs"

find "$dest" -name '*.md' -type f -print0 | while IFS= read -r -d '' f; do
  sed "s#<<< @/\\.\\./examples/#<<< @/../examples-archive/$version/#" "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
done

echo "archive-version.sh: $dest cut from $(git rev-parse --short "$ref"), $count example files frozen in $frozen"
bash scripts/check-archive-examples.sh
echo "Still manual (CONTRIBUTING.md, \"发版归档\"): the sidebar constants and locale mapping in .vitepress/config/, BACKFILL_VERSIONS in scripts/javadoc-io-index.sh, the version arguments in scripts/check-sidebar-links.sh, then versionsConfig.current and examples/pom.xml."
