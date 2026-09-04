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
# 不要为省 CI 带宽把它改回去——方向是反的。实测：`git fetch --depth=1 origin
# alpha` 拉取 600,293 字节 / 437 个对象的打包数据；这里的一次 GET 只有 1,359
# 字节。改回去更贵，不是更省。仓库是公开的，匿名 GET 不需要凭据，也不要为它引入
# gh 或任何令牌。
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
  remote_url="$(git remote get-url origin 2>/dev/null)" || {
    echo "check-pages-build-command: git remote get-url origin 失败——当前目录没有 origin remote" >&2
    exit 2
  }
  # 先剥尾部斜杠（可能不止一个），再剥 .git 后缀；顺序反过来会把
  # "...UltiTools-Dev-Doc.git/" 先剥成 "...UltiTools-Dev-Doc.git"（只去掉了
  # 斜杠），.git 混进 slug 里，后面的字符集校验会放行、请求会 404，对一个合法
  # remote URL 报假红。
  while [[ "$remote_url" == */ ]]; do
    remote_url="${remote_url%/}"
  done
  remote_url="${remote_url%.git}"

  # 只认 github.com：raw.githubusercontent.com 是写死的字面量，如果 slug 解析
  # 不锚定主机，任何「最后两段路径长得像 owner/repo」的 origin——gitee/gitlab
  # 镜像、自建 fork、甚至一个碰巧同名的本地目录路径——都会被当成 GitHub 上同名
  # 仓库去读，读到的是别人的 alpha，门禁却报告核对了"这份克隆"的 alpha。锚定
  # 之后非 github.com 的 origin 结构上解析不出 slug，直接 exit 2，而不是再发一
  # 次探测请求去识别它。github.com 上的 fork（owner 与 UltiKits 不同的那些）
  # 仍然按预期解析到它自己的 owner/repo 并去读它自己的 alpha，这是正确行为，
  # 不收窄成只认 UltiKits。
  if [[ "$remote_url" =~ ^(https?|git|ssh)://([A-Za-z0-9._-]+@)?github\.com/([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)$ ]]; then
    SLUG="${BASH_REMATCH[3]}/${BASH_REMATCH[4]}"
  elif [[ "$remote_url" =~ ^([A-Za-z0-9._-]+@)?github\.com:([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)$ ]]; then
    SLUG="${BASH_REMATCH[2]}/${BASH_REMATCH[3]}"
  else
    SLUG=""
  fi
fi

if [[ ! "$SLUG" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || [[ "$SLUG" == *..* ]]; then
  echo "check-pages-build-command: 无法从当前环境解析出仓库 slug（owner/repo）—— 仅支持 github.com 上的仓库" >&2
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
  # 退出码：0=存在，1=不存在，2=不是合法 JSON，127=node 不可用（shell 自身的
  # command-not-found 状态码）。调用方必须逐个分派这四种结局，不能把非零一律
  # 当成"不存在"——那会把"这份 JSON 解析不了"或"node 缺失"误报成"缺脚本"，
  # 把读者指去修错的分支。
  printf '%s' "$1" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      let pkg; try { pkg = JSON.parse(s); } catch (e) { process.exit(2); }
      process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, process.argv[1]) ? 0 : 1);
    });
  ' "$2"
}

run_has_script() {
  # run_has_script <package.json 内容> <脚本名>
  # 把 has_script 的真实退出码存进全局变量 HS_RC，用 `||` 接住以免在
  # set -e 下，一旦 has_script 返回非零就把整个门禁在半途、不打印任何断言行地
  # 中止掉。
  HS_RC=0
  has_script "$1" "$2" || HS_RC=$?
}

local_pkg="$(cat package.json)" || {
  echo "check-pages-build-command: 读不到本分支的 package.json" >&2
  exit 2
}

run_has_script "$local_pkg" "$script_name"
case "$HS_RC" in
  0) pass "  本分支的 package.json 提供了 $script_name" ;;
  1) fail "  本分支的 package.json 没有 $script_name —— Pages 会对本分支报 Missing script" ;;
  2) echo "check-pages-build-command: 本分支的 package.json 不是合法 JSON，无法核对 $script_name" >&2; exit 2 ;;
  127) echo "check-pages-build-command: node 不可用（exit 127），无法核对本分支的 package.json" >&2; exit 2 ;;
  *) echo "check-pages-build-command: has_script 对本分支返回未知状态码 $HS_RC" >&2; exit 2 ;;
