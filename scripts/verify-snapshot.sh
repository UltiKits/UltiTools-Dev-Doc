#!/usr/bin/env bash
# curl-only verification for the alpha SNAPSHOT injection
# (docs/archive/v6.3.0-SNAPSHOT/, scripts/inject-alpha.mjs's output) against
# a real deployed URL (a PR preview or production). Cloudflare Pages has no
# local emulator that reproduces the edge routing layer faithfully — same
# constraint documented in scripts/verify-api-proxy.sh's head comment —
# and several of the assertions below (noindex meta, sitemap exclusion,
# the alpha-sourced sidebar) only exist in a real `vitepress build` output
# served by Cloudflare Pages, not in anything runnable offline.
#
# Not wired into CI. .github/workflows/docs-ci.yml's build-with-alpha job
# only ever builds and reads the repository — it has no deployed URL to hit,
# and this script needs one as its first argument.
#
# The base URL is a required first positional argument on purpose: hardcoding
# a domain here would make the script usable against exactly one deployment,
# defeating the reason it exists — running the same checks against a PR
# preview BEFORE the SNAPSHOT injection ever reaches production, then again
# against production after merge.
#
# set -uo pipefail, not set -e: a failed curl or a failed assertion must not
# abort the run early. Every item below has to execute regardless of earlier
# results, so one run gives a complete picture instead of stopping at the
# first FAIL — same posture as verify-api-proxy.sh.
#
# All body assertions below grep the saved response FILE directly, never a
# `printf '%s' "$body" | grep -q ...` pipe: a real full VitePress SNAPSHOT
# page is ~150KB (every page embeds __VP_SITE_DATA__ for every locale/
# version, 03-01-SUMMARY's own finding) — well over a pipe's default 64KB
# capacity. `grep -q` exits the instant it finds a match, closing its stdin;
# if `printf` is still mid-write on the far side of that pipe when grep
# exits, it is killed by SIGPIPE, and under `pipefail` that non-zero exit
# propagates to the whole pipeline even though grep DID find the match —
# a real, reproducible false negative on content this size (confirmed
# empirically while writing this script; verify-api-proxy.sh's own bodies
# never trigger it because they are small fragments, not full SPA pages).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
status=0

usage() {
  cat <<'USAGE' >&2
用法: verify-snapshot.sh <base-url>

  base-url  必填，不带尾斜杠。PR preview 域名（Cloudflare Pages 为每个 PR
            自动生成）或生产域名（从 Cloudflare Pages 项目设置里读取，本脚本
            不写死任何具体域名，两处都能跑）。

示例：verify-snapshot.sh https://<deployment-id>.pages.dev
USAGE
}

if [ "$#" -lt 1 ] || [ -z "${1:-}" ]; then
  usage
  exit 2
fi

BASE_URL="${1%/}"

echo "base url : $BASE_URL"
echo

