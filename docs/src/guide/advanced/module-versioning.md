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
MINOR or PATCH. Nothing resolves a module from Maven, and no module is linked
against by anything — modules are not published to a Maven repository and do not
depend on one another.

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

- Compiled against an **older** API → the module provably uses only what existed
  in that version → it **cannot** hit `NoSuchMethodError` for referencing an API
  newer than the server provides. It can still hit one for a *different* reason —
  see the warning below.
- Compiled against a **newer** API → it may reference a method the server's
  framework does not have → `NoSuchMethodError` on startup.

That is a guarantee about one failure mode, not about forward compatibility in
general: a later framework release can still remove — or silently reshape —
something the module uses. See the warning below.

So a pin that lags the latest release is **the normal state, not drift waiting
to be fixed**.

**Raise the pin only when the module actually starts using a newer API.**

One thing the pin is *not*, despite how it reads: your runtime floor. These are
two independent numbers, and only one of them is enforced.

| Number | Decides | Checked by |
|---|---|---|
| `UltiTools-API` version in `pom.xml` | which version's **descriptors your bytecode records** | nobody — it is `provided`, never enters your JAR, and the framework cannot see it at runtime |
| `api-version` in `plugin.yml` | the declared runtime **minimum** | `PluginManager.isUltiToolsVersionCompatible` — the only value checked before a module is admitted |

Raising the pin therefore does *not* raise the floor. Keeping the two out of sync
is how a JAR gets admitted onto a framework it cannot actually run on.

::: warning The risk that runs the other way
An old pin buys you the guarantee above and nothing else. Two things can still
break a module whose own code never changed.

**Shape 1 — an API it uses gets removed.** The framework's MINOR releases *may
remove* API (again, see `COMPATIBILITY.md`). Which linkage error you get depends
on what went: a removed **type** gives `NoClassDefFoundError`, while a removed
**method, constructor or field** gives `NoSuchMethodError` / `NoSuchFieldError`.
The second case is not hypothetical — the current removal list includes a
constructor, not just types.

Raising the pin does not **prevent** this — the class is gone from the runtime
whatever you compiled against — but it does **surface** it: the module stops
compiling, so you find out at build time instead of on someone's server. The cost
lands only if you *ship* the raised pin: building against a newer framework can
record newer descriptors, which means honestly raising `api-version` too, which
drops every server still on an older framework. Which makes raising the pin a
useful *sweep* and a poor *fix*: bump it in a scratch build, see what fails to
compile, migrate off those APIs, then decide separately whether the released pin
should move.

**Shape 2 — a method it calls keeps its name and changes its descriptor.** This
one is nastier, because nothing is removed and there is nothing to deprecate. It
has already happened: in 6.1.1 → **6.2.0** the framework changed the *type of a
field* on `UltiToolsPlugin`, so the Lombok-generated `getContext()` changed
return type. A return type is part of the JVM method descriptor, so every
already-compiled module calling it got `NoSuchMethodError`. Whether the **source**
also broke depends on how you called it: `getContext().getBean(X.class)` never
names the return type and keeps compiling, but assigning the result to the old
type — or overriding the method — does not.

The defence is different for each shape. For shape 1 it is **following
deprecation notices** — reading the removal list and migrating before the removal
ships.

Shape 2 has no notice to follow, and **no free fix**. Rebuilding is not enough on
its own: with the pin still at the old version, the build regenerates the *old*
descriptor and the new artifact fails exactly as before. So you must **raise the
pin to a framework version carrying the new descriptor and rebuild**.

That is still only half of it — and, per the table above, the half nobody checks.
The rebuilt JAR now records the *new* descriptor, so it will throw
`NoSuchMethodError` on frameworks *older* than that one. If `api-version` stays
where it was, an old server happily admits the new JAR and then breaks on the
first call. **Raise `api-version` to match.** One artifact cannot serve both sides
of a descriptor change: either accept the higher floor (older servers stay on the
older JAR) or ship separate artifacts per framework range.

This is the one case where "a lagging pin is the normal state" does not apply.
That rule says don't move the pin *without a reason*; a descriptor change is a
reason. And since the version policy only schedules *intentional* removals, an
accidental descriptor change is by definition unscheduled — no version level,
PATCH included, is exempt from it.
:::

## Current state of the modules

Most modules still sit at `1.0.0` because they have had no release requiring a
decision. Two made a call before this page existed and reached opposite
conclusions — one used MINOR for a bug fix, the other MAJOR for a new feature.
Neither matches the table above. They are being reconciled per module rather
than renumbered retroactively, because a published version number is something
server owners may already have written down.
