#!/usr/bin/env bash
# Cloudflare Pages 的构建命令是**项目级**的，对该 Pages 项目的所有分支一起生效，
# 而 master 与 alpha 两个分支的 package.json 已经分叉（master 的 build 串了三个
# 生成脚本，alpha 的是裸 vitepress build）。
#
# 2026-09-03 13:26 该命令由 `npm run build` 改成 `npm run build:with-alpha`（master
# 侧构建期注入的产物），而那个脚本当时只存在于 master。后果是 alpha 以及任何以它为
# 基的分支，Pages 构建必然失败，构建日志逐字为 `npm error Missing script:
# "build:with-alpha"`；而且要等到有人推一个 alpha 分支才会被发现——实际隔了快一天。
#
# 本门禁把那个等待期换成一次 CI 失败：改了构建命令而没同步 alpha，下一次 master 的
# CI 就红。
#
# ── 它能抓什么、抓不到什么（不要高估它）────────────────────────────────────
# 能抓：本分支或 alpha 的 package.json 丢了那个脚本名。
# 抓不到：有人只在 Cloudflare 控制台改了构建命令、而没有同步更新
#         scripts/pages-build-command。那份文件是手写的，它是这条链路上唯一一处
#         没有机器保证的环节。
#
# 让它也被机器保证的唯一办法是把 Cloudflare 的 API 令牌放进 GitHub secrets，由 CI
# 去读 Pages 的真实配置。为这一件事新增一份长期凭据，代价大于收益（2026-09-04
# 维护者裁定）。改 Cloudflare 控制台时请一并改这份文件——这句话写在这里，也写在
# scripts/pages-build-command 自己里。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RECORD_FILE="scripts/pages-build-command"
ALPHA_REF="${ALPHA_REF:-alpha}"
failures=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; failures=$((failures + 1)); }

if [ ! -f "$RECORD_FILE" ]; then
  echo "check-pages-build-command: 找不到 $RECORD_FILE" >&2
  exit 2
fi

command_line="$(head -n1 "$RECORD_FILE" | tr -d '\r')"
# 从 `npm run <name>` 里取出脚本名。只支持这一种形状：Pages 那边配的就是它，
# 而支持更多形状等于在这里重新实现一个 shell 解析器。
script_name="$(printf '%s' "$command_line" | sed -nE 's/^[[:space:]]*npm[[:space:]]+run[[:space:]]+([A-Za-z0-9:._-]+)[[:space:]]*$/\1/p')"
if [ -z "$script_name" ]; then
  echo "check-pages-build-command: $RECORD_FILE 的第一行不是 'npm run <脚本名>' 的形状：$command_line" >&2
  exit 2
fi

echo "check-pages-build-command: Pages 配置的构建命令 = $command_line"
echo "                           需要两个分支都提供的脚本名 = $script_name"
echo "----------------------------------------"

has_script() {
  # has_script <package.json 内容> <脚本名>
  printf '%s' "$1" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      let pkg; try { pkg = JSON.parse(s); } catch (e) { process.exit(2); }
      process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, process.argv[1]) ? 0 : 1);
    });
  ' "$2"
}

local_pkg="$(cat package.json)"
if has_script "$local_pkg" "$script_name"; then
  pass "  本分支的 package.json 提供了 $script_name"
else
  fail "  本分支的 package.json 没有 $script_name —— Pages 会对本分支报 Missing script"
fi

# 对照组：一个必然不存在的脚本名必须被判为缺失。没有这一条，上面的 PASS 可能只是
# has_script 恒真（例如 node 不可用时的退出码被误读）。
if has_script "$local_pkg" "__no_such_script_control__"; then
  fail "  对照组：一个必然不存在的脚本名被判为存在 —— 检查函数恒真，上面的结果不算数"
else
  pass "  对照组：一个必然不存在的脚本名被判为缺失"
fi

if ! git fetch --quiet --depth=1 origin "$ALPHA_REF" 2>/dev/null; then
  fail "  取不到 origin/$ALPHA_REF —— 无法核对另一侧，视为不成立而不是跳过"
else
  alpha_pkg="$(git show "FETCH_HEAD:package.json" 2>/dev/null || true)"
  if [ -z "$alpha_pkg" ]; then
    fail "  origin/$ALPHA_REF 上读不到 package.json"
  elif has_script "$alpha_pkg" "$script_name"; then
    pass "  origin/$ALPHA_REF 的 package.json 提供了 $script_name"
  else
    fail "  origin/$ALPHA_REF 的 package.json 没有 $script_name —— 该分支及其所有分支的 Pages 构建会失败，且要等到有人推一个该分支的分支才会被发现"
  fi
fi

echo "----------------------------------------"
echo "不成立条数: $failures"
[ "$failures" -gt 0 ] && exit 1
exit 0
