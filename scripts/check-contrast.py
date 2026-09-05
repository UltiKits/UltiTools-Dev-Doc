#!/usr/bin/env python3
"""check-contrast.py — does functions/api/_shared/palette.js's OVERRIDE_BLOCK
actually stay readable in both light and dark mode (D-24)?

Usage / 用法:
    check-contrast.py <file> [file...]

Exit codes: 0 = every checked pair meets its WCAG threshold. 1 = at least one
pair does not (a real contrast violation). 2 = usage error, or one of this
script's own self-checks failed — see "Self-checks" below.
退出码：0 = 全部达标；1 = 存在真实的不达标色对；2 = 用法错误，或本脚本自身的
某条自检未通过（见下文「自检」）。

## What this reads / 输入来源

The input is source text — the literal constants written into
functions/api/_shared/palette.js's OVERRIDE_BLOCK — not a rendered page or a
screenshot. That source text is split into a light table and a dark table by
locating four marker comments (`palette-table:light:begin/end`,
`palette-table:dark:begin/end`) and taking the text between each begin/end
pair, and each table's `--custom-property: value;` declarations are parsed
with a regex. This works identically whether the file handed to it is the
real .js file (where the declarations sit inside a JS template literal and
the markers are `//` line comments) or one of the two plain .css fixtures
below (where the markers are `/* ... */` comments), because both the marker
search and the declaration regex only care about the literal substrings and
declaration lines themselves, not what comment syntax surrounds them.

This gate used to split on the literal `prefers-color-scheme: dark` media
query string instead of markers — coupling the gate to one specific
trigger for the dark table (G-02-8 needed to add a second trigger, a
class selector, which would have been silently miscounted by that split).
The assertion that used to live here ("does a dark-mode trigger exist at
all") moved to scripts/verify-api-proxy.sh, which checks it against the
real bytes this repository serves rather than against source text — see
that script's own items for the media-query and class-selector assertions.

## Why Python, not bash/awk / 为什么用 Python 而不是 bash/awk

WCAG's relative-luminance formula needs a `^2.4` gamma-correction exponent.
Python's `**` operator supports this natively; awk would need to spell it out
as `exp(2.4 * log(x))`, which is both harder to read and easier to get wrong
in a way that still runs. The repository's one existing precedent for
"needs algorithmic computation, not just line/character counting"
(scripts/symcheck.py) is also Python — this follows the same lineage rather
than inventing a third scripting language for the same kind of problem.
Everything here is standard library; no dependency is installed for this.

## Why the `distinct` tier has no ratio threshold / 为什么 distinct 层不套阈值

Three pairs (odd/even table rows, section background vs. page background,
subnav background vs. navbar background) exist only to catch two values that
render as the SAME color, not to enforce a specific amount of visual
separation. Upstream javadoc's own default odd/even row contrast is only
about 1.13:1 — deliberately subtle — and forcing a 3:1 floor onto that
relationship would produce a jarringly high-contrast striped table that no
longer looks like the rest of this site. The actual failure this tier
guards against is the one this site's own main.css produces if you're not
careful: in dark mode, `--vp-c-bg` and `--vp-c-bg-soft` are BOTH `#000000`
(main.css:117 & :120) — copy that pairing literally into the override block
and two variables that are supposed to look different become pixel-
identical. `distinct` therefore just asserts inequality; `body` and
`nontext` are the tiers that carry an actual WCAG ratio floor.

## Why five fixture files exist / 五份样例存在的理由

A brand-new gate that reports "0 violations" looks EXACTLY the same in a CI
log whether it genuinely read every declaration and found them all
compliant, or whether it silently parsed nothing and therefore had nothing
to fail on. Those two outcomes are indistinguishable from the passing output
alone. The only way to tell them apart is to also feed the gate inputs that
MUST fail each of its checks, one at a time, and confirm each actually does.
Each fixture below proves a distinct thing this gate could otherwise be
quietly emptied out of:

- palette-contrast-clean.css — a real, WCAG-compliant palette. Must exit 0
  with no FAIL lines; also the base every other fixture below is a minimal
  edit of.
- palette-contrast-violation.css — clean.css with exactly ONE value changed
  (light-mode --link-color) to something visibly, deliberately
  non-compliant. Proves the gate reads the line it changed and computes
  that one pair, not that it reacts to "garbage in" generically.
- palette-contrast-duplicate-marker.css — a repeated table-boundary marker
  comment. Proves self-check 4 catches ambiguous table boundaries instead
  of letting `text.find()` silently pick the wrong occurrence.
- palette-contrast-name-mismatch.css (G-02-18) — clean.css with one
  PAIRS-unreferenced declaration added to each table, same count, different
  name sets. Proves self-check 2 compares the two tables' declared NAMES,
  not merely how many declarations each has.
- palette-contrast-out-of-range.css (G-02-22) — clean.css with
  --border-color ADDED to both tables, light-mode carrying an out-of-range
  rgb() channel (999) and dark-mode a valid one. Not a single-value edit of
  an existing variable, and deliberately not on --link-color: --border-color
  is one of the six properties palette.js declares that PAIRS never
  references, so this fixture only exits 2 if self-check 5 walks EVERY
  declaration rather than just the 27 PAIRS-referenced names. It has to be
  added to both tables because self-check 2 compares the two tables' declared
  name sets, and a name present in only one would trip that check first —
  same exit code, wrong cause. Proves self-check 5 catches a channel value
  CSS could only render by clamping it into a different number than the one
  written in the file. The fixture's own header carries the full argument;
  the CI assertion that pins the reported name to --border-color is in
  docs-ci.yml (G-02-23).

## Why reject an out-of-range rgb() channel, not clamp it / 为什么拒绝越界
## 通道而不是钳制它到 0-255（G-02-22）

CSS clamps an out-of-range rgb() channel to 0-255 at render time, so
clamping here would be closer to what a browser actually shows. Rejecting
it instead — ending the run at exit 2 — was chosen for three measured
reasons:

1. Clamping lets exactly the class of typo this gate exists to catch back
   in, just at different numbers. Measured: `rgb(999, 0, 0)` against white
   computes to 4.9269:1 taken literally (passes the 4.5:1 `body` threshold)
   but 3.9985:1 once clamped to `rgb(255, 0, 0)` (fails it). A gate that
   clamps would report this palette compliant; a gate that rejects reports
   it as exactly what it is — a channel value nobody could have meant.
2. Clamping means the gate silently rewrites its own input: the number in
   its report is no longer the number written in the file, and the entire
   value of this gate comes from "it reports what it actually read".
3. An out-of-range channel isn't a color to begin with — the formula
   itself says so. Measured: `rgb(-5, 0, 0)` against white computes to
   21.1364, above 21.0, the theoretical maximum contrast ratio the WCAG
   formula can produce (pure black against pure white). A value that pushes
   the formula past its own ceiling has left the domain the formula was
   defined over.

Exit code 2, not 1, for the same reason self-check 1 through 4 already use
2: this script's exit codes split on "did this run produce a trustworthy
answer", not on "is the input good CSS". 1 means two well-formed colors
were compared and one pair did not meet its threshold. 2 means this run
cannot produce a trustworthy answer at all — self-check 1 already lives on
that side for judging the PALETTE's content (a name PAIRS references that
doesn't resolve to a color), not just this script's own content. An
out-of-range channel belongs there too: it is malformed input, not a
compliant-or-not color.

rgba() is out of scope for this check, same as it is for the rest of this
gate (see RGB_RE's own comment): it never resolves to an (r, g, b) triple
via parse_color, so it never produces a ratio, and there is no
measured-vs-rendered divergence to guard against — an out-of-range rgba()
channel is invisible to this gate exactly as an in-range one already is.

## Self-checks / 自检

Five conditions each end the run with exit 2 and an explanation, rather
than a silent pass, because each is a way this gate could be quietly
emptied out without ever printing a FAIL line:

1. The pairing table (PAIRS, below) references a custom-property name that
   isn't found as a parseable color in the light and/or dark table. A typo
   in either the override block or this script's own pairing table would
   otherwise just skip that pair — indistinguishable from "checked and
   passed".
2. The light table and the dark table do not re-declare the SAME SET of
   `--custom-property` names — not merely the same COUNT of them. The two
   blocks are supposed to re-declare the exact same set of names (see
   palette.js's own header comment on why); equal counts do not imply equal
   name sets. This is not a hypothetical: the real palette.js's dark table
   declares 33 properties, of which PAIRS only references 27 — the
   remaining six (--block-font-family, --body-font-family, --border-color,
   --code-font-family, --copy-icon-brightness, --table-border-color) exist
   only to satisfy the re-declare-everything contract, not to be checked
   for contrast. Renaming or misspelling any one of those six left both
   tables at 33 declarations each (a length comparison sees no difference)
   while that variable's dark-mode override silently disappeared — e.g.
   --border-color falls back to javadoc's own light-mode value in dark
   mode. Self-check 1 does not catch this either, since it only walks names
   PAIRS references. A count mismatch by itself still means something is
   structurally wrong with the input before any color math even starts —
   that observation is kept in the report — but the actual comparison this
   check performs is over the two name sets, not their sizes.
3. The pairing table is empty. A gate with zero pairs to check reports zero
   violations by construction, which is the same "looks fine, checked
   nothing" failure mode as #1 and #2, just at the level of this script's
   own source instead of its input.
4. Any of the four `palette-table:{light,dark}:{begin,end}` marker comments
   does not appear in the file EXACTLY once. Fewer than one means this
   script can no longer find the table boundary at all (the light/dark
   split above depends on all four being present); more than one is the
   new failure mode the marker-based split introduces in place of the old
   media-query split — a marker string copy-pasted into an explanatory
   comment, or a table accidentally duplicated, would otherwise make the
   `text.find()` calls below silently pick the wrong occurrence instead of
   raising anything. This check runs BEFORE the light/dark split (it is a
   precondition for that split to even be well-defined), even though it is
   listed fourth here to match the order the three pre-existing checks
   were written in.
5. A `rgb(...)` value in ANY declaration in either table — not just the
   ones PAIRS references — has a channel outside 0-255 (G-02-22). Walks
   the full declaration set (see self-check 2's "not just PAIRS" walk
   above for why the same wider walk matters here: self-check 1's
   PAIRS-only walk already proved to be a blind spot for the same six
   unreferenced variables an out-of-range value could just as easily hide
   in). Runs before self-check 1 in execution order (immediately after
   self-check 2, before self-check 3) precisely so an out-of-range value
   is reported as what it actually is — "this channel is out of range" —
   rather than falling through to self-check 1's "not found as a
   parseable color", which is the message a 4-digit or negative channel
   gets today (RGB_RE's digit-count-limited, sign-less pattern rejects
   those outright and parse_color returns None), true but not the actual
   reason, and without this check that None would be indistinguishable
   from a genuine typo. (A 3-digit but numerically over-255 channel is a
   third, worse shape: RGB_RE's digit count alone does not bound the
   VALUE, so that one parses "successfully" today with no failure
   anywhere — see RGB_CHANNEL_OOR_RE's own comment below.) See "Why
   reject... not clamp" above for why this ends the run at exit 2 rather
   than
   clamping the value and continuing.
"""
import re
import sys

