# Module Versioning

This page is about the version number **your module** carries. It is not about
`UltiTools-API`'s own version number, which follows a different contract — see
[Why modules differ from the framework](#why-modules-differ-from-the-framework).

## One question decides the number

> **After the server owner swaps in the new JAR, do they have to do anything?**

Everything below follows from that.

| | Meaning | What the server owner does |
|---|---|---|
| **MAJOR** | The upgrade needs a human | Edit config by hand · migrate data · re-learn a command or permission node that was renamed or removed · **upgrade UltiTools itself** |
| **MINOR** | New functionality, backwards compatible | Swap the JAR. Existing config keeps working; a new feature may need switching on |
| **PATCH** | Fixes and internal changes, including CI/build-only changes | Swap the JAR. Nothing else |

The reason the criterion is phrased as work rather than as "size of change" is
that the two do not correlate. Rewriting a module's internals is a PATCH if the
config file and the commands come out the same; renaming one permission node is
a MAJOR even though the diff is one line, because every server that granted that
node is now silently missing a permission.

### Checklist before bumping

- [ ] Does the server owner have to edit their config file? → **MAJOR**
- [ ] Does existing data need migrating? → **MAJOR**
- [ ] Was any command or permission node removed or renamed? → **MAJOR**
- [ ] Did `plugin.yml`'s `api-version` go up? → **MAJOR**
- [ ] All four no, but there is new functionality? → **MINOR**
- [ ] All four no, and no new functionality? → **PATCH**

The fourth one catches a case the other three miss, because nothing about the
module itself changed. Raising `api-version` means owners on the older framework
can no longer swap the JAR — they have to upgrade UltiTools first. By the
deciding question above that is a MAJOR, even when the release is a
source-unchanged rebuild — which is exactly what shape 2 in "The risk that runs
the other way" below forces you to ship.

## Why modules differ from the framework

`UltiTools-API`'s [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/alpha/COMPATIBILITY.md) states that its version number is a
**product-stage signal rather than a strict semver contract** — a MINOR release
of the framework may remove an API.

That looks like an inconsistency with the rules above. It is not, and the
difference is worth understanding before anyone tries to unify the two.

The framework's version is **resolved and linked against**. Maven resolves it to
pick an artifact. Already compiled downstream plugins link to its classes at
runtime. Both of those are compatibility questions, and a number that has to
answer a compatibility question cannot be a free-form signal.

A module's version is read by machines too, but only ever to **order two
versions**, never to judge compatibility:

| Consumer | What it does |
|---|---|
| `PluginManager.hasNewerVersionLoaded` | Two JARs of the same module present → compares versions and refuses to load the older one |
| `PluginManager.unregisterSupersededVersions` | Unloads the version the newly loaded one supersedes |
| `UpdateManager.checkModuleUpdates` | Compares the loaded version against the published one to report "an update is available" |

All three go through `VersionComparatorUtil.compare` and ask a single question:
is A greater than B. None of them looks at whether the difference was MAJOR,
MINOR or PATCH.

Nor does anything resolve one module from another: across the official modules,
none declares a Maven dependency on a sibling. (A module built as a multi-module
project — `UltiBot` is one — depends on *its own* submodules, which is internal to
that build and is not one module linking against another.) So the linkage argument
that constrains the framework's version number does not reach a module's. If you
publish your module for others to depend on, that stops being true for yours, and
you inherit the framework's problem rather than this page's.

So the split is: **the ordering is machine-consumed, the MAJOR/MINOR/PATCH
meaning is not.** That produces one hard requirement and leaves everything else
to the reader:

::: tip The one mechanical rule
Versions must increase monotonically and stay comparable. Going `1.10.0` →
`1.9.0`, or switching numbering schemes mid-stream, makes the framework load the
wrong JAR when two copies are present — silently, because the loser is simply
refused with a warning.
:::

Beyond that, the number's *shape* is a message to a server owner, which is why
its rules can differ from the framework's without either being wrong.

## The `UltiTools-API` pin is a build input, not a freshness indicator

A module declares the framework as `provided`:

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>${ultitools.version}</version>
    <scope>provided</scope>
</dependency>
```

`provided` means the module compiles against the pinned version but runs against
whatever framework is installed on the server. That asymmetry is the whole point:

- Compiled against an **older** API → every symbol the compiler wrote into the
  bytecode existed in that version, so the module does not hit `NoSuchMethodError`
  *for referencing something newer than the server provides*. It can still hit one
  for a different reason — see [the risk that runs the other
  way](#the-risk-that-runs-the-other-way).
- Compiled against a **newer** API → it may reference a method the server's
  framework does not have → `NoSuchMethodError` on startup.

Read the first bullet narrowly. It is a statement about **statically linked
references** in one direction, not a general guarantee: a later framework release
can still remove — or silently reshape — something the module uses, and anything
you reach by reflection was never covered, because the compiler never saw it.

So a pin that lags the latest release is **the normal state, not drift waiting
to be fixed**.

**Raise the pin only when the module actually starts using a newer API.**

One thing the pin is *not*, despite how it reads: your runtime floor. These are
two independent numbers, and only one of them is enforced.

| Number | Decides | Checked by |
|---|---|---|
| `UltiTools-API` version in `pom.xml` | which version's **descriptors your bytecode records** | nobody — it is `provided`, never enters your JAR, and the framework cannot see it at runtime |
| `api-version` in `plugin.yml` | the declared runtime **minimum** | `PluginManager.isUltiToolsVersionCompatible` — the only *framework version* consulted before a module is admitted |

Raising the pin therefore does *not* raise the floor. Keeping the two out of sync
is how a JAR gets admitted onto a framework it cannot actually run on.

Admission checks more than that one number — the JAR is structurally validated
first, and a module is also refused when a newer copy of itself is already loaded
(`passesCompatibilityGates` is `!hasNewerVersionLoaded && isUltiToolsVersionCompatible`).
`api-version` is the only one of those that has anything to say about *which
framework* you can run on, which is why it is the one this page is about.

## The risk that runs the other way

An old pin buys you the guarantee above and nothing else. A module whose own code
never changed can still break, because what your bytecode links against is
decided by the framework, not by you.

::: warning
A green build is not proof of compatibility. It only proves your *source* still
compiles — and what breaks a shipped JAR is the *descriptor* recorded in its
bytecode, which compiling never shows you.
:::

[The JLS's binary compatibility chapter][jls13] defines the full set of changes
that can do this, and it is longer than what follows. The two below are the ones
this project has actually shipped — **examples, not an enumeration.**

### Shape 1 — an API it uses gets removed

The framework's MINOR releases *may remove* API (see `COMPATIBILITY.md`). Which
linkage error you get depends on what went: a removed **type** gives
`NoClassDefFoundError`, while a removed **method, constructor or field** gives
`NoSuchMethodError` / `NoSuchFieldError`. The second case is not hypothetical —
the current removal list includes a constructor, not just types.

Raising the pin and rebuilding does one of two things, and you cannot tell which
until you run it:

- **It exposes the removal.** The build fails, so you find out here instead of on
  someone's server, and you migrate off the removed API.
- **It retargets the call.** Something surviving absorbs it, the build passes, and
  the rebuilt artifact is simply fixed.

Neither one repairs the JAR you **already shipped** — that keeps failing until you
publish the rebuild. Which is why the second outcome is the dangerous one: a green
build looks like "nothing to do here", when in fact you are holding the fix and
have to know to ship it.

And a green build is easy to get, because **the sweep only sees what your source
actually names.** Everything your source reaches implicitly can silently
re-resolve:

- An overload absorbs the call — `m(String)` goes away, `m(Object)` survives, your
  unchanged source recompiles against the survivor.
- The removed type was never written down — in `factory.create().run()` the return
  type of `create()` is inferred, so redirecting `create()` to a replacement type
  recompiles cleanly while the old bytecode still references the deleted one.

The cost lands only if you *ship* the raised pin: building against a newer
framework can record newer descriptors, which means honestly raising `api-version`
too, which drops every server still on an older framework. Which makes raising the
pin a useful *sweep* and a poor *fix*: bump it in a scratch build, see what fails
to compile, migrate off those APIs, then decide separately whether the released
pin should move.

**The defence for this shape is following deprecation notices** — reading the
removal list and migrating before the removal ships.

### Shape 2 — a member keeps its name and changes its descriptor

This one is nastier, because nothing is removed and there is nothing to deprecate.
A method's descriptor covers its parameter types *and its return type*, so a
change to either one produces a different symbol under the same name.

It has happened twice, and the second time is the more instructive of the two.

**6.1.1 → 6.2.0 (a MINOR).** Removing Spring changed the *type of a field* on
`UltiToolsPlugin`, so the Lombok-generated `getContext()` changed return type.
Every already-compiled module calling it got `NoSuchMethodError`. Nothing was
removed, nothing was deprecated, and the source of the change reads as an internal
cleanup. The same applies to a public field whose type changes: the compiled
`getfield` still carries the old descriptor and fails with `NoSuchFieldError`.

**6.2.0 → 6.2.1 (a PATCH).** Replacing `AbstractDataEntity` with
`BaseDataEntity<String>` across the data APIs changed the descriptors of **14
public members across 5 types** — `DataOperator`'s `exist(T)` / `getById` /
`insert(T)` / `update(T)`, `Query`'s `first()`, and their implementations. Zero
removals, zero additions; every affected member kept its name.

The PATCH is the point. A version level does not exempt anything here: the version
policy schedules *intentional* removals, so an unintended binary break is by
definition unscheduled, and PATCH is not excluded from that.

`Query.first()` is worth calling out on its own, because a list organised around
`DataOperator` would hide it: **a module that only ever writes `.query()….first()`
calls none of the `DataOperator` methods and is affected anyway.**

#### The break runs in both directions

Wherever a symbol keeps its name and changes its descriptor, neither side has the
other's version. Same module, same source, only the pin moved:

| Built against | On framework 6.2.0 | On framework 6.2.1+ |
|---|---|---|
| 6.2.0 | works | **`NoSuchMethodError`** — looks for `(AbstractDataEntity)`, already gone |
| 6.2.1 | **`NoSuchMethodError`** — looks for `(BaseDataEntity)`, not there yet | works |

So "rebuild against the newer framework" is not a repair that leaves old servers
where they were. It moves which side works. Both cells fail for the same reason
in opposite directions, which is why the fix depends on *which* type the missing
symbol names — see [Reading the output](#reading-the-output-two-causes-opposite-fixes).

#### What that forces you to ship

Rebuilding alone is not enough: with the pin still at the old version, the build
regenerates the *old* descriptor and the new artifact fails exactly as before. So,
**as long as you keep the direct call site**, you must **raise the pin to a
framework version carrying the new descriptor and rebuild**. (Route 3 below is the
way out of that "as long as".)

That is still only half of it — and, per the table above, the half nobody checks.
The rebuilt JAR now records the *new* descriptor, so it will throw
`NoSuchMethodError` on frameworks *older* than that one. If `api-version` stays
where it was, an old server happily admits the new JAR and then breaks on the
first call. **Raise `api-version` too** — which, by the checklist at the top of
this page, makes that release a MAJOR.

Raise it to what the artifact actually requires, though — not mechanically to
whatever the pin now says. Raising the pin does not by itself mean the output
needs the newer framework: if the rebuild only retargeted a call onto a member
that existed in both versions, or you bumped the pin purely to sweep, the bytecode
may still run on the old floor, and moving it would turn a compatible repair into
a MAJOR release for no reason. The next section is how to find out instead of
guessing; matching the pin is the **conservative fallback** when you have not.

### How to actually check

The question "will this JAR run on framework X" is answerable, and it is not
answered by rebuilding. Compare the symbols your bytecode references against what
that framework actually declares:

```bash
# from a checkout of UltiTools-Dev-Doc
python3 scripts/symcheck.py your-module.jar UltiTools-API-<the floor you declare>.jar
```

Exit code 0 means nothing is missing. Non-zero lists what is, and the JAR will
fail on that framework the first time it reaches one of those call sites.

Run it against **the version you declare in `api-version`**, not against the one
you pinned — those are different questions, and the first is the one your users
will hit.

#### Reading the output: two causes, opposite fixes

First tell the two shapes apart, because they need different work:

- **The name is gone entirely** — no overload of it survives, or the class itself
  is absent. That is shape 1, a removal. Check that release's removal list; you
  have a source migration, not a rebuild.
- **A symbol of the same name is still there, with a different descriptor.** That
  is shape 2, and only then does the table below apply.

For shape 2, look at which generation of type the missing symbol names:

| The missing symbol names | What it means | Fix |
|---|---|---|
| the **newer** type (e.g. `BaseDataEntity`) | the artifact outran the floor it declares | **raise `api-version`**; the pin is already fine |
| the **older** type (e.g. `AbstractDataEntity`) | the pin lagged, so the output is older than the floor | **raise the pin and rebuild**; raising `api-version` does not help and makes it worse |

Getting this backwards is easy and the two fixes point in opposite directions,
which is why it is worth reading the symbol rather than reaching for whichever
number is more convenient.

The script cannot make this call for you: it is given one module JAR and one
framework JAR, so it can see that a symbol is absent but not *why*, and it never
sees your pin at all. It reports; you diagnose.

Two more things it will tell you rather than guess about. Anything whose
supertype chain leaves both JARs — a framework class inheriting from a server API
or a GUI library the API JAR does not bundle — is listed as **inconclusive** and
does not set the exit code, because reporting a valid inherited call as missing
would be a false positive. And if `javap` itself fails, the run aborts instead of
analysing partial output, since fewer references read as a clean bill of health.

::: tip Why a script rather than `javap` by hand
`javap -s` on a single class does answer "what is this member's descriptor", but
the question you have is "does anything in this whole JAR reference a symbol that
framework does not have", which is a comparison across two artifacts.

One trap makes the hand-rolled version unreliable: a constant-pool entry names the
**static receiver type at the call site**, not the class that declares the member.
An inherited framework call from your own plugin class is recorded under *your*
class — `com/example/MyPlugin.getContext:()…` — so filtering for references that
already sit in the framework's package misses every inherited call. Which, since
plugins extend `UltiToolsPlugin`, is most of them.
:::

### When both sides have to keep working

What cannot span both sides is a *statically linked* call site — the descriptor is
baked in at compile time, so one call site matches one side. That leaves three
routes, in increasing cost:

1. **Accept the higher floor** (pick this by default). Older servers stay on the
   older JAR; the new one serves the new framework.
2. **Ship separate artifacts per framework range**, and maintain both lines.
3. **Write a shim**: call reflectively (`getMethod("getContext").invoke(plugin)`
   returns `Object`, then reach `getBean` the same way), or lazily load a
   different adapter per framework version. A reflective call site links to
   neither descriptor, so one artifact really can run on both sides. The price is
   that this path loses compile-time checking — you find out at runtime, and the
   next time the framework reshapes it you get no build warning at all.

Route 3 is genuinely available; don't rule it out just because it is listed last.
But it trades a build-time failure for a runtime one, so it earns its keep only
when you *must* keep supporting older servers.

Note what this does to "a lagging pin is the normal state". That rule says don't
move the pin *without a reason* — and a descriptor change is a reason, as is
anything the decision above routes back here.

### If your linkage error is neither shape

You have hit one of the other JLS categories — an instance method made `static`
gives `IncompatibleClassChangeError`, narrowing a member's accessibility gives
`IllegalAccessError`, and there are more. Route yourself with one question:
**did the framework remove something?**

- **Yes** → it belongs on the removal list. If it is not there, please open an
  issue; that is a policy failure, not just your problem.
- **No** → try the rebuild path above (raise pin → rebuild → raise
  `api-version`). If the rebuild *fails to compile*, the change broke source
  compatibility too, and you have a migration on your hands rather than a rebuild.

[jls13]: https://docs.oracle.com/javase/specs/jls/se21/html/jls-13.html

## Current state of the modules

Most modules still sit at `1.0.0` because they have had no release requiring a
decision. Two made a call before this page existed and reached opposite
conclusions — one used MINOR for a bug fix, the other MAJOR for a new feature.
Neither matches the table above. They are being reconciled per module rather
than renumbered retroactively, because a published version number is something
server owners may already have written down.
