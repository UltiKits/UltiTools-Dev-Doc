#!/usr/bin/env bash
# Two separate things, deliberately not merged:
#
#   1. The doc-sync invariant — config.mts current == examples/pom.xml
#      ultitools.version == Maven Central <release>. These three MUST be equal,
#      and a mismatch fails the script.
#
#   2. A cross-repo view of where downstream repositories pin UltiTools-API.
#      This is OBSERVATIONAL ONLY. It never affects the exit code, because a
#      lagging pin is not a defect — see the note printed with the table.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ─────────────────────────────────────────────────────────────────────────────
# 1. The invariant
# ─────────────────────────────────────────────────────────────────────────────

# Each assignment's pipeline may legitimately fail (network down, no match, …).
# Under `set -e`, an unguarded failure here would abort the script before the
# diagnostic echoes and the -z fallback below ever run — `|| true` keeps that
# failure path reachable instead of exiting silently.
doc_ver=$(grep -oE "current: *'v[0-9]+\.[0-9]+\.[0-9]+'" "$ROOT/.vitepress/config.mts" \
          | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true
pom_ver=$(grep -oE '<ultitools\.version>[0-9]+\.[0-9]+\.[0-9]+</ultitools\.version>' "$ROOT/examples/pom.xml" \
          | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true
metadata=$(curl -sfL --connect-timeout 10 --max-time 30 \
           https://repo1.maven.org/maven2/com/ultikits/UltiTools-API/maven-metadata.xml) || true
central_ver=$(printf '%s' "$metadata" | grep -oE '<release>[^<]+</release>' \
              | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') || true

echo "必须相等（文档同步不变式）"
echo "  config.mts current : ${doc_ver:-<未找到>}"
echo "  examples/pom.xml   : ${pom_ver:-<未找到>}"
echo "  Maven Central      : ${central_ver:-<未找到>}"

invariant_status=0
# `kind` collects the same judgment as invariant_status but as a text label
# the issue-opening workflow step can branch on directly — never grepped from
# this script's Chinese stdout, which a wording tweak would silently break.
# Mirrors `parity_status` in check-bilingual-parity.sh.
kind=""
if [ -z "$doc_ver" ] || [ -z "$pom_ver" ] || [ -z "$central_ver" ]; then
  # A value that failed to parse (network down, grep pattern stopped
  # matching) is a different situation from a confirmed mismatch — the check
  # itself couldn't reach a conclusion. Nagios-style UNKNOWN vs CRITICAL.
  echo "  UNKNOWN: 三者中有值未能解析出来"
  invariant_status=2
  kind="unknown"
elif [ "$doc_ver" = "$pom_ver" ] && [ "$pom_ver" = "$central_ver" ]; then
  echo "  OK: 文档已与最新正式版同步"
else
  echo "  FAIL: 版本不一致 — 文档需要同步到 $central_ver"
  invariant_status=1
  # Direction (behind / internally mismatched / ahead) is a later phase's
  # concern — this value only proves the delivery pipe carries a real one.
  kind="broken"
fi

# Hand the same three version numbers plus `kind` to the workflow step that
# opens/updates the release-sync issue, so it never has to re-derive them by
# parsing this script's human-readable stdout above. Guarded so a developer
# running this locally (no $GITHUB_OUTPUT in the environment) is unaffected.
#
# Placement is a hard requirement, not style: the script has two exit paths
# below (the early return when `gh` is missing, and the final exit at the end
# of the file) — this write must happen before both, or a `gh`-less runner
# would silently hand the issue-opening step a set of empty values.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "doc_ver=${doc_ver:-}"
    echo "pom_ver=${pom_ver:-}"
    echo "central_ver=${central_ver:-}"
    echo "kind=${kind:-}"
  } >> "$GITHUB_OUTPUT"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. The observational matrix
# ─────────────────────────────────────────────────────────────────────────────

echo
echo "仅供观察：下游把 UltiTools-API pin 在哪个版本"

# `gh api .../contents/pom.xml` resolves the repository's DEFAULT branch on its
# own. That matters more than it looks: assuming a branch name here would be a
# silent source of wrong answers, and this project has already been bitten by
# "the default branch does not contain what you expect" more than once.
if ! command -v gh >/dev/null 2>&1; then
  echo "  跳过：未找到 gh CLI，无法读取各仓库的 pom.xml"
  echo "  （这不影响上面的不变式检查）"
  exit "$invariant_status"
fi

# Order matters only for readability; the framework is the source these all
# lag behind, so it goes first.
REPOS="UltiTools-Reborn UltiTools-External-Example ultikits-module-parent
UltiBackup UltiBot UltiChat UltiCleaner UltiEconomy UltiEssentials UltiKits
UltiLogin UltiMail UltiMenu UltiRecipe UltiRemoteBag UltiSideBar UltiSocial
UltiTrade UltiWorlds"

# Released versions in publication order, used to express a gap as "N releases
# behind" rather than as a bare inequality. Snapshots are excluded: a pin can
# never point at one.
released=$(printf '%s' "$metadata" \
           | grep -oE '<version>[^<]+</version>' \
           | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' \
           | grep -vE '\-' || true)

index_of() {
  local needle="$1" i=0
  while IFS= read -r v; do
    i=$((i + 1))
    [ "$v" = "$needle" ] && { printf '%s' "$i"; return 0; }
  done <<< "$released"
  return 1
}

central_idx=$(index_of "${central_ver:-}" || true)

extract_pin() {
  # Two shapes exist in the wild and both are read:
  #   <ultitools.version>X</ultitools.version>   — the property most modules use
  #   the <version> inside the UltiTools-API <dependency> — hardcoded, no property
  local xml="$1" pin
  pin=$(printf '%s' "$xml" | grep -oE '<ultitools\.version>[^<]+</ultitools\.version>' \
        | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^<]*' | head -1) || true
  if [ -n "$pin" ]; then printf '%s' "$pin"; return 0; fi

  pin=$(printf '%s' "$xml" \
        | tr '\n' ' ' \
        | grep -oE '<artifactId>UltiTools-API</artifactId>[^<]*<version>[^<]+</version>' \
        | grep -oE '<version>[^<]+</version>' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^<]*' | head -1) || true
  printf '%s' "$pin"
}

# Column headers are written as one caption line rather than as a padded row:
# printf pads by bytes, and a CJK label is 3 bytes per 2 display columns, so a
# %-30s header sits two columns left of the data it labels.
echo "  列：仓库 · pin · 相对最新正式版"
printf '  %-30s %-16s %s\n' "------------------------------" "----------------" "------------------"

unreadable=""
for repo in $REPOS; do
  xml=$(gh api "repos/UltiKits/$repo/contents/pom.xml" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null) || true
  if [ -z "$xml" ]; then
    unreadable="$unreadable $repo"
    continue
  fi

  # The framework does not pin itself — its pom declares the version everyone
  # else is lagging behind. Reading it with extract_pin would report "<未声明>"
  # and hide the one number the rest of the table is measured against.
  if [ "$repo" = "UltiTools-Reborn" ]; then
    own=$(printf '%s' "$xml" | grep -oE '<version>[0-9][^<]*</version>' \
          | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^<]*' | head -1) || true
    printf '  %-30s %-16s %s\n' "$repo" "${own:-<未找到>}" "源头（框架自身的版本，不是 pin）"
    continue
  fi

  pin=$(extract_pin "$xml")
  if [ -z "$pin" ]; then
    printf '  %-30s %-16s %s\n' "$repo" "<未声明>" "不依赖 UltiTools-API，或写法未被识别"
    continue
  fi

  note="—"
  case "$pin" in
    *SNAPSHOT*) note="开发版（框架自身的源头，不参与比较）" ;;
    *)
      if [ "$pin" = "${central_ver:-}" ]; then
        note="与最新正式版一致"
      elif [ -n "$central_idx" ]; then
        pin_idx=$(index_of "$pin" || true)
        if [ -n "$pin_idx" ]; then
          note="落后 $((central_idx - pin_idx)) 个正式版"
        else
          note="该版本不在 Maven Central 的发布列表里"
        fi
      fi
      ;;
  esac
  printf '  %-30s %-16s %s\n' "$repo" "$pin" "$note"
done

if [ -n "$unreadable" ]; then
  echo
  echo "  读取失败（仓库不存在、无 pom.xml，或无权限）:$unreadable"
fi

# Named explicitly rather than left out. A matrix that silently omits a row
# reads as complete, which is worse than not having the matrix — the reader
# concludes "everything is accounted for" from an incomplete picture.
echo
echo "  未覆盖：ultikits-cli 的脚手架默认值 —— 它是私有仓库，本脚本跑在公开仓库里读不到。"
echo "          发版前需要手动核对一次。"

cat <<'NOTE'

  ⚠ 这张表的用途是「让落后可见」，不是「让数字统一」。

  UltiTools-API 是 <scope>provided</scope>：模块编译时用 pin 的那个版本，运行时用
  服务器上实际装的框架。所以

    · 编译 against 旧 API = 只用了那个版本就有的东西 → 不会因为「用了新方法」而在
      旧服务器上炸（NoSuchMethodError）
    · 编译 against 新 API = 可能用到新方法 → 装了旧框架的服务器直接 NoSuchMethodError

  下游的 pin 是构建输入，不是新鲜度指标（也不是运行时地板 —— 地板是 plugin.yml 的
  api-version）。落后于最新正式版是正常状态，不需要因为落后本身去动它。

  但旧 pin 不等于「向后兼容已被证明」。下面两种是本项目实际发生过的，不是全部
  —— 完整清单见 JLS 第 13 章：

    · 框架的 MINOR 版本可以移除 API —— 还在用已移除类型的模块会 NoClassDefFoundError，
      成员被移除则是 NoSuchMethodError / NoSuchFieldError。把 pin 临时调高、跑一次构建、
      看什么编译不过，是一次有价值的排查；这一种的防线是跟进废弃通告。
      注意这次排查不保证有信号 —— 它只看得见你的源码真正写出名字的东西。有别的重载
      接住调用（m(String) 没了、m(Object) 还在），或者被删的类型只出现在推断出来的
      签名里（factory.create().run()），源码都照样编得过：排查什么都不报，而已经发
      出去的旧 JAR 仍然是坏的。那种情况下重编本身就是修复。
    · 框架也可能不移除任何东西，只改掉一个公开方法的描述符（6.1.1 → 6.2.0 就把
      getContext() 的返回类型改了）—— 已编译的 JAR 拿到 NoSuchMethodError，源码却
      可能照样编得过。这一种没有通告可跟：版本号策略排期的是有意为之的移除，无意的
      描述符变更不在排期里，PATCH 一样可能中。而且光重新编译不够 —— pin 不动，重编
      出来的还是旧描述符；必须把 pin 抬到含新描述符的版本。注意这张表里的 pin 是
      compile-time 的，它不是运行时地板 —— 地板是 plugin.yml 的 api-version，且只有
      后者会被框架检查。两个数字要一起动，否则新 JAR 会被老服务器放行然后炸掉。

  正式发布的 pin 则只在模块真的开始用新 API 时才动 —— 例外是所有非移除类的破坏：
  第二种，以及下面那个分流问题指回重建路径的其它情况（比如实例方法改 static）。
  这些情况下源码一个字没改也可能必须抬 pin 并重编。api-version 则要抬到产物真正
  需要的高度，不是机械跟着 pin 走 —— 没核实过产物引用了哪些符号时，跟 pin 对齐
  只是保守兜底。

  撞到别的链接错误（比如实例方法被改成 static，描述符没变但老字节码报
  IncompatibleClassChangeError）时，用同一个问题分流：框架是不是移除了什么？
  是 —— 它该在移除清单上，不在就是策略疏漏；否 —— 同样走上面这条重建路径，
  而如果重编就编不过，那是一次迁移不是一次重建。

  详见 https://dev.ultikits.com/zh/guide/advanced/module-versioning
NOTE

# Only the invariant decides the exit code. The matrix above is a report.
exit "$invariant_status"
