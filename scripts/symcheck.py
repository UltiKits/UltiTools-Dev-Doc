#!/usr/bin/env python3
"""symcheck.py — does this module JAR reference framework symbols the target framework does not have?

列出模块字节码引用的、但目标框架 JAR 里不存在的 UltiTools 符号。

Usage / 用法:
    symcheck.py <module.jar> <UltiTools-API-<the floor you declare>.jar>

Exit code 0 means nothing is missing; 1 means something is, and the module's
declared floor is wrong (or its pin is). Anything else is a usage error.
退出码 0 表示无缺失；1 表示有，说明模块声明的地板（或它的 pin）不对。

Why this exists rather than "just rebuild and see if it compiles":
a green build only proves your *source* still compiles. What breaks a shipped
JAR is the *descriptor* recorded in its bytecode, which a compile never shows
you. This compares name+descriptor at the JVM level, which is what the JVM
actually resolves against.
之所以不能用「重新编译一下看过不过」代替：绿色构建只证明**源码**还能编译，而炸掉已发布
JAR 的是字节码里记的**描述符**，编译过程根本不显示它。这里比的是 JVM 层面的名字＋描述符。

## The one thing that makes this non-trivial / 这件事不平凡的唯一原因

A constant-pool entry names the *static receiver type at the call site*, not the
class that declares the member. Calling an inherited framework method from your
own plugin class is recorded under **your** class:

    com/example/MyPlugin.getContext:()Lcom/ultikits/ultitools/context/SimpleContainer;

`getContext` is declared on `UltiToolsPlugin`, but the owner reads `MyPlugin`.
The JVM resolves it by walking up the hierarchy at runtime — and that resolution
requires an exact name+descriptor match, so the call site breaks exactly like a
direct one would. A checker that only inspects references whose owner is already
in the framework's package therefore misses every inherited call, which in
practice means it misses the single most common shape there is.

常量池记的是**调用点的静态接收者类型**，不是声明该成员的类。在自己的插件类里调用继承来的
框架方法，owner 记的是**你的**类。JVM 运行时沿继承链上溯解析，那次解析同样要求名字＋描述符
精确匹配，所以这种调用点和直接调用一样会断。只看「owner 已经在框架包里」的引用，就会漏掉
每一个继承调用 —— 而那恰恰是最常见的形状。

So references are resolved the way the JVM does: walk the owner's supertypes
(module classes first, then framework classes) and accept the first declaration
that matches name+descriptor.
"""
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

USAGE = "用法 / usage: symcheck.py <module.jar> <UltiTools-API-<floor>.jar>"

# Read the *constant pool* (`javap -v`), not the disassembly comments (`javap -c`).
# The two print the same reference differently, and only one of them is usable:
#
#   -c   3: invokevirtual #53   // Method getContext:()Lcom/…/SimpleContainer;
#   -v  #53 = Methodref #8.#54  // com/example/MyPlugin.getContext:()Lcom/…/SimpleContainer;
#
# The `-c` form **omits the owner whenever it is the current class**, which is
# exactly the inherited-call case this script has to catch. The constant pool
# always spells the owner out. Note the keyword sits *before* the `//` there, so a
# pattern written for `-c` silently matches far less against `-v` output.
#
# 读的是**常量池**（`javap -v`）而不是反汇编注释（`javap -c`）：`-c` 在「所有者就是当前类」
# 时会省略类名，而那正是本脚本必须抓的继承调用。常量池永远写全。注意关键字在 `//` **之前**，
# 所以按 `-c` 写的正则拿到 `-v` 上会静默少匹配。
# The member name is quoted for constructors and static initialisers —
# `Owner."<init>":(…)V` — so an unquoted-only pattern drops every constructor
# reference. That matters more than it sounds: a removed *constructor* is on the
# framework's own removal list, and a checker blind to constructors answers
# "nothing missing" for exactly that removal.
# 构造器和静态初始化块的成员名是带引号的 —— `Owner."<init>":(…)V` —— 只认不带引号的
# 写法会丢掉每一个构造器引用。而框架的移除清单上就有一个构造器，对它报「无缺失」是最坏的答案。
REF = re.compile(
    r"=\s*(?:Methodref|Fieldref|InterfaceMethodref)\s+\S+\s+"
    r'//\s*([\w/$]+)\.("?[\w$<>]+"?):(\S+)'
)
# `#N = Class #M // com/foo/Bar` — a type named without touching a member
# (a cast, an instanceof, a catch clause, a supertype).
CLS = re.compile(r"=\s*Class\s+\S+\s+//\s*([\w/$;\[\]]+)")
# Types named only inside a descriptor: `()Lcom/foo/Removed;` never produces a
# Class entry of its own, so a method that merely returns a removed type would
# otherwise be invisible here.
DESC_TYPE = re.compile(r"L([\w/$]+);")


