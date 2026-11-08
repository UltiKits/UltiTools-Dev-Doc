#!/usr/bin/env bash
# Reports documentation coverage between two released versions.
# Data source is the published JAR, not javadoc and not git tags:
# 6.2.0 shipped to Maven Central without a git tag, so tags are unreliable.
set -euo pipefail

PREV="${1:?用法: report-doc-coverage.sh <上一版本> <本版本>}"
CURR="${2:?用法: report-doc-coverage.sh <上一版本> <本版本>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Only public top-level classes count. The JAR also carries package-private
# helpers that no reader can use, so listing them would inflate both the total
# and the "undocumented" list. `javap` prints each class's declaration line,
# and that line starts with `public` exactly when the class is public. Without
# a JDK the filter is skipped and the report says so.
have_javap=1
command -v javap >/dev/null 2>&1 || have_javap=0

base=https://repo1.maven.org/maven2/com/ultikits/UltiTools-API
for v in "$PREV" "$CURR"; do
  curl -sfL -o "$WORK/$v.jar" "$base/$v/UltiTools-API-$v.jar" \
    || { echo "无法下载 $v，请确认它是 Maven Central 上的正式版"; exit 0; }
  unzip -l "$WORK/$v.jar" \
    | grep -oE 'com/ultikits/ultitools/[A-Za-z0-9/$]+\.class' \
    | grep -v '\$' \
    | sed 's#/#.#g; s#\.class$##' \
    | sort -u > "$WORK/$v.all"
  if [ "$have_javap" = 1 ]; then
    # Declaration lines look like `public final class a.b.C extends …{` or
    # `interface a.b.D {`; keep the FQN of the ones that start with `public`.
    xargs -n 400 javap -cp "$WORK/$v.jar" < "$WORK/$v.all" \
      | grep -E '^public .*\b(class|interface|enum|@interface) ' \
      | sed -E 's/.*\b(class|interface|enum|@interface) ([A-Za-z0-9_.$]+).*/\2/' \
      | sort -u > "$WORK/$v.classes"
  else
    cp "$WORK/$v.all" "$WORK/$v.classes"
  fi
done

# Scan both docs/src and examples/src: since commit 48dbeae, page code samples
# are `<<<` snippet references into examples/src/**/*.java rather than inline
# markdown blocks, so a class only shown via a snippet (e.g. BaseDataEntity)
# never appears as a literal FQN in docs/src. examples/src is documentation
# content from a reader's point of view — it's what renders on the page — so
# leaving it out of the scan would misreport already-documented classes as
# undocumented, and that false-positive rate would only grow as more pages
# migrate to snippets.
# The package part may be empty: `com.ultikits.ultitools.UltiTools` sits in the
# top-level package, and a pattern that demands a subpackage never matched it,
# so it was always reported undocumented.
grep -rhoE 'com\.ultikits\.ultitools\.([a-z][a-z0-9]*\.)*[A-Z][A-Za-z0-9]*' \
  "$ROOT/docs/src" "$ROOT/examples/src" | sort -u > "$WORK/documented.txt"

comm -13 "$WORK/$PREV.classes" "$WORK/$CURR.classes" > "$WORK/added.txt"
comm -23 "$WORK/$PREV.classes" "$WORK/$CURR.classes" > "$WORK/removed.txt"

echo "=== $PREV → $CURR 文档覆盖报告 ==="
echo
echo "-- 新增的 public 类中，文档未提及的 --"
comm -23 "$WORK/added.txt" "$WORK/documented.txt" | sed 's/^/  /' || true
echo
echo "-- 已删除的 public 类中，文档仍在引用的（需要立即处理）--"
comm -12 "$WORK/removed.txt" "$WORK/documented.txt" | sed 's/^/  /' || true
echo
echo "-- 统计 --"
if [ "$have_javap" = 1 ]; then
  echo "  $CURR 公开类总数: $(wc -l < "$WORK/$CURR.classes")（JAR 内顶层类共 $(wc -l < "$WORK/$CURR.all")）"
else
  echo "  $CURR 顶层类总数（未找到 javap，未能区分 public）: $(wc -l < "$WORK/$CURR.classes")"
fi
echo "  文档提及的类数量: $(wc -l < "$WORK/documented.txt")"
echo "  本版新增: $(wc -l < "$WORK/added.txt")  本版删除: $(wc -l < "$WORK/removed.txt")"
