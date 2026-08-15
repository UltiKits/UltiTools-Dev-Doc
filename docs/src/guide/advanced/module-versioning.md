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

`UltiTools-API`'s `COMPATIBILITY.md` states that its version number is a
**product-stage signal rather than a strict semver contract** — a MINOR release
of the framework may remove an API.

That looks like an inconsistency with the rules above. It is not, and the
difference is worth understanding before anyone tries to unify the two.

The framework has **machine consumers**. Maven resolves its version. Already
compiled downstream plugins link against it at runtime. A version number that
machines act on has to answer a machine's question.

Modules have **no machine consumers at all**. No module is published to a Maven
repository. No module depends on another module. The only reader of a module's
version number is a server owner deciding whether swapping the JAR is safe.

**Same syntax, different contract, because they answer to different readers.**

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
  in that version → it runs on that version **and every later one**.
- Compiled against a **newer** API → it may reach for a method the server's
  framework does not have → `NoSuchMethodError` on startup.

So a pin that lags the latest release is **the normal state, not drift waiting
to be fixed**. It states "this module needs the framework to be at least X",
which is the same claim the module's `plugin.yml` `api-version` makes.

**Raise the pin only when the module actually starts using a newer API.**

::: warning The risk that runs the other way
The framework's MINOR releases *may remove* API (again, see `COMPATIBILITY.md`).
A module pinned to an old version that uses a since-removed type will fail with
`NoClassDefFoundError` on a server running the newer framework.

The defence against that is **following deprecation notices** — reading the
removal list and migrating before the removal ships. Raising the pin to the
latest version does **not** help with it at all: the pin controls what you
compile against, and the class is already gone from the runtime either way.
:::

## Current state of the modules

Most modules still sit at `1.0.0` because they have had no release requiring a
decision. Two made a call before this page existed and reached opposite
conclusions — one used MINOR for a bug fix, the other MAJOR for a new feature.
Neither matches the table above. They are being reconciled per module rather
than renumbered retroactively, because a published version number is something
server owners may already have written down.
