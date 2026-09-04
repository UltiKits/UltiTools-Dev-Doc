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
#
# ── 为什么读 alpha 走 HTTP 而不是 git fetch（2026-09-05）───────────────────
# 原先这里是 `git fetch --quiet --depth=1 origin alpha`。它在 CI 里无害——
# `pages-build-command` 是独立作业，checkout 本来就是临时的——但在开发者的长期
# 克隆里会写下 `.git/shallow`，把 alpha 的 tip 记成无父提交。实测症状三条数字
# 对照：`git rev-list --count origin/alpha` 报 1（真值 233）；
# `git merge-base origin/master origin/alpha` 返回空且退出 1（真值 `1ae9606`）；
# 本地 alpha 报 ahead 228 / behind 1（真值 ahead 0 / behind 5）。merge-base 一旦
# 缺失，merge 退化成两路比较，alpha 与 master 的冲突面看起来是 95 个文件而不是
# 真实的 6 个——曾据此误记过一条「6.3.0 发布阻塞」。而门禁自己一直报告 0 条不成
# 立：它是绿的，同时在损坏克隆。
#
# 不要为省 CI 带宽把它改回去——省的是 CI 的几十 KB，代价是每个开发者的克隆。仓库
# 是公开的，匿名 GET 不需要凭据，也不要为它引入 gh 或任何令牌。
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

# 解析出 owner/repo，供后面匿名 HTTP 读 alpha 的 package.json 用。GitHub Actions
# 里优先信任 GITHUB_REPOSITORY；本地跑就退回只读的 `git remote get-url origin`。
if [ -n "${GITHUB_REPOSITORY:-}" ]; then
  SLUG="$GITHUB_REPOSITORY"
else
  remote_url="$(git remote get-url origin)"
  remote_url="${remote_url%.git}"
  remote_url="${remote_url%/}"
  # 只取最后两段路径，用 [[ =~ ]] 而不是 grep -oE 管道赋值——本仓库已有先例
  # （javadoc-io-index.sh，记在 .planning/STATE.md）：pipefail 下一个合法未命中
  # 的 grep -oE 若被直接赋值给变量，会中止整个脚本。字符类排除 `:`/`/`/`@`，
  # 这样 `https://user:token@github.com/OWNER/REPO` 只产出 OWNER/REPO
  # （userinfo 结构上进不来），`git@github.com:OWNER/REPO` 也不会把主机名
  # 吞进 owner。
  if [[ "$remote_url" =~ ([^:/@]+)/([^:/@]+)$ ]]; then
    SLUG="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    SLUG=""
  fi
fi

if [[ ! "$SLUG" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
  echo "check-pages-build-command: 无法从当前环境解析出仓库 slug（owner/repo）" >&2
  exit 2
fi

if [[ ! "$ALPHA_REF" =~ ^[A-Za-z0-9._/-]+$ ]] || [[ "$ALPHA_REF" == *..* ]]; then
  echo "check-pages-build-command: ALPHA_REF 含非法字符或路径穿越" >&2
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

fetch_pkg_status() {
  # fetch_pkg_status <slug> <ref> <正文输出路径>
  # 向 raw.githubusercontent.com 发一次匿名 GET，正文写入第三个参数指定的路径，
  # HTTP 状态码打印到 stdout。主机名写死为字面量，不从环境取；不加 -L（跟着状态码
  # 判定走 fail 分支更安全）、不加 -k/--insecure（保留证书校验）、不传任何认证
  # 相关参数——仓库公开，匿名读足够。
  local slug="$1" ref="$2" out="$3"
  local code
  code="$(curl -sS -o "$out" -w '%{http_code}' --connect-timeout 10 --max-time 30 \
    "https://raw.githubusercontent.com/${slug}/${ref}/package.json")" || code="000"
  printf '%s' "$code"
}

alpha_body="$(mktemp)"
trap 'rm -f "$alpha_body"' EXIT

alpha_code="$(fetch_pkg_status "$SLUG" "$ALPHA_REF" "$alpha_body")"
if [ "$alpha_code" != "200" ]; then
  fail "  取不到 origin/$ALPHA_REF 上的 package.json（HTTP $alpha_code）—— 无法核对另一侧，视为不成立而不是跳过"
else
  alpha_pkg="$(cat "$alpha_body")"
  if [ -z "$alpha_pkg" ]; then
    fail "  origin/$ALPHA_REF 上读不到 package.json"
  elif has_script "$alpha_pkg" "$script_name"; then
    pass "  origin/$ALPHA_REF 的 package.json 提供了 $script_name"
  else
    fail "  origin/$ALPHA_REF 的 package.json 没有 $script_name —— 该分支及其所有分支的 Pages 构建会失败，且要等到有人推一个该分支的分支才会被发现"
  fi
fi

# 对照组：一个必然不存在的 ref 必须被判为取不到。没有这一条，上面的 PASS 可能只是
# 状态检查恒真（例如状态码被解析成一个写死的默认值、请求其实从未落到网络上）。
control_code="$(fetch_pkg_status "$SLUG" "__no_such_ref_control__" /dev/null)"
if [ "$control_code" != "200" ]; then
  pass "  对照组：一个必然不存在的 ref 被判为取不到（HTTP $control_code）"
else
  fail "  对照组：一个必然不存在的 ref 也返回了 200 —— 状态检查恒真，上面 alpha 的结果不算数"
fi

echo "----------------------------------------"
echo "不成立条数: $failures"
[ "$failures" -gt 0 ] && exit 1
exit 0
