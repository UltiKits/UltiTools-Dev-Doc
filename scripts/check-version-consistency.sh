#!/usr/bin/env bash
# Verifies the doc-sync invariant:
#   config.mts current  ==  examples/pom.xml ultitools.version  ==  Maven Central <release>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Each assignment's pipeline may legitimately fail (network down, no match, …).
# Under `set -e`, an unguarded failure here would abort the script before the
# diagnostic echoes and the -z fallback below ever run — `|| true` keeps that
# failure path reachable instead of exiting silently.
doc_ver=$(grep -oE "current: *'v[0-9]+\.[0-9]+\.[0-9]+'" "$ROOT/.vitepress/config.mts" \
          | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true
pom_ver=$(grep -oE '<ultitools\.version>[0-9]+\.[0-9]+\.[0-9]+</ultitools\.version>' "$ROOT/examples/pom.xml" \
          | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true
central_ver=$(curl -sfL --connect-timeout 10 --max-time 30 \
              https://repo1.maven.org/maven2/com/ultikits/UltiTools-API/maven-metadata.xml \
              | grep -oE '<release>[^<]+</release>' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true

echo "config.mts current : ${doc_ver:-<未找到>}"
echo "examples/pom.xml   : ${pom_ver:-<未找到>}"
echo "Maven Central      : ${central_ver:-<未找到>}"

if [ -z "$doc_ver" ] || [ -z "$pom_ver" ] || [ -z "$central_ver" ]; then
  echo "FAIL: 三者中有值未能解析出来"
  exit 1
fi

if [ "$doc_ver" = "$pom_ver" ] && [ "$pom_ver" = "$central_ver" ]; then
  echo "OK: 文档已与最新正式版同步"
  exit 0
fi

echo "FAIL: 版本不一致 — 文档需要同步到 $central_ver"
exit 1