record() {
  # record <label> <observed-value> <result: 0=pass 1=fail> — one printed
  # line per item, carrying the item name, the observed value, and PASS/FAIL.
  # Identical shape to scripts/verify-api-proxy.sh's record(), reused
  # verbatim so the two scripts' results can be read side by side.
  if [ "$3" -eq 0 ]; then
    printf 'PASS  %-56s  %s\n' "$1" "$2"
  else
    printf 'FAIL  %-56s  %s\n' "$1" "$2"
    status=1
  fi
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
seq_n=0

# fetch <url> — populates $HTTP_STATUS and $BODY_FILE for one request. The
# body is written straight to disk by curl -o and never round-tripped
# through a bash variable for the assertions below (see head comment).
fetch() {
  local url="$1"
  seq_n=$((seq_n + 1))
  BODY_FILE="$TMPDIR/b.$seq_n"
  HTTP_STATUS=$(curl -sS -o "$BODY_FILE" -w '%{http_code}' --max-time 30 --connect-timeout 10 "$url")
}

# snapshot_guide_sidebar_links <html-file> — prints the SNAPSHOT-scoped
# guide sidebar's `link` values, one per line.
#
# 03-01-SUMMARY.md's own Deviations section already proved that grepping a
# whole VitePress page for a sidebar link substring is unsound on this
# multi-version site: every page embeds __VP_SITE_DATA__ containing EVERY
# locale's and EVERY version's sidebar tree (needed for the SPA's
# client-side router), so master's own legitimate
# guide/advanced/ulti-tools-plugin sidebar entry is present as a literal
# substring on every single page, SNAPSHOT included, regardless of whether
# the SNAPSHOT sidebar itself is correct. A naive `grep` for that string
# against the raw HTML is confirmed (empirically, while writing this
# script) to always match and can never fail — it has no discriminating
# power. This extracts only the v6.3.0-SNAPSHOT locale's own guide sidebar
# out of that JSON payload, the same JSON-scoped technique 03-01 used to
# verify the real claim.
snapshot_guide_sidebar_links() {
  node -e '
    const fs = require("fs");
    const html = fs.readFileSync(process.argv[1], "utf8");
    const m = html.match(/__VP_SITE_DATA__=JSON\.parse\((".*?")\);<\/script>/s);
    if (!m) { process.exit(1); }
    let data;
    try {
      data = JSON.parse(JSON.parse(m[1]));
    } catch (e) { process.exit(1); }
    const locale = data.locales && data.locales["v6.3.0-SNAPSHOT"];
    const sidebar = locale && locale.themeConfig && locale.themeConfig.sidebar;
    if (!sidebar) { process.exit(1); }
    const guide = sidebar["v6.3.0-SNAPSHOT/guide"] || [];
    for (const group of guide) {
      for (const item of (group.items || [])) {
        console.log(item.link);
      }
    }
  ' "$1"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. /v6.3.0-SNAPSHOT/guide/introduction 返回 200（取回的 HTML 供第 4/5/6/8 条复用）
# ─────────────────────────────────────────────────────────────────────────────
url_intro_en="$BASE_URL/v6.3.0-SNAPSHOT/guide/introduction"
fetch "$url_intro_en"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
record "1 SNAPSHOT guide/introduction（英）可读" "status=$HTTP_STATUS" "$r"
INTRO_EN_FILE="$BODY_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# 2. /zh/v6.3.0-SNAPSHOT/guide/introduction 返回 200（取回的 HTML 供第 8 条复用）
# ─────────────────────────────────────────────────────────────────────────────
url_intro_zh="$BASE_URL/zh/v6.3.0-SNAPSHOT/guide/introduction"
fetch "$url_intro_zh"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
record "2 SNAPSHOT guide/introduction（中）可读" "status=$HTTP_STATUS" "$r"
INTRO_ZH_FILE="$BODY_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# 3. /v6.3.0-SNAPSHOT/api/version-wrapper 返回 200——证明 api/ 这条 sidebar
#    key 确实接了线，不是只接了 guide（D-45 的 api 侧接线）
# ─────────────────────────────────────────────────────────────────────────────
url_api="$BASE_URL/v6.3.0-SNAPSHOT/api/version-wrapper"
fetch "$url_api"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
record "3 SNAPSHOT api/version-wrapper 可读" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 4. 第 1 条 HTML 的 SNAPSHOT-scoped sidebar 含 alpha-only 的
#    advanced/module-dependencies（Pitfall 1 的正面证据：sidebar 确实来自
#    alpha 自己的配置，不是空白）
# ─────────────────────────────────────────────────────────────────────────────
r=0
snapshot_guide_sidebar_links "$INTRO_EN_FILE" | grep -q 'advanced/module-dependencies' || r=1
record "4 sidebar 含 alpha-only 页面 module-dependencies" "$([ "$r" -eq 0 ] && echo '命中' || echo '未命中')" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 5. 第 1 条 HTML 的 SNAPSHOT-scoped sidebar 不含 master-only 的
#    advanced/ulti-tools-plugin（Pitfall 1 的反向证据：没有静默 fallback 到
#    latest 的 sidebar）
# ─────────────────────────────────────────────────────────────────────────────
# planner-discipline-allow: advanced/ulti-tools-plugin
# 上面这行字面量本身就是本条断言要求出现在脚本源码里的 grep 模式；被反向
# grep 的对象是 SNAPSHOT-scoped sidebar 数据（snapshot_guide_sidebar_links
# 的输出），不是这份脚本自身，也不是整页原始 HTML——对整页 HTML 做同样的
# grep 在这个多版本站点上恒为命中（见 snapshot_guide_sidebar_links 头注释），
# 不具备区分力，03-01-SUMMARY.md 的 Deviations 已经证实过这一点。
#
# 这是一条负向断言（"不含某个字符串"），因此必须先证明真的搜过——一个
# 空/失败的提取结果同样会让 grep -q ... && r=1 找不到匹配，从而与"提取
# 成功且确实不含"报出同一个 PASS。这正是 RESEARCH.md Pitfall 1（sidebar
# 未接线时静默 fallback 到 latest）想抓的失效形状，如果这条断言自己的
# 提取步骤失败却报绿，就是在用同一种"没检查等于没问题"掩盖它本该发现的
# 问题。提取结果先落到文件、判非空作为前置条件，前置条件不成立本身就是
# FAIL，不能落到"未命中（正确）"这个分支。
SIDEBAR_LINKS_FILE="$TMPDIR/sidebar-links-en.txt"
snapshot_guide_sidebar_links "$INTRO_EN_FILE" > "$SIDEBAR_LINKS_FILE" 2>/dev/null
sidebar_link_count=$(grep -c . "$SIDEBAR_LINKS_FILE" 2>/dev/null || true)
sidebar_link_count="${sidebar_link_count:-0}"
r=0
if [ "$sidebar_link_count" -eq 0 ]; then
  r=1
  observed="提取失败或为空（无法判定——见断言 5 头注释；不视为通过）"
elif grep -q 'advanced/ulti-tools-plugin' "$SIDEBAR_LINKS_FILE"; then
  r=1
  observed="命中（fallback 复现，共 ${sidebar_link_count} 条链接）"
else
  observed="未命中（正确，共 ${sidebar_link_count} 条链接）"
fi
record "5 sidebar 不含 master-only 页面 ulti-tools-plugin" "$observed" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 6. 第 1 条 HTML 含 robots noindex 的 meta 标签（D-48）
# ─────────────────────────────────────────────────────────────────────────────
r=0
grep -qi 'name="robots"[[:space:]]*content="noindex"' "$INTRO_EN_FILE" || r=1
record "6 SNAPSHOT 页面含 noindex meta 标签" "$([ "$r" -eq 0 ] && echo '命中' || echo '未命中')" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 7. 中英两个版本首页分别渲染出提示条的 alpha 态（04-02，D-59：接管此前
#    inject-alpha.mjs 注入的 ::: warning 块，该块本轮已删除）。同时要求
#    marker 属性与文案片段两者都在——marker 单独出现无法排除组件渲染了空
#    文案，文案片段单独出现无法排除命中的是别的无关页面；两者都取自
#    04-UI-SPEC.md § Copywriting Contract 的 alpha row-1（VersionNoticeBar.vue
#    的 stateSentence，不含动态版本号那半，因此断言稳定）。
# ─────────────────────────────────────────────────────────────────────────────
url_home_en="$BASE_URL/v6.3.0-SNAPSHOT/"
fetch "$url_home_en"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
grep -q 'data-ut-version-state="alpha"' "$BODY_FILE" || r=1
grep -q 'This page describes the alpha branch and may change at any time' "$BODY_FILE" || r=1
record "7a SNAPSHOT 首页（英）含提示条 alpha 态" "status=$HTTP_STATUS" "$r"

url_home_zh="$BASE_URL/zh/v6.3.0-SNAPSHOT/"
fetch "$url_home_zh"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
grep -q 'data-ut-version-state="alpha"' "$BODY_FILE" || r=1
grep -q '本页内容来自 alpha 分支，随时可能变更，不属于任何已发布版本' "$BODY_FILE" || r=1
record "7b SNAPSHOT 首页（中）含提示条 alpha 态" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 8. guide/introduction 页面（复用第 1/2 条已取回的 HTML）同样含提示条的
#    alpha 态 marker 与文案片段
# ─────────────────────────────────────────────────────────────────────────────
r=0
grep -q 'data-ut-version-state="alpha"' "$INTRO_EN_FILE" || r=1
grep -q 'This page describes the alpha branch and may change at any time' "$INTRO_EN_FILE" || r=1
record "8a SNAPSHOT guide/introduction（英）含提示条 alpha 态" "$([ "$r" -eq 0 ] && echo '命中' || echo '未命中')" "$r"

r=0
grep -q 'data-ut-version-state="alpha"' "$INTRO_ZH_FILE" || r=1
grep -q '本页内容来自 alpha 分支，随时可能变更，不属于任何已发布版本' "$INTRO_ZH_FILE" || r=1
record "8b SNAPSHOT guide/introduction（中）含提示条 alpha 态" "$([ "$r" -eq 0 ] && echo '命中' || echo '未命中')" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 9. /snapshot-status.json 返回 200，且 commit 字段匹配 40 位十六进制
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/snapshot-status.json"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
status_commit=$(grep -oE '"commit"[[:space:]]*:[[:space:]]*"[0-9a-f]{40}"' "$BODY_FILE" | grep -oE '[0-9a-f]{40}' || true)
[ -n "$status_commit" ] || r=1
record "9 snapshot-status.json 可读且 commit 形状正确" "status=$HTTP_STATUS commit=${status_commit:-<无>}" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 10. /sitemap.xml 返回 200 且不含 SNAPSHOT 版本段（D-48）
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/sitemap.xml"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
grep -q '6.3.0-SNAPSHOT' "$BODY_FILE" && r=1
record "10 sitemap.xml 不含 SNAPSHOT" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 11. 对照组：/v6.2.4/guide/introduction 返回 200 且不含 noindex meta——
#     证明第 6 条测到的是注入产物的特有行为，不是全站泛化
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/v6.2.4/guide/introduction"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
grep -qi 'name="robots"[[:space:]]*content="noindex"' "$BODY_FILE" && r=1
record "11 对照组：已发布归档版本不含 noindex" "status=$HTTP_STATUS" "$r"

# ─────────────────────────────────────────────────────────────────────────────
# 12. 对照组：/guide/introduction（latest）返回 200，不含 noindex，也不含
#     提示条的任何状态 marker 或 alpha 行文案——证明这套机制没有溢出到
#     latest。
#
#     ⚠ D-59 之后这条不再是「注入溢出」方向的完整哨兵。旧的字面量检查之所以
#     是有效代理，是因为当时只有被注入的 markdown 才会产出那个字符串；提示
#     条上线后，状态由 URL 路径推导（versioning.ts 的 activeVersion 读
#     relativePath，不读 frontmatter），所以一个被误注入到 latest 的页面
#     仍会被分类成 current release、渲染不出任何节点——这条断言测不出那种
#     误注入。接手这个方向的是 build-with-alpha job 里注入后对
#     `git status --porcelain -- docs/src docs/archive` 的产物断言
#     （check-rendered-links.sh 第 7 节，由 04-05 落在 docs-ci.yml 里）。
#
#     ⚠ 那不是同一个观测面，不要读成「这个方向已经被完整覆盖了」：第 7 节看的是
#     CI 工作树，本条看的是 Cloudflare Pages 实际服务出来的响应，而本仓库只有
#     本条看后者。任何不改动 CI runner 上源码树就能到达已部署 latest 页面的东西
#     ——构建后往 .vitepress/dist/guide/ 里的拷贝、一次路由或 _redirects 改动、
#     一份陈旧的 Pages 产物——两条都观测不到。
#
#     内容层面的溢出在已部署 HTML 上没有可靠字面量可抓：状态由 URL 推导，而
#     alphaCommit / alphaInjectedAt 这两个 frontmatter 键实测在渲染产物里零命中
#     （SNAPSHOT 页面自己也是 0，见 04-REVIEW-FIX），所以对它们写一条零命中断言
#     只会得到一条永远不会变红、也配不出正控制的假门禁。本条因此只断言它真能
#     断言的那一半：当前发布版页面上不存在任何未发布信号。这个零命中不是孤立的
#     ——第 7a/7b/8a/8b 条已在同一次运行里、同一个已部署站点上，四次证明
#     data-ut-version-state 这个 marker 在这个观测通道里是抓得到的。
#
#     __VP_SITE_DATA__ 是本条自己的正向对照——每个构建产物页面都会内嵌它，
#     缺失说明抓取失败或响应被截断，否则下面两条零命中的断言会在这种情况
#     下同样报 PASS，而不是因为页面真的干净。
# ─────────────────────────────────────────────────────────────────────────────
fetch "$BASE_URL/guide/introduction"
r=0
[ "$HTTP_STATUS" = "200" ] || r=1
grep -q '__VP_SITE_DATA__' "$BODY_FILE" || r=1
grep -qi 'name="robots"[[:space:]]*content="noindex"' "$BODY_FILE" && r=1
grep -q 'data-ut-version-state=' "$BODY_FILE" && r=1
grep -q 'This page describes the alpha branch and may change at any time' "$BODY_FILE" && r=1
record "12 对照组：latest 不含 noindex 也不含提示条未发布信号" "status=$HTTP_STATUS" "$r"

echo
if [ "$status" -eq 0 ]; then
  echo "全部通过"
else
  echo "存在 FAIL，见上方"
fi
exit "$status"
