#!/usr/bin/env bash
# Fixture-driven gate for scripts/javadoc-io-index.sh's structural assertions.
#
# 这五份（现在八份）fixture 从 Phase 02 起就在仓库里，但**没有任何东西跑它们**：
# examples-ci.yml 只在发版路径上调用真实运行，fixture 只在人工排查时被手动喂进
# --check-forms-only。于是断言写松了没人发现，三处出口一直开着到 Codex review
# 才被看见。本脚本把这些 fixture 从「文档」变成门禁。
#
# 断言的取向是 fail-closed：上游把表单改成脚本不认识的样子时，必须报 broken 让人
# 介入，而不是被归类为暂态 post-failed 然后无限重试。因此这里同时断言退出码与
# 输出内容——退出码 0 有两种含义（结构完好、以及结构完好但版本尚未上架），只看
# 退出码分不开它们。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCRIPT_UNDER_TEST="scripts/javadoc-io-index.sh"
FIXTURE_DIR="scripts/fixtures"
failures=0
cases=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; failures=$((failures + 1)); }

# fixture|version|期望退出码|输出必须包含|输出不得包含
# 「不得包含」留空表示不检查。
CASES='
javadoc-io-versions-ok.html|6.2.4|0|结构断言全部通过|bootstrap-needed
javadoc-io-versions-after-sync.html|6.2.4|0|结构断言全部通过|bootstrap-needed
javadoc-io-versions-uploaded-with-controls.html|6.2.4|0|已经是 UPLOADED 状态|
javadoc-io-versions-no-checkbox.html|6.2.4|1|断言三之一失败|
javadoc-io-versions-no-csrf.html|6.2.4|1|sync 表单里抽不到 csrfToken|
javadoc-io-versions-sync-no-csrf.html|6.2.4|1|sync 表单里抽不到 csrfToken|
javadoc-io-versions-upload-method-get.html|6.2.4|1|method 为 post 的表单|
javadoc-io-versions-versionid-lookalike.html|6.2.4|0|bootstrap-needed|
'

# 对照组一：这张表必须同时含期望 0 与期望 1 的用例。只测一个方向的门禁，
# 无法区分「断言正确」与「断言从不触发」。
expected_codes="$(printf '%s\n' "$CASES" | awk -F'|' 'NF>=3{print $3}' | sort -u | tr '\n' ' ')"
echo "期望退出码集合: $expected_codes"
if printf '%s' "$expected_codes" | grep -q '0' && printf '%s' "$expected_codes" | grep -q '1'; then
  pass "  对照组：用例同时覆盖退出 0 与退出 1 两个方向"
else
  fail "  对照组：用例只覆盖了 $expected_codes 一个方向——本门禁无法区分「断言正确」与「断言从不触发」"
fi

echo "----------------------------------------"

while IFS='|' read -r fixture version want_code want_in want_not_in; do
  [ -z "$fixture" ] && continue
  path="$FIXTURE_DIR/$fixture"
  cases=$((cases + 1))

  # 对照组二：fixture 文件必须存在。少一份文件而静默跳过，会让「零不成立」
  # 变成「零次检查」。
  if [ ! -f "$path" ]; then
    fail "  $fixture —— 文件不存在，本用例根本没跑"
    continue
  fi

  set +e
  out="$(bash "$SCRIPT_UNDER_TEST" --version "$version" --check-forms-only --page-file "$path" 2>&1)"
  code=$?
  set -e

  ok=1
  if [ "$code" -ne "$want_code" ]; then
    fail "  $fixture 退出码 observed=$code expected=$want_code"
    ok=0
  fi
  if [ -n "$want_in" ] && ! printf '%s' "$out" | grep -qF -- "$want_in"; then
    fail "  $fixture 输出未包含 '$want_in'"
    ok=0
  fi
  if [ -n "$want_not_in" ] && printf '%s' "$out" | grep -qF -- "$want_not_in"; then
    fail "  $fixture 输出不应包含 '$want_not_in'，但包含了"
    ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    pass "  $fixture 退出码=$code，输出符合期望"
  else
    printf '%s\n' "$out" | sed 's/^/        /'
  fi
done <<< "$CASES"

echo "----------------------------------------"
echo "用例数: $cases    不成立条数: $failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