USAGE = "usage / 用法: check-contrast.py <file> [file...]"

# Table-boundary markers (see "What this reads" above for why these replaced
# a media-query-string split). Order matters only for TABLE_MARKERS, which
# lists them in file order for self-check 4's error messages; extraction
# itself locates each begin/end pair independently.
LIGHT_BEGIN_MARKER = "palette-table:light:begin"
LIGHT_END_MARKER = "palette-table:light:end"
DARK_BEGIN_MARKER = "palette-table:dark:begin"
DARK_END_MARKER = "palette-table:dark:end"
TABLE_MARKERS = (LIGHT_BEGIN_MARKER, LIGHT_END_MARKER, DARK_BEGIN_MARKER, DARK_END_MARKER)

# Matches a line (after optional leading whitespace) that declares a custom
# property: `--name: value;`. Comment lines in palette.js use `//`, so they
# never match this — only actual declarations start with `--` at column 0
# of their (whitespace-trimmed) line.
DECL_RE = re.compile(r"^[ \t]*(--[a-z][a-z0-9-]*)[ \t]*:[ \t]*([^;]+);", re.MULTILINE)

HEX6_RE = re.compile(r"^#([0-9a-fA-F]{6})$")
HEX3_RE = re.compile(r"^#([0-9a-fA-F]{3})$")
# Deliberately no rgba(): an alpha-carrying value can't be judged for
# contrast without knowing what it's composited onto, and that "what" is
# itself another variable. palette.js's header documents why every
# alpha-bearing site token (e.g. --vp-c-gray-soft) is written here as its
# already-opaque composite instead.
RGB_RE = re.compile(r"^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$")