def die(msg, code=2):
    print(msg, file=sys.stderr)
    sys.exit(code)


def extract(jar, dest):
    try:
        with zipfile.ZipFile(jar) as z:
            z.extractall(dest)
    except FileNotFoundError:
        die(f"找不到 / not found: {jar}")
    except zipfile.BadZipFile:
        die(f"不是一个 JAR / not a JAR: {jar}")


def class_names(root):
    return [
        str(p.relative_to(root))[:-6].replace("/", ".")
        for p in root.rglob("*.class")
    ]


def run_javap(flags, root, names):
    """javap over every class at once. Batched because per-class spawning dominates
    the runtime on a JAR with a few hundred classes.

    A failed batch is fatal rather than skipped. Partial output here does not look
    like an error downstream — it looks like *fewer references*, which is to say a
    clean bill of health. A checker whose failure mode is "reports nothing missing"
    is worse than no checker.
    一个批次失败必须直接终止，不能跳过：这里的残缺输出在下游看起来不像错误，
    看起来像**引用更少**，也就是一份「没问题」的报告。一个失败时会报告「无缺失」的
    检查器，比没有检查器更糟。
    """
    if not names:
        return ""
    out = []
    # Keep argv under typical limits.
    for i in range(0, len(names), 400):
        batch = names[i:i + 400]
        try:
            r = subprocess.run(
                ["javap", *flags, "-cp", str(root), *batch],
                capture_output=True, text=True,
            )
        except FileNotFoundError:
            die("找不到 javap，请确认 JDK 在 PATH 上 / javap not found; is a JDK on PATH?")
        if r.returncode != 0:
            die("javap 失败，结果不可信，已中止 / javap failed, results would be "
                f"unreliable:\n{r.stderr.strip()[:800]}")
        out.append(r.stdout)
    return "\n".join(out)


KEYWORD = re.compile(r"(?:^|\s)(?:class|interface|enum|record|@interface)\s+([\w.$]+)")


def strip_generics(line):
    """Drop every <...> span, counting depth.

    A regex cannot do this. `javap` prints
    `interface DataOperator<T extends BaseDataEntity<java.lang.String>> {`
    — nested angle brackets — and `<[^>]*>` stops at the first `>`, so the whole
    declaration fails to match and the class never enters the index. "Not in the
    index" then reads as "absent from the framework", which is a missing-data bug
    wearing the costume of a finding. It reported `DataOperator` and `Query` as
    removed from a framework that plainly still has them.

    正则数不了括号。`javap` 打印的泛型是嵌套的，`<[^>]*>` 在第一个 `>` 就停，于是整行
    匹配失败、类没进索引，而「不在索引里」会被读成「框架里没有」——一个缺数据的 bug
    披着「有发现」的外衣。
    """
    out, depth = [], 0
    for ch in line:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return "".join(out)


def parse_decl(line):
    """(fqcn, [supertypes]) for a javap class-declaration line, or None.

    The clauses are sliced at keyword boundaries rather than matched with a
    character class. `extends A implements B` is one run of `[\\w.$,\\s]`, so a
    greedy match for the `extends` clause swallows the `implements` clause with it
    and indexes a supertype literally named "A implements B" — which resolves to
    nothing, so the real framework base is never reached and every inherited
    reference under that class is silently skipped. `class X extends Base
    implements Listener` is an ordinary shape, not a corner case.

    子句按关键字边界切，而不是用字符类匹配：`extends A implements B` 在
    `[\\w.$,\\s]` 看来是连续的一段，贪婪匹配 `extends` 会把 `implements` 子句一起吞掉，
    于是索引出一个名叫 "A implements B" 的父类型——它解析不到任何东西，真正的框架基类
    就够不到了，那个类底下所有继承引用都会被静默跳过。而
    `class X extends Base implements Listener` 是再普通不过的写法。
    """
    if not line.endswith("{"):
        return None
    flat = strip_generics(line)
    m = KEYWORD.search(flat)
    if not m:
        return None
    name = m.group(1)
    rest = flat[m.end():].rstrip("{ ").strip()

    marks = [(mm.start(), mm.group(1)) for mm in re.finditer(r"\b(extends|implements)\b", rest)]
    supers = []
    for idx, (pos, keyword) in enumerate(marks):
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(rest)
        chunk = rest[pos + len(keyword):end]
        supers += [s.strip() for s in chunk.split(",") if s.strip()]
    return name, supers


