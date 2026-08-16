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
REF = re.compile(
    r"=\s*(?:Methodref|Fieldref|InterfaceMethodref)\s+\S+\s+"
    r"//\s*([\w/$]+)\.([\w$<>]+):(\S+)"
)
# `#N = Class #M // com/foo/Bar` — a type named without touching a member
# (a cast, an instanceof, a catch clause, a supertype).
CLS = re.compile(r"=\s*Class\s+\S+\s+//\s*([\w/$;\[\]]+)")


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
    the runtime on a JAR with a few hundred classes."""
    if not names:
        return ""
    out = []
    # Keep argv under typical limits.
    for i in range(0, len(names), 400):
        r = subprocess.run(
            ["javap", *flags, "-cp", str(root), *names[i:i + 400]],
            capture_output=True, text=True,
        )
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
    """(fqcn, [supertypes]) for a javap class-declaration line, or None."""
    if not line.endswith("{"):
        return None
    flat = strip_generics(line)
    m = KEYWORD.search(flat)
    if not m:
        return None
    name = m.group(1)
    rest = flat[m.end():].rstrip("{ ").strip()
    supers = []
    for clause in ("extends", "implements"):
        hit = re.search(rf"\b{clause}\s+([\w.$,\s]+)", rest)
        if hit:
            supers += [s.strip() for s in hit.group(1).split(",") if s.strip()]
    # `extends`/`implements` keywords survive the split above when a type list runs
    # into the next clause; drop them rather than indexing a class called "implements".
    return name, [s for s in supers if s not in ("extends", "implements")]


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


def reaches_framework(mod_index, fw_index, fqcn):
    """True when fqcn or any of its supertypes is a framework class — i.e. a
    reference under this owner can legitimately resolve into the framework."""
    seen, stack = set(), [fqcn]
    while stack:
        cls = stack.pop()
        if cls in seen:
            continue
        seen.add(cls)
        if cls in fw_index:
            return True
        entry = mod_index.get(cls)
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

        disasm = run_javap(["-p", "-v"], mod_d, mod_names)
        refs = sorted(set(REF.findall(disasm)))
        type_refs = sorted(set(CLS.findall(disasm)))

        missing_types, missing_members, checked = [], [], 0
        # Owners of member references count as referenced types too — a type can be
        # reachable through a member reference without ever getting its own Class entry.
        named_types = set(type_refs) | {owner for owner, _, _ in refs}
        for slash in sorted(named_types):
            dotted = re.sub(r"^\[+L?|;$", "", slash).replace("/", ".")   # unwrap array descriptors
            if dotted.startswith("com.ultikits.ultitools.") and dotted not in fw_index:
                missing_types.append(dotted)
        missing_type_set = set(missing_types)

        for owner_slash, name, desc in refs:
            owner = owner_slash.replace("/", ".")
            # Declared by the module itself → not a framework question at all.
            if declares(mod_index, owner, (name, desc)):
                continue
            # Owner neither is nor extends anything in the framework → not ours.
            if not (owner in fw_index or reaches_framework(mod_index, fw_index, owner)):
                continue
            checked += 1
            # The owner class itself is gone — already reported as a missing type,
            # and reporting every member on top of it is noise, not information.
            if owner in missing_type_set:
                continue
            if declares(fw_index, owner, (name, desc)):
                continue
            # Inherited call: the owner is a module class, so resolution has to
            # continue into the framework through its supertypes.
            found = False
            entry = mod_index.get(owner)
            if entry:
                for parent in entry[0]:
                    if declares(fw_index, parent, (name, desc)):
                        found = True
                        break
            if not found:
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
        print()

        total = len(missing_types) + len(missing_members)
        print(f"缺失合计 / total missing: {total}")
        if total:
            print()
            print("两类成因，修法相反 —— 看缺失符号里写的是哪一代类型：")
            print("Two causes, opposite fixes — read which generation of type the symbol names:")
            print("  · 新类型 / the newer type  → 产物比声明的地板新，**抬 api-version**，pin 不动")
            print("                                the artifact outran its declared floor: raise api-version")
            print("  · 旧类型 / the older type  → pin 停在老版本没跟上，**抬 pin 并重编**")
            print("                                the pin lagged: raise the pin and rebuild")
        return 1 if total else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
