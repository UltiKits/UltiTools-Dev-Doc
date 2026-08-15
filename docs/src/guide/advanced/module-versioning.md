# Module Versioning

This page is about the version number **your module** carries. It is not about
`UltiTools-API`'s own version number, which follows a different contract — see
[Why modules differ from the framework](#why-modules-differ-from-the-framework).

## One question decides the number

> **After the server owner swaps in the new JAR, do they have to do anything?**

Everything below follows from that.

| | Meaning | What the server owner does |
|---|---|---|
| **MAJOR** | The upgrade needs a human | Edit config by hand · migrate data · re-learn a command or permission node that was renamed or removed |
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
- [ ] All three no, but there is new functionality? → **MINOR**
- [ ] All three no, and no new functionality? → **PATCH**

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

## The `UltiTools-API` pin is a floor, not a freshness indicator

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
  in that version → it **cannot** hit `NoSuchMethodError` for reaching at
  something newer than the server has.
- Compiled against a **newer** API → it may reach for a method the server's
  framework does not have → `NoSuchMethodError` on startup.

That is a guarantee about one failure mode, not about forward compatibility in
general: a later framework release can still remove something the module uses.
See the warning below.

So a pin that lags the latest release is **the normal state, not drift waiting
to be fixed**. It states "this module needs the framework to be at least X",
which is the same claim the module's `plugin.yml` `api-version` makes.

**Raise the pin only when the module actually starts using a newer API.**

::: warning The risk that runs the other way
The framework's MINOR releases *may remove* API (again, see `COMPATIBILITY.md`).
A module pinned to an old version that uses a since-removed type will fail with
`NoClassDefFoundError` on a server running the newer framework.

Raising the pin does not **prevent** this — the class is gone from the runtime
whatever you compiled against — but it does **surface** it: the module stops
compiling, so you find out at build time instead of on someone's server. The
cost is that the pin is also the floor, so raising it drops every server still
on an older framework.

Which makes raising the pin a useful *sweep* and a poor *fix*: bump it in a
scratch build, see what fails to compile, migrate off those APIs, then decide
separately whether the released pin should move. The actual defence is
**following deprecation notices** — reading the removal list and migrating
before the removal ships.
:::

## Current state of the modules

Most modules still sit at `1.0.0` because they have had no release requiring a
decision. Two made a call before this page existed and reached opposite
conclusions — one used MINOR for a bug fix, the other MAJOR for a new feature.
Neither matches the table above. They are being reconciled per module rather
than renumbered retroactively, because a published version number is something
server owners may already have written down.