# Self-check 5 (G-02-22): deliberately permissive counterpart to RGB_RE
# above — any digit count, an optional leading "-", and no start/end
# anchors — because it has to catch every out-of-range shape, and those
# shapes behave differently against RGB_RE today:
#   - a channel within RGB_RE's own \d{1,3} digit-count ceiling but
#     numerically over 255 (e.g. "999" — three digits) ALREADY matches
#     RGB_RE and is accepted by parse_color literally, with no failure at
#     all: this is G-02-22's actual bug, a silently wrong contrast ratio
#     rather than a self-check catching anything.
#   - a channel with 4+ digits, or a negative channel, does NOT match
#     RGB_RE (its \d{1,3} has no digit-count headroom and no "-"), so
#     parse_color already returns None for these — but the resulting
#     failure message ("not found as a parseable color", from self-check
#     1) is misleading: the value IS an rgb() triple, just out of range.
# Matching wherever an rgb(...) substring sits inside a raw declaration
# value (not only when the whole value is exactly rgb(...)) is what makes
# this catch all three shapes uniformly. Never matches inside rgba(...):
# the literal substring "rgb(" is not present in "rgba(" (an "a" sits
# between "rgb" and "("), so an alpha-carrying value is structurally
# invisible to this pattern — see the module docstring's "Why reject...
# not clamp" section for why rgba() staying out of scope here is
# intentional, not an oversight.
RGB_CHANNEL_OOR_RE = re.compile(r"rgb\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)")

