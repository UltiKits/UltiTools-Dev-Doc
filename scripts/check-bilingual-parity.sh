#!/usr/bin/env bash
# 查两件事，且两件都决定退出码——这一点与 check-version-consistency.sh 不同：那份
# 脚本第二部分的下游 pin 矩阵是纯观察，只有第一层不变式决定退出码；本脚本的两层
# 全部纳入退出码判定，因为脚本的退出码是 CI 唯一读取的信号。
#
#   1. docs/src/ 与 docs/src/zh/ 的页面树 1:1 双向比对。
#   2. docs/src/ 下每个页面都要在对应语种的 latest sidebar 里有入口。挡的是项目
#      CLAUDE.md 点名的那个静默失败——新增页面只加进一个 sidebar，切到旧版本的
#      读者看不到导航入口，且不报错。
#
# 扫描范围只含 docs/src/，不含 docs/archive/：归档不对等是已发生的历史事实（同一个
# 孤儿页在 v6.2.0 起 5 个归档树里都在），与「归档内容冻结」一致（01-CONTEXT.md D-05）。
#
# 本脚本只查「页面 → sidebar 有入口」这一个方向，不查反方向的「sidebar 入口指向
# 不存在的页面」——按 01-CONTEXT.md D-04 收窄，反方向另立。
#
# 当前抽取假设 sidebar 的 link: 值不含尾斜杠（两侧全量常量已核对过，见
# 01-RESEARCH.md Pattern 3）。以斜杠开头的 link 指向 Function 接管的运行时路由
# （如 D-30 新增的 /api/ 那条），不对应 docs/src 下的任何页面，本脚本在
# build_paths 里跳过它们；这类 link 是否真的指向一个合法的运行时路由，由
# scripts/check-sidebar-links.sh 的 RUNTIME_ROUTE_EXEMPT 精确清单负责。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# sidebar 入口覆盖检查的豁免清单。加豁免必须改这里、走 PR（01-CONTEXT.md D-06）——
# 豁免不得为了消掉一次失败而悄悄扩充。当前只有一条：
SIDEBAR_EXEMPT="index.md" # 站点首页由 nav 承载入口，不进 sidebar，中英两侧同理

parity_status=0