def index(root, names):
    """{fqcn: (supertypes, {(member_name, descriptor)})} for every class in the JAR."""
    text = run_javap(["-p", "-s"], root, names)
    table, current, pending = {}, None, None
    for raw in text.splitlines():
        line = raw.strip()
        decl = parse_decl(line)
        if decl:
            current, supers = decl
            table[current] = (supers, set())
            pending = None
            continue
        if current is None:
            continue
        if line.startswith("descriptor:"):
            if pending:
                table[current][1].add((pending, line.split(None, 1)[1]))
                pending = None
            continue
        m = re.search(r"([\w$<>.]+)\s*\(", line)          # method or constructor
        if m:
            pending = m.group(1).rsplit(".", 1)[-1]
            if pending == current.rsplit(".", 1)[-1]:
                pending = "<init>"                        # javap prints ctors by class name
        else:
            m = re.search(r"([\w$]+)\s*;\s*$", line)       # field
            pending = m.group(1) if m else None
    return table


def declares(table, fqcn, member):
    """Walk fqcn's supertypes the way the JVM resolves, returning the class that
    declares `member`, or None. Cycles cannot occur in valid bytecode but the seen
    set keeps a malformed JAR from hanging this."""
    seen, stack = set(), [fqcn]
    while stack:
        cls = stack.pop()
        if cls in seen:
            continue
        seen.add(cls)
        entry = table.get(cls)
        if entry is None:
            continue
        supers, members = entry
        if member in members:
            return cls
        stack.extend(supers)
    return None


def resolve(merged, fw_index, owner, member):
    """Resolve `member` from `owner` the way the JVM does, across both JARs at once.

    Returns one of:
      ("module", cls)  the module declares it — not a framework question
      ("framework", cls)
      ("missing", None)      the walk stayed inside known classes and found nothing
      ("unknown", cls)       the walk left both JARs, so the answer is not knowable
                             from these two inputs alone

    The last case is the one worth keeping separate. A framework class can inherit
    from something the API JAR does not bundle (a server API, a GUI library), and a
    module calling that inherited method is perfectly valid. Reporting it as
    "missing" would be a false positive, and a self-check tool that cries wolf gets
    switched off — after which it protects nothing. So an unresolved external branch
    is reported as inconclusive and does not set the exit code.

    最后一种要单独留出来。框架类可能继承自 API JAR 里没打包的东西（服务端 API、GUI 库），
    而模块调用那样一个继承来的方法完全合法。把它报成「缺失」就是假阳性，而一个会乱叫的
    自查工具会被关掉——关掉之后它什么也保护不了。所以无法解析的外部分支报为「无法判定」，
    且不影响退出码。
    """
    seen, stack, hit_unknown = set(), [owner], None
    while stack:
        cls = stack.pop()
        if cls in seen:
            continue
        seen.add(cls)
        entry = merged.get(cls)
        if entry is None:
            # A type from neither JAR: java.*, org.bukkit.*, a shaded library.
            # java.* is always present at runtime and never the question here.
            if not cls.startswith(("java.", "javax.")):
                hit_unknown = hit_unknown or cls
            continue
        supers, members = entry
        if member in members:
            return ("framework" if cls in fw_index else "module"), cls
        stack.extend(supers)
    return ("unknown", hit_unknown) if hit_unknown else ("missing", None)


def touches_framework(merged, fw_index, fqcn):
    """True when fqcn or any of its supertypes is a framework class — i.e. a
    reference under this owner can legitimately resolve into the framework.

    Walks the merged table, so an intermediate module base class
    (`MyPlugin -> ModuleBase -> UltiToolsPlugin`) does not break the chain.
    走合并表，所以中间隔着一层模块自己的基类时链条不会断。
    """
    seen, stack = set(), [fqcn]
    while stack:
        cls = stack.pop()
        if cls in seen:
            continue
        seen.add(cls)
        if cls in fw_index:
            return True
        entry = merged.get(cls)
        if entry:
            stack.extend(entry[0])
    return False


