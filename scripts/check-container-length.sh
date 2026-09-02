#!/usr/bin/env bash
# 逐个 ::: 容器块统计「散文行数」与「句数」，按 AGENTS.md:77「需要带标题，正文一到三句」
# 与 AGENTS.md:25「3 行」两个口径的交集判定。exit 1 当且仅当存在违规块，供 CI 门禁使用。
#
# 相对 .planning/phases/07-a/container-check.sh（Phase 7 产出，未随仓库分发）新增：
#   4. 排除 API 参考页的结构容器 —— docs/src/{,zh/}api/ 下、且容器类型为 tabs 或 info 时跳过，
#      这类容器是方法签名／版本切换块，天然超过 3 行 3 句，不适用「正文一到三句」（D-10）。
#      注意排除条件是「路径 + 类型」组合，不是路径单独排除（api/ 下仍有需要检查的短提示框）
#      也不是类型单独排除（其他页面的 ::: info 短提示仍需检查）。
#   5. exit 码修正 —— Phase 7 原脚本的 END 块不判断是否存在违规，永远 exit 0；
#      本脚本发现任意一处违规即以非零码退出，可直接作为 CI 门禁条件。
#   6. 精确文件名豁免 ulti-tools-plugin.md 搬迁后的落点（01-02-PLAN.md）——
#      该页从 docs/src/{,zh/}api/ 搬到本 Phase 新开的讲解页目录下后，它的
#      「方法概要」:::tabs 结构容器需要继续豁免，否则搬迁本身会让门禁变红，
#      而页面正文一个字没改。这里特意用两条精确路径
#      （docs/src/guide/advanced/ulti-tools-plugin.md、
#      docs/src/zh/guide/advanced/ulti-tools-plugin.md），不用该目录加星号
#      这样的通配前缀 —— 通配前缀会把该目录下现有与将来的每一个页面都拉进
#      豁免，而这个目录里其余页面是正常的讲解页，它们的短提示框本来就该被
#      检查；精确文件名把豁免面收窄到一个已知的 javadoc 手抄页，下一个人
#      grep 这行就知道这条例外为什么存在。
#      这不是放宽门禁：豁免的对象从第 4 条起就是「javadoc 手抄页里的方法
#      签名结构容器」，api/ 这个路径只是它当年的代称，容器本身天然超过
#      3 行 3 句的事实没有变；页面正文在这次搬迁里未被触碰，改的只是它的
#      URL 与所在目录，豁免因此随文件走而不是随旧路径留下。被否掉的另一条
#      路是把这个 51 行的方法概要块拆成普通标题加表格——那更贴近
#      AGENTS.md「正文一到三句」的本意，但那是改页面正文；把这页从手抄本
#      改写成真正的讲解页已被 01-CONTEXT.md 的 Deferred Ideas 划为内容类，
#      由框架仓库的 doc-sync 驱动，不在本项目范围内，且把四个 tab 拍平成
#      四张堆叠的表反而会让页面更难读。
#
# 沿用 Phase 7 的三处既有修正：
#   1. 先 tr -d '\r' —— 原脚本的 /^:::$/ 在 CRLF 文件上永不匹配，失效表现为零输出（= 通过）
#   2. 跳过容器体内的 ``` 代码块 —— 原脚本在含代码的容器上误报
#   3. 按句判定 —— 剥离列表前缀与行内代码跨度后，每个非空散文行至少算 1 句
#
# 用法：find docs/src -name '*.md' -print0 | xargs -0 bash scripts/check-container-length.sh
#       MODE=all bash scripts/check-container-length.sh <file>   # 列出全部块，含 STRUCT/ok
set -uo pipefail
mode="${MODE:-over}"
overall=0
if [ "$#" -eq 0 ]; then
  echo "check-container-length.sh: 未收到任何文件参数，拒绝以「零违规」通过" >&2
  exit 2
fi
for f in "$@"; do
  is_api=0
  case "$f" in
    docs/src/api/*|docs/src/zh/api/*) is_api=1 ;;
    docs/src/guide/advanced/ulti-tools-plugin.md|docs/src/zh/guide/advanced/ulti-tools-plugin.md) is_api=1 ;;
  esac
  tr -d '\r' < "$f" | awk -v F="$f" -v MODE="$mode" -v IS_API="$is_api" '
    /^:::[ ]?[a-z]/ && !inb {
      inb=1; start=NR; kind=$0; lines=0; sent=0; fence=0; bold=0; dash=0
      ctype = kind
      sub(/^:::[ ]?/, "", ctype)
      sub(/[ \t].*/, "", ctype)
      skip = (IS_API=="1" && (ctype=="tabs" || ctype=="info")) ? 1 : 0
      next
    }
    inb && /^```/ { fence = !fence; next }
    inb && /^:::[[:space:]]*$/ {
      if (!skip) {
        if (lines==0) { if (MODE=="all") printf "%s:%d  STRUCT  %s\n", F, start, kind }
        else {
          bad = (lines>3 || sent>3)
          if (bad) found=1
          if (bad || MODE=="all")
            printf "%s:%d  行=%d 句=%d 粗体=%d 破折号=%d  %s  %s\n", F, start, lines, sent, bold, dash, (bad?"OVER":"ok"), kind
        }
      }
      inb=0; next
    }
    inb && !fence {
      if (NF==0) next
      lines++
      t=$0
      sub(/^[[:space:]]*[-*+][[:space:]]+/, "", t)
      sub(/^[[:space:]]*[0-9]+\.[[:space:]]+/, "", t)
      gsub(/`[^`]*`/, "X", t)
      # 粗体与破折号先计数并「摘掉」，再数句子：**First.** **Second.** 里句点后面是 *
      # 而不是空白，留着它们会让四句被数成一句然后放行
      bold += gsub(/\*\*/, "", t) / 2
      dash += gsub(/——/, "", t) + gsub(/—/, "", t)
      n = gsub(/[。！？]/, "&", t)
      n += gsub(/[.!?]([[:space:]]|$)/, "&", t)
      sent += (n>0 ? n : 1)
    }
    END { exit (found ? 1 : 0) }
  '
  if [ $? -ne 0 ]; then overall=1; fi
done
exit $overall