esac

# 对照组：一个必然不存在的脚本名必须被判为缺失。没有这一条，上面的 PASS 可能只是
# has_script 恒真（比如实现里把任何非零一律当成"存在"处理）。has_script 自身对
# JSON 解析失败或 node 不可用返回的 2/127，会在各自调用点直接 exit 2 中止整个门
# 禁，不会被这个对照组吸收——这个对照组只保证"不存在的脚本名不会被误判为存
# 在"，不负责证明 node 可用（那由上面 case 语句里的 127 分支单独兜底）。
run_has_script "$local_pkg" "__no_such_script_control__"
case "$HS_RC" in
  0) fail "  对照组：一个必然不存在的脚本名被判为存在 —— 检查函数恒真，上面的结果不算数" ;;
  1) pass "  对照组：一个必然不存在的脚本名被判为缺失" ;;
  2) echo "check-pages-build-command: 本分支的 package.json 不是合法 JSON，对照组无法核对" >&2; exit 2 ;;
  127) echo "check-pages-build-command: node 不可用（exit 127），对照组无法核对" >&2; exit 2 ;;
  *) echo "check-pages-build-command: has_script 对对照组返回未知状态码 $HS_RC" >&2; exit 2 ;;
esac

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

alpha_body="$(mktemp)" || {
  echo "check-pages-build-command: mktemp 失败，无法创建临时文件承接 alpha 的 package.json" >&2
  exit 2
}
trap 'rm -f "$alpha_body"' EXIT INT TERM

alpha_code="$(fetch_pkg_status "$SLUG" "$ALPHA_REF" "$alpha_body")"
if [ "$alpha_code" != "200" ]; then
  fail "  取不到 origin/$ALPHA_REF 上的 package.json（HTTP $alpha_code）—— 无法核对另一侧，视为不成立而不是跳过"
else
  alpha_pkg="$(cat "$alpha_body")"
  if [ -z "$alpha_pkg" ]; then
    fail "  origin/$ALPHA_REF 上读不到 package.json"
  else
    run_has_script "$alpha_pkg" "$script_name"
    case "$HS_RC" in
      0) pass "  origin/$ALPHA_REF 的 package.json 提供了 $script_name" ;;
      1) fail "  origin/$ALPHA_REF 的 package.json 没有 $script_name —— 该分支及其所有分支的 Pages 构建会失败，且要等到有人推一个该分支的分支才会被发现" ;;
      2) echo "check-pages-build-command: origin/$ALPHA_REF 的 package.json 不是合法 JSON，无法核对 $script_name" >&2; exit 2 ;;
      127) echo "check-pages-build-command: node 不可用（exit 127），无法核对 origin/$ALPHA_REF 的 package.json" >&2; exit 2 ;;
      *) echo "check-pages-build-command: has_script 对 origin/$ALPHA_REF 返回未知状态码 $HS_RC" >&2; exit 2 ;;
    esac
  fi
fi

# 对照组：一个必然不存在的 ref 必须被判为取不到，且必须是 404——不是"任何非
# 200"。没网、DNS 故障、代理拒绝、429 都会让 fetch_pkg_status 返回 "000" 或其
# 它非 200 状态码，如果这里只要求"!= 200"就 PASS，那么 alpha 那一侧同样因为没
# 出网而拿到的 FAIL 也会被这个"PASS"的对照组盖过去，等于什么都没证明。
control_code="$(fetch_pkg_status "$SLUG" "__no_such_ref_control__" /dev/null)"
if [ "$control_code" = "404" ]; then
  pass "  对照组：一个必然不存在的 ref 被判为取不到（HTTP 404）"
elif [ "$control_code" = "200" ]; then
  fail "  对照组：一个必然不存在的 ref 也返回了 200 —— 状态检查恒真，上面 alpha 的结果不算数"
else
  fail "  对照组：一个必然不存在的 ref 返回了 HTTP $control_code（不是 404 也不是 200）—— 请求可能没有真正落到网络上，上面 alpha 的结果不算数"
fi

echo "----------------------------------------"
echo "不成立条数: $failures"
[ "$failures" -gt 0 ] && exit 1
exit 0