def main():
    if len(sys.argv) != 3:
        die(USAGE)
    mod_jar, fw_jar = sys.argv[1], sys.argv[2]

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="symcheck-"))
    try:
        mod_d, fw_d = tmp / "mod", tmp / "fw"
        extract(mod_jar, mod_d)
        extract(fw_jar, fw_d)

        mod_names, fw_names = class_names(mod_d), class_names(fw_d)
        if not mod_names:
            die(f"{mod_jar} 里没有 .class / contains no classes")
        if not fw_names:
            die(f"{fw_jar} 里没有 .class / contains no classes")

        mod_index = index(mod_d, mod_names)
        fw_index = index(fw_d, fw_names)

        # Module entries win a name clash: a module class shadowing a framework one
        # is what the module's own bytecode was compiled against.
        merged = {**fw_index, **mod_index}

        disasm = run_javap(["-p", "-v"], mod_d, mod_names)
        refs = sorted({(o, n.strip('"'), d) for o, n, d in REF.findall(disasm)})
        type_refs = set(CLS.findall(disasm))

        missing_types, missing_members, inconclusive, checked = [], [], [], 0
        # Three sources, because each one alone has a blind spot: a bare Class entry
        # (casts, catch clauses), the owner of a member reference, and the types
        # spelled inside descriptors — the last covers a method that merely returns
        # a framework type without ever constructing or casting it.
        named_types = set(type_refs) | {owner for owner, _, _ in refs}
        for _, _, desc in refs:
            named_types |= set(DESC_TYPE.findall(desc))
        for _, entry in mod_index.items():
            for _, d in entry[1]:
                named_types |= set(DESC_TYPE.findall(d))

        for slash in sorted(named_types):
            dotted = re.sub(r"^\[+L?|;$", "", slash).replace("/", ".")   # unwrap array descriptors
            if dotted.startswith("com.ultikits.ultitools.") and dotted not in fw_index:
                missing_types.append(dotted)
        missing_type_set = set(missing_types)

        for owner_slash, name, desc in refs:
            owner = owner_slash.replace("/", ".")
            if not touches_framework(merged, fw_index, owner):
                continue          # nothing in this reference's hierarchy is ours
            checked += 1
            # The owner class itself is gone — already reported as a missing type,
            # and reporting every member on top of it is noise, not information.
            if owner in missing_type_set:
                continue
            kind, where = resolve(merged, fw_index, owner, (name, desc))
            if kind in ("module", "framework"):
                continue
            if kind == "unknown":
                inconclusive.append(f"{owner}.{name}:{desc}  （链上有本次比对之外的类 "
                                    f"/ hierarchy leaves both JARs at {where}）")
                continue
            missing_members.append(f"{owner}.{name}:{desc}")

        print(f"模块 / module:    {pathlib.Path(mod_jar).name}")
        print(f"目标框架 / target: {pathlib.Path(fw_jar).name}")
        print(f"解析到框架的引用 / references resolving into the framework: {checked}")
        print()
        print("── 引用了但目标框架里没有的 / referenced but absent ──")
        for t in missing_types:
            print(f"  [缺类 missing type]   {t}")
        for m in missing_members:
            print(f"  [缺成员 missing member] {m}")
        if not missing_types and not missing_members:
            print("  （无 / none）")
        if inconclusive:
            print()
            print("── 无法判定 / inconclusive（不影响退出码 / does not affect the exit code） ──")
            for i in inconclusive:
                print(f"  {i}")
        print()

        total = len(missing_types) + len(missing_members)
        print(f"缺失合计 / total missing: {total}")
        if total:
            print()
            print("先分清是「被移除」还是「描述符变了」，这决定了修法：")
            print("First tell a removal apart from a descriptor change — the fix differs:")
            print("  · 符号在目标框架里**整个没有**（这个名字一个重载都不剩，或类没了）")
            print("    → 多半是一次移除，见该版本的移除清单，需要**改源码迁移**")
            print("      likely a removal: check that release's removal list; you have a migration")
            print("  · 同名符号**还在**、只是描述符不同 → 是描述符变更，再看它写的是哪一代类型：")
            print("      · 新类型（如 BaseDataEntity）→ 产物比声明的地板新，**抬 api-version**，pin 不动")
            print("      · 旧类型（如 AbstractDataEntity）→ pin 没跟上，**抬 pin 并重编**")
            print()
            print("  注意：本工具只拿到「模块 JAR + 一个框架 JAR」，看不到你的 pin，")
            print("  也无法替你区分上面两种；上面是判读方法，不是自动结论。")
            print("  This tool sees one module JAR and one framework JAR — not your pin —")
            print("  so the above is how to read the output, not a verdict it can reach for you.")
        return 1 if total else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
