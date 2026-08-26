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
#
# 沿用 Phase 7 的三处既有修正：
#   1. 先 tr -d '\r' —— 原脚本的 /^:::$/ 在 CRLF 文件上永不匹配，失效表现为零输出（= 通过）
#   2. 跳过容器体内的 ``` 代码块 —— 原脚本在含代码的容器上误报
#   3. 按句判定 —— 剥离列表前缀与行内代码跨度后，每个非空散文行至少算 1 句
#
# 用法：bash scripts/check-container-length.sh $(find docs/src -name '*.md')
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
      n = gsub(/[。！？]/, "&", t)
      n += gsub(/[.!?]([[:space:]]|$)/, "&", t)
      sent += (n>0 ? n : 1)
      bold += gsub(/\*\*/, "&", t) / 2
      dash += gsub(/——/, "&", t) + gsub(/—/, "&", t)
    }
    END { exit (found ? 1 : 0) }
  '
  if [ $? -ne 0 ]; then overall=1; fi
done
exit $overall