# 给定标题与一份（可能为空的）缩进候选清单，打印 OK/FAIL 一行，缺失时逐行列出。
# 没有缺失时也要打印 OK，不静默；这是唯一决定 parity_status 的地方之一。
report_missing() {
  local title="$1" list="$2"
  if [ -z "$list" ]; then
    echo "  OK: $title"
  else
    echo "  FAIL: $title"
    printf '%s\n' "$list" | sed 's/^/    /'
    parity_status=1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. 文件树 1:1 比对
# ─────────────────────────────────────────────────────────────────────────────

en_pages=$(find "$ROOT/docs/src" -name "*.md" -not -path "$ROOT/docs/src/zh/*" \
           | sed "s#^$ROOT/docs/src/##" | sort)
zh_pages=$(find "$ROOT/docs/src/zh" -name "*.md" \
           | sed "s#^$ROOT/docs/src/zh/##" | sort)

missing_in_zh=$(comm -23 <(printf '%s\n' "$en_pages") <(printf '%s\n' "$zh_pages"))
missing_in_en=$(comm -13 <(printf '%s\n' "$en_pages") <(printf '%s\n' "$zh_pages"))

echo "第一层：docs/src/ 与 docs/src/zh/ 页面树 1:1 比对"
echo "  EN 页数: $(printf '%s\n' "$en_pages" | wc -l)"
echo "  ZH 页数: $(printf '%s\n' "$zh_pages" | wc -l)"
report_missing "EN 有、ZH 缺失的页面" "$missing_in_zh"
report_missing "ZH 有、EN 缺失的页面" "$missing_in_en"
echo

# ─────────────────────────────────────────────────────────────────────────────
# 2. latest sidebar 入口覆盖
# ─────────────────────────────────────────────────────────────────────────────

# 按常量名锚定抽取——而非硬编码行号，常量顺序或行数一变就会让行号方案静默失效。
# 从 "^const <名>: " 那行起、到下一个 "^const " 行止，取出区间里的 link: 值。
#
# 这条管道位于 $(...) 赋值语境下：常量改名或文件结构变化会让 awk 抽出 0 条匹配，
# grep -oE 在零匹配时退出码为 1，set -e 会在后面的诊断输出与「零条」分支可达之前
# 直接终止脚本。|| true 只加在这一条管道上，把这一次可能合法的「零条」结果放行给
# 调用方去判定，不扩散到脚本其它地方——其余输入全在仓库内，不需要兜底。
#
# grep 模式锚定到行首（允许前导空格），不是在整行里找子串。两侧 sidebar 里每个真
# 实的 link: 都独占一行，所以锚定不会漏掉任何真入口；而不锚定时，任何位置出现的
# link: '<路径>' 字节序列都会被当成真入口——包括某个双引号 text: 值内部的同形字
# 符串。那种写法语法合法、无需转义，却能让一个在两侧 sidebar 都没有入口的页面被
# 判为「已覆盖」，使脚本以 0 退出。门禁静默放行比没有门禁更糟，因此锚定。
#
# 已知边界：诱饵若出现在续行的行首（例如跨行 text: 的第二行），锚定仍拦不住。要
# 彻底消除这类字符串匠气，需要改为真正解析 sidebar 常量（加载数组并遍历），而不
# 是对 .mts 源码做文本扫描。下次改动本脚本时再评估这次重写。
extract_sidebar_links() {
  local const_name="$1" file="$2"
  awk -v c="$const_name" '$0 ~ "^const " c ": " {flag=1; next} /^const /{flag=0} flag' "$file" \
    | grep -oE "^ *link: '[^']+'" | sed -E "s/^ *link: '([^']+)'/\1/" || true
}

# 抽取到 0 条 link: 视为脚本自身失效，非零退出并说明原因，而不是当作「零条缺失」
# 放行——这一条挡的是 T-01-05：sidebar 常量抽取的静默失效。诊断行把常量名与文件
# 相对路径放在同一行，调用方才分得清是这条 fail-closed 生效了，还是脚本因无关
# 原因中途死掉。
check_extraction() {
  local const_name="$1" file_abs="$2" raw="$3" rel count
  rel="${file_abs#"$ROOT"/}"
  if [ -z "$raw" ]; then
    count=0
  else
    count=$(printf '%s\n' "$raw" | wc -l)
  fi
  if [ "$count" -eq 0 ]; then
    echo "  FAIL: $const_name 在 $rel 中抽取到 0 条 link:"
    parity_status=1
  else
    echo "  $const_name 在 $rel 中抽取到 $count 条 link:"
  fi
}

# 前缀由脚本自己补，不是从 sidebar 源文件推断——sidebarGuideEN/sidebarGuideZH 内部
# 完全没有 base: 字段，这层映射来自 .vitepress/config/locale.en.mts 的多 sidebar
# 映射表：sidebarGuide* 隐含挂在 /guide/ 下。
#
# sidebarApiEN/sidebarApiZH 的抽取层已随 01-04-PLAN.md（D-18）移除——这是一次零
# 覆盖移除，不是放宽门禁。依据有两条：docs/src/api/ 与 docs/src/zh/api/ 两个目
# 录在同一 plan 里被删空，那层抽取此前覆盖的就是 0 个 docs/src/ 页面；而它抽出
# 的 sidebar link 指向的两个页面全部落在 docs/archive/ 下，本脚本 :11 已经声明
# 扫描范围不含归档树。sidebarApiEN/sidebarApiZH 两个常量本身与它们的 export 都
# 继续保留（六条归档 sidebar key 仍在消费），只是不再参与本脚本的覆盖检查。
build_paths() {
  local raw="$1" prefix="$2"
  if [ -n "$raw" ]; then
    # 以 / 开头的 link（D-30 新增的 /api/ 那条）指向 Function 接管的运行时路由，
    # 不对应 docs/src 下的任何文件——加上 prefix 会拼出一条永远匹配不到任何
    # 页面的垃圾路径，跳过它们，不计入本函数的输出。
    { printf '%s\n' "$raw" | grep -vE '^/' || true; } | sed "s#^#${prefix}#; s#\$#.md#"
  fi
}

guide_links_en=$(extract_sidebar_links "sidebarGuideEN" "$ROOT/.vitepress/config/sidebar.en.mts")
guide_links_zh=$(extract_sidebar_links "sidebarGuideZH" "$ROOT/.vitepress/config/sidebar.zh.mts")

echo "第二层：docs/src/ 下每个页面在对应语种 latest sidebar 里的入口覆盖"
check_extraction "sidebarGuideEN" "$ROOT/.vitepress/config/sidebar.en.mts" "$guide_links_en"
check_extraction "sidebarGuideZH" "$ROOT/.vitepress/config/sidebar.zh.mts" "$guide_links_zh"

covered_en=$( { build_paths "$guide_links_en" "guide/"; \
                printf '%s\n' "$SIDEBAR_EXEMPT"; } | sort )
covered_zh=$( { build_paths "$guide_links_zh" "guide/"; \
                printf '%s\n' "$SIDEBAR_EXEMPT"; } | sort )

uncovered_en=$(comm -23 <(printf '%s\n' "$en_pages") <(printf '%s\n' "$covered_en"))
uncovered_zh=$(comm -23 <(printf '%s\n' "$zh_pages") <(printf '%s\n' "$covered_zh"))

report_missing "docs/src/ 下未进入 sidebarGuideEN（豁免清单之外）的页面" "$uncovered_en"
report_missing "docs/src/zh/ 下未进入 sidebarGuideZH（豁免清单之外）的页面" "$uncovered_zh"

# 只有 parity_status 决定退出码——上面两节的所有 OK/FAIL 判定都汇入这一个变量。
exit "$parity_status"