# tier: 'body' (>= 4.5:1, WCAG 2.1 SC 1.4.3), 'nontext' (>= 3:1, SC 1.4.11),
# 'distinct' (no ratio — just asserts the two values are not identical; see
# module docstring for why this tier exists).
PAIRS = [
    ("--body-text-color", "--body-background-color", "body", "正文对页面背景"),
    ("--block-text-color", "--body-background-color", "body", "区块文字对页面背景"),
    ("--link-color", "--body-background-color", "body", "链接对页面背景"),
    ("--link-color-active", "--body-background-color", "body", "活动链接对页面背景"),
    ("--navbar-text-color", "--navbar-background-color", "body", "导航栏文字对导航栏背景"),
    ("--search-input-text-color", "--search-input-background-color", "body", "搜索框文字对搜索框背景"),
    ("--search-input-placeholder-color", "--search-input-background-color", "body", "搜索框 placeholder 对搜索框背景"),
    ("--snippet-text-color", "--snippet-background-color", "body", "代码片段文字对代码片段背景"),
    ("--selected-text-color", "--selected-background-color", "body", "选中文字对选中背景"),
    ("--selected-link-color", "--selected-background-color", "body", "选中链接对选中背景"),
    ("--invalid-tag-text-color", "--invalid-tag-background-color", "body", "废弃标签文字对废弃标签背景"),
    ("--title-color", "--body-background-color", "body", "标题对页面背景"),
    ("--body-text-color", "--section-background-color", "body", "正文对分区背景"),
    ("--body-text-color", "--detail-background-color", "body", "正文对详情区背景"),
    ("--body-text-color", "--odd-row-color", "body", "正文对表格奇数行"),
    ("--body-text-color", "--even-row-color", "body", "正文对表格偶数行"),
    ("--body-text-color", "--subnav-background-color", "body", "正文对二级导航背景"),
    ("--body-text-color", "--snippet-highlight-color", "body", "正文对代码高亮背景"),
    ("--body-text-color", "--search-tag-highlight-color", "body", "正文对搜索命中高亮背景"),
    ("--body-text-color", "--copy-button-background-color-active", "body", "正文对复制按钮活动背景"),
    ("--source-linenumber-color", "--body-background-color", "body", "源码行号对页面背景"),
    ("--selected-background-color", "--navbar-background-color", "nontext", "选中背景对导航栏背景"),
    ("--navbar-background-color", "--body-background-color", "nontext", "导航栏背景对页面背景"),
    ("--odd-row-color", "--even-row-color", "distinct", "表格奇数行对偶数行"),
    ("--section-background-color", "--body-background-color", "distinct", "分区背景对页面背景"),
    ("--subnav-background-color", "--navbar-background-color", "distinct", "二级导航背景对导航栏背景"),
]

THRESHOLDS = {"body": 4.5, "nontext": 3.0}


