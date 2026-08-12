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

base=https://repo1.maven.org/maven2/com/ultikits/UltiTools-API
for v in "$PREV" "$CURR"; do
  curl -sfL -o "$WORK/$v.jar" "$base/$v/UltiTools-API-$v.jar" \
    || { echo "无法下载 $v，请确认它是 Maven Central 上的正式版"; exit 0; }
  unzip -l "$WORK/$v.jar" \
    | grep -oE 'com/ultikits/ultitools/[A-Za-z0-9/$]+\.class' \
    | grep -v '\$' \
    | sed 's#/#.#g; s#\.class$##' \
    | sort -u > "$WORK/$v.classes"
done

# Scan both docs/src and examples/src: since commit a729691, page code samples
# are `<<<` snippet references into examples/src/**/*.java rather than inline
# markdown blocks, so a class only shown via a snippet (e.g. BaseDataEntity)
# never appears as a literal FQN in docs/src. examples/src is documentation
# content from a reader's point of view — it's what renders on the page — so
# leaving it out of the scan would misreport already-documented classes as
# undocumented, and that false-positive rate would only grow as more pages
# migrate to snippets.
grep -rhoE 'com\.ultikits\.ultitools\.[a-z.]+\.[A-Z][A-Za-z0-9]*' \
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
echo "  $CURR 公开类总数: $(wc -l < "$WORK/$CURR.classes")"
echo "  文档提及的类数量: $(wc -l < "$WORK/documented.txt")"
echo "  本版新增: $(wc -l < "$WORK/added.txt")  本版删除: $(wc -l < "$WORK/removed.txt")"