def parse_declarations(text):
    """Return {name: raw_value_string} for every `--name: value;` match.

    Every match is counted, including ones that don't parse as a color
    (percentages, font stacks) — the self-check that compares light vs.
    dark declaration COUNTS needs the total, not just the color subset.
    """
    decls = {}
    for m in DECL_RE.finditer(text):
        decls[m.group(1)] = m.group(2).strip()
    return decls


def parse_color(value):
    """Return an (r, g, b) int tuple if value is a 6-digit hex, 3-digit
    hex, or rgb(r, g, b) triple; otherwise None.

    No range check here on the rgb() branch (G-02-22): by the time
    check_file() calls this, self-check 5 has already walked every
    declaration in both tables and rejected any rgb() channel outside
    0-255 at exit 2. This function can therefore take RGB_RE's captured
    digits at face value — the invariant is enforced once, upstream, not
    re-checked (and not re-clamped) here.
    """
    value = value.strip()
    m = HEX6_RE.match(value)
    if m:
        h = m.group(1)
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
    m = HEX3_RE.match(value)
    if m:
        h = m.group(1)
        return tuple(int(c * 2, 16) for c in h)
    m = RGB_RE.match(value)
    if m:
        return tuple(int(x) for x in m.groups())
    return None


def relative_luminance(rgb):
    def linearize(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)


def contrast_ratio(rgb_a, rgb_b):
    l_a, l_b = relative_luminance(rgb_a), relative_luminance(rgb_b)
    lighter, darker = (l_a, l_b) if l_a >= l_b else (l_b, l_a)
    return (lighter + 0.05) / (darker + 0.05)


def fmt_color(rgb):
    return "#%02x%02x%02x" % rgb


def check_file(path):
    """Check one file. Returns (exit_code, report_lines).

    exit_code 2 means a self-check failed — report_lines is empty in that
    case, and the caller must stop immediately rather than aggregate
    anything from this file.
    """
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        print(f"check-contrast.py: cannot read {path}: {exc}", file=sys.stderr)
        return 2, []

    # Self-check 4 (see module docstring): every marker must appear exactly
    # once. Runs before the split below, since the split depends on it.
    bad_counts = []
    for marker in TABLE_MARKERS:
        count = text.count(marker)
        if count != 1:
            bad_counts.append(f"{marker!r} appears {count} time(s)")
    if bad_counts:
        print(
            f"check-contrast.py: {path}: self-check failed — table markers must "
            "each appear exactly once: " + "; ".join(bad_counts),
            file=sys.stderr,
        )
        return 2, []

    light_start = text.find(LIGHT_BEGIN_MARKER) + len(LIGHT_BEGIN_MARKER)
    light_end = text.find(LIGHT_END_MARKER)
    dark_start = text.find(DARK_BEGIN_MARKER) + len(DARK_BEGIN_MARKER)
    dark_end = text.find(DARK_END_MARKER)
    light_text = text[light_start:light_end]
    dark_text = text[dark_start:dark_end]
    light_decls = parse_declarations(light_text)
    dark_decls = parse_declarations(dark_text)

    # Self-check 2 (G-02-18): the two blocks must re-declare the SAME SET
    # of names, not merely the same count of them — see the module
    # docstring's self-check 2 for why a count match alone is not enough.
    if set(light_decls) != set(dark_decls):
        light_only = sorted(set(light_decls) - set(dark_decls))
        dark_only = sorted(set(dark_decls) - set(light_decls))
        detail_parts = []
        if light_only:
            detail_parts.append("仅浅色表声明: " + ", ".join(light_only))
        if dark_only:
            detail_parts.append("仅深色表声明: " + ", ".join(dark_only))
        print(
            f"check-contrast.py: {path}: self-check failed — light block declares "
            f"{len(light_decls)} custom properties, dark block declares "
            f"{len(dark_decls)}, but the two blocks do not re-declare the same "
            "SET of names (a count match does not imply a name match): "
            + "; ".join(detail_parts),
            file=sys.stderr,
        )
        return 2, []

    # Self-check 5 (G-02-22): every rgb() channel, in EVERY declaration in
    # either table — not just the 27 names PAIRS references — must be in
    # 0-255. Walks light_decls/dark_decls directly (raw value strings, the
    # same full-declaration walk self-check 2 above just used), not the
    # PAIRS-only walk self-check 1 below uses: self-check 1 already proved
    # that narrower walk is a blind spot for the same six unreferenced
    # variables (--block-font-family, --body-font-family, --border-color,
    # --code-font-family, --copy-icon-brightness, --table-border-color;
    # G-02-18's own finding), and an out-of-range value hiding in one of
    # those six would otherwise reach production the same way a renamed
    # one already did once. Placed here, before self-check 1, so that an
    # out-of-range value is reported as what it actually is (see
    # RGB_CHANNEL_OOR_RE's own comment for why the digit-count-in-range,
    # numerically-over-255 shape parses "successfully" today and produces
    # a silently wrong ratio instead of failing anywhere at all — that
    # shape is exactly why this check cannot simply be folded into
    # self-check 1's parseability check).
    out_of_range = []
    for table_name, decls in (("light", light_decls), ("dark", dark_decls)):
        for name in sorted(decls):
            raw = decls[name]
            for m in RGB_CHANNEL_OOR_RE.finditer(raw):
                channels = [int(g) for g in m.groups()]
                bad_channels = [c for c in channels if c < 0 or c > 255]
                if bad_channels:
                    out_of_range.append(
                        f"{table_name} {name}: {raw!r}（越界通道: "
                        + ", ".join(str(c) for c in bad_channels) + "）"
                    )
    if out_of_range:
        print(
            f"check-contrast.py: {path}: self-check failed — rgb() channel(s) "
            "outside 0-255 in a declaration (not a color CSS can render without "
            "clamping it into a different value than the one written here; see "
            "this script's own module docstring, 'Why reject... not clamp', for "
            "why this is exit 2 rather than a clamp-and-continue): "
            + "; ".join(out_of_range),
            file=sys.stderr,
        )
        return 2, []

    # Self-check 3: pairing table must not be empty.
    if not PAIRS:
        print(
            "check-contrast.py: self-check failed — the pairing table (PAIRS) is "
            "empty. A gate with nothing to check reports zero violations by "
            "construction, which looks identical to a gate that checked "
            "everything and found no problems",
            file=sys.stderr,
        )
        return 2, []

    light_colors = {n: parse_color(v) for n, v in light_decls.items()}
    light_colors = {n: c for n, c in light_colors.items() if c is not None}
    dark_colors = {n: parse_color(v) for n, v in dark_decls.items()}
    dark_colors = {n: c for n, c in dark_colors.items() if c is not None}

    # Self-check 1: every name the pairing table references must resolve
    # to a parseable color in BOTH tables.
    missing = []
    for fg, bg, _tier, _desc in PAIRS:
        for name in (fg, bg):
            if name not in light_colors and f"{name} (light)" not in missing:
                missing.append(f"{name} (light)")
            if name not in dark_colors and f"{name} (dark)" not in missing:
                missing.append(f"{name} (dark)")
    if missing:
        print(
            f"check-contrast.py: {path}: self-check failed — the pairing table "
            "references variable(s) not found as a parseable color: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        return 2, []

    lines = []
    any_fail = False
    for mode, colors in (("light", light_colors), ("dark", dark_colors)):
        for fg, bg, tier, desc in PAIRS:
            fg_rgb, bg_rgb = colors[fg], colors[bg]
            if tier == "distinct":
                ok = fg_rgb != bg_rgb
                status = "PASS" if ok else "FAIL"
                lines.append(
                    f"{status} {mode} {tier} {fg}({fmt_color(fg_rgb)}) vs "
                    f"{bg}({fmt_color(bg_rgb)}) distinct-required {desc}"
                )
            else:
                ratio = contrast_ratio(fg_rgb, bg_rgb)
                threshold = THRESHOLDS[tier]
                ok = ratio >= threshold
                status = "PASS" if ok else "FAIL"
                lines.append(
                    f"{status} {mode} {tier} {fg}({fmt_color(fg_rgb)}) vs "
                    f"{bg}({fmt_color(bg_rgb)}) = {ratio:.2f} (>= {threshold}) {desc}"
                )
            if not ok:
                any_fail = True

    return (1 if any_fail else 0), lines


def main(argv):
    if not argv:
        print(USAGE, file=sys.stderr)
        return 2

    overall = 0
    for path in argv:
        code, lines = check_file(path)
        if code == 2:
            return 2
        for line in lines:
            print(line)
        if code == 1:
            overall = 1
    return overall


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
