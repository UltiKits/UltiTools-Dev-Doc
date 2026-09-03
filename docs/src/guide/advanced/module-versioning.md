# Module Versioning

This page describes the version number used by **your module**. `UltiTools-API` follows a different convention for its own version number, explained in [Differences from the framework's version](#differences-from-the-framework-s-version).

## Choosing the number

The deciding question is: after the server owner swaps in the new JAR, is there anything else they have to do?

| | Meaning | What the server owner does |
|---|---|---|
| MAJOR | The upgrade needs manual work | Edit configuration by hand, migrate data, learn a renamed or removed command or permission node, or upgrade UltiTools first |
| MINOR | New functionality, backwards compatible | Replace the JAR. Existing configuration keeps working; a new feature may need enabling in the configuration |
| PATCH | Fixes and internal changes, including CI and build-only changes | Replace the JAR. Nothing else |

The criterion is phrased as work rather than as size of change because the two are unrelated. Rewriting a module's internals is a PATCH as long as the configuration file and the commands stay the same, while renaming a single permission node is a MAJOR even though the change is one line, because every server that granted that node loses the permission.

### Checklist

- [ ] Does the server owner have to edit their configuration file? → MAJOR
- [ ] Does existing data need migrating? → MAJOR
- [ ] Was a command or permission node removed or renamed? → MAJOR
- [ ] Did `plugin.yml`'s `api-version` go up? → MAJOR
- [ ] None of the four, but there is new functionality? → MINOR
- [ ] None of the four, and no new functionality? → PATCH

The fourth item covers a case the first three miss, because nothing about the module itself has changed. Raising `api-version` means owners on the older framework cannot simply replace the JAR; they have to upgrade UltiTools first, which by the criterion above is a MAJOR. This holds even when the release is a rebuild with no source changes, and [Changed descriptors](#changed-descriptors) is the situation that produces such a release.

## Differences from the framework's version

`UltiTools-API`'s [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/alpha/COMPATIBILITY.md) states that its version number is a product-stage signal rather than a strict semver contract, and that a MINOR release of the framework may remove an API.

::: tip Contributing to the framework itself, not just consuming it
If you plan to open a pull request against `UltiTools-Reborn`, note its contribution language policy differs from this site's: new comments, javadoc, workflow comments, and PR titles/bodies must be English-first with Chinese as a supplement.
A CI check enforces this over `src/main` comments/javadoc, workflow files, and one test package, against a small named allowlist visible in review.
This is the framework repository's own policy, not a requirement for this bilingual documentation site.
:::

This looks inconsistent with the rules above. It is not, and the difference is worth understanding first.

The framework's version is resolved and linked against. Maven uses it to select an artifact, and already compiled downstream plugins link to its classes at runtime. Both are compatibility questions, and a number that has to answer a compatibility question cannot be a free-form signal.

A module's version is also read by machines, but only to order two versions, never to judge compatibility:

| Consumer | What it does |
|---|---|
| `PluginManager.hasNewerVersionLoaded` | Two JARs of the same module are present, so it compares versions and refuses to load the older one |
| `PluginManager.unregisterSupersededVersions` | Unloads the version that the newly loaded one supersedes |
| `UpdateManager.checkModuleUpdates` | Compares the loaded version against the published one to report that an update is available |

All three go through `VersionComparatorUtil.compare` and ask whether A is greater than B. None of them looks at whether the difference is MAJOR, MINOR or PATCH.

Nor does anything resolve one module from Maven for another module to use. None of the official modules declares a dependency on a sibling module in its pom. A module built as a multi-module project, such as `UltiBot`, depends on its own submodules, which is internal to that build rather than one module depending on another. The linkage argument that constrains the framework's version number therefore does not apply to a module's. If you publish your own module for others to compile and link against, that argument starts applying to yours: your version number now has to answer a compatibility question, so what you need is a stricter contract that preserves compatibility, not the framework's looser one.

So the split is that the order of a module's version is machine-consumed while the meaning of MAJOR, MINOR and PATCH is not. That produces one mandatory rule and leaves the rest to the author's judgement.

::: tip The one mandatory rule
Versions must increase monotonically and stay comparable. Going from `1.10.0` back to `1.9.0`, or switching numbering schemes partway through, makes the framework load the wrong JAR when two copies are present, with no clear indication: the losing one is simply refused with a warning in the log.
:::

Beyond that, the shape of the number is a message to the server owner, which is why its rules can differ from the framework's without either being wrong.

## The `UltiTools-API` pin

A module declares the framework as `provided`:

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>${ultitools.version}</version>
    <scope>provided</scope>
</dependency>
```

`provided` means the module compiles against the pinned version and runs against whatever framework is installed on the server. That asymmetry is central to how this works:

- Compiled against an older API, every symbol the compiler wrote into the bytecode exists in that version, so the module does not get a `NoSuchMethodError` for referencing something newer than the server provides. It can still get one for other reasons, described in [Compatibility breaks caused by the framework](#compatibility-breaks-caused-by-the-framework).
- Compiled against a newer API, the module may reference a method the server's framework does not have, producing a `NoSuchMethodError` the first time that call site is reached.

The scope of the first point matters. It describes statically linked references in one direction and is not a general guarantee: a later framework release can still remove or reshape something the module uses, and anything reached by reflection was never covered, because the compiler did not record it.

A pin that lags the latest release is therefore the normal state rather than drift to be corrected. Raise it only when the module actually starts using a newer API.

### The pin and `api-version`

The pin is not the module's runtime floor. These are two independent numbers, and only one of them is checked:

| Number | Decides | Checked by |
|---|---|---|
| The `UltiTools-API` version in `pom.xml` | Which version's descriptors your bytecode records | Nothing. It is `provided`, does not enter the JAR, and the framework cannot read it at runtime |
| `api-version` in `plugin.yml` | The declared runtime floor | `PluginManager.isUltiToolsVersionCompatible`. This is the only framework version consulted before a module is admitted |

Raising the pin does not raise the floor. A gap between the two numbers is not itself a fault: bytecode built against a newer pin still runs on the declared floor as long as every member it references already exists there. What breaks is a JAR whose bytecode references a symbol the framework version named in `api-version` does not declare, because that server admits it and then fails when the call site is reached.

More than this one number is checked before a module is admitted: the JAR is structurally validated first, and a module is also refused when a newer copy of itself is already loaded. The full test is `passesCompatibilityGates`, which is `!hasNewerVersionLoaded && isUltiToolsVersionCompatible`. Only `api-version` has anything to do with which framework versions the module can run on, which is why this page discusses only that one.

## Compatibility breaks caused by the framework

An older pin provides only the guarantee described in the previous section. A module whose own code has not changed can still produce a linkage error, because what the bytecode links to is determined by the framework installed on the server rather than by the module's build.

::: warning A successful build does not mean compatibility
A successful build only shows that the source still compiles. What breaks an already published JAR is the descriptor recorded in its bytecode, and compilation does not show it to you.
:::

[The JLS chapter on binary compatibility][jls13] lists every change that can cause this, and there are more than the two below. These two are the ones this project has actually shipped; they are examples rather than a complete list.

### Removed API

A MINOR release of the framework may remove API, as described in `COMPATIBILITY.md`. Which linkage error you get depends on what was removed: removing a type produces `NoClassDefFoundError`, while removing a method, constructor or field produces `NoSuchMethodError` or `NoSuchFieldError`. The second case is not hypothetical, as the current removal list includes a constructor and not only types.

Raising the pin and rebuilding produces one of two outcomes, and you cannot tell which until you run it:

- The build fails. The removal is exposed here rather than on a server owner's machine, and you migrate away from the removed API.
- The build succeeds. Some surviving member absorbed the call, and the rebuilt artifact is already fixed.

Neither outcome repairs the JAR you have already published. That one keeps failing until you release the rebuild, which makes the second outcome the one to watch: a successful build looks like there is nothing to do, when in fact the fix is in your hands and has to be published.

A successful build is not hard to get, because this check only covers what the source names explicitly. Anything the source reaches implicitly may be resolved somewhere else:

- An overload absorbs the call. `m(String)` is removed, `m(Object)` remains, and unmodified source compiles against the surviving one.
- The removed type never appears in the source. In `factory.create().run()`, the return type of `create()` is inferred, so pointing `create()` at a replacement type still compiles cleanly while the old bytecode continues to reference the deleted one.

The cost only arrives if you publish the raised pin: building against a newer framework may record newer descriptors, which means raising `api-version` as well, which leaves behind every server still on the older framework. Raising the pin is therefore useful as a check and poor as a fix. Raise it in a throwaway build, see what fails to compile, migrate away from those APIs, then decide separately whether the released pin should move.

The way to handle this situation is to follow deprecation notices and migrate before the removal is released.

::: tip Reading a deprecation notice for its deadline
As of v6.3.0, every `@Deprecated(forRemoval = true)` member carries a machine-checked `{@removeIn X.Y.Z}` javadoc tag naming the concrete removal version.
A build-time check fails the framework's own CI if the member is still declared once the project version reaches that target, so the tag is an enforced promise, not just documentation.
See [`compatibility/DEPRECATIONS.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/alpha/compatibility/DEPRECATIONS.md) for every currently `ANNOUNCED` removal and its deadline in one place.
:::

### Changed descriptors

This situation is harder to notice, because nothing is removed and there is nothing to mark as deprecated. A method's descriptor covers both its parameter types and its return type, so a change to either produces a different symbol under the same name.

This has happened twice.

**6.1.1 to 6.2.0, a MINOR release.** Removing Spring changed the type of a field on `UltiToolsPlugin`, and the return type of the Lombok-generated `getContext()` changed with it. Every already compiled module calling that method received a `NoSuchMethodError`. Nothing was removed and nothing was marked deprecated; in the source it reads as internal cleanup. The same applies to a public field whose type changes: the compiled `getfield` still carries the old descriptor and fails with `NoSuchFieldError`.

**6.2.0 to 6.2.1, a PATCH release.** Replacing `AbstractDataEntity` with `BaseDataEntity<String>` across the data APIs changed the descriptors of 14 public members across 5 types: `DataOperator`'s `exist(T)`, `getById`, `insert(T)` and `update(T)`, `Query`'s `first()`, and their implementations. Nothing was removed and nothing was added, and every affected member kept its name.

The second case occurred in a PATCH release, which shows that no version level is exempt. The version policy schedules intentional removals, so an unintended binary break is by definition unscheduled, and PATCH is not an exception.

A module that only uses `.query()….first()` calls none of the `DataOperator` methods and is affected all the same, so a list organised around `DataOperator` would not cover it.

#### Both directions

When a symbol keeps its name and changes its descriptor, both directions are affected. The same module, from the same source, with only the pin changed:

| Pin used at build time | On framework 6.2.0 | On framework 6.2.1 and later |
|---|---|---|
| 6.2.0 | Works | `NoSuchMethodError`, looking for `(AbstractDataEntity)`, which no longer exists |
| 6.2.1 | `NoSuchMethodError`, looking for `(BaseDataEntity)`, which does not exist yet | Works |

Rebuilding against the newer framework is therefore not a fix that leaves older servers where they were; it changes which side works. Both directions fail for the same reason, so the handling depends on which generation of type the missing symbol names, described in [Reading the output](#reading-the-output).

#### What has to be released

Rebuilding alone is not enough. With the pin still on the old version, the build regenerates the old descriptor and the new artifact fails in exactly the same way. As long as you keep the original direct call site, you have to raise the pin to a framework version carrying the new descriptor and rebuild. The third option below avoids that condition.

That covers only half of it, and by the table above, the half that is not checked. The rebuilt JAR now records the new descriptor, so it throws `NoSuchMethodError` on frameworks older than that one. If `api-version` stays where it was, an older server admits the new JAR and then fails on the first call. `api-version` therefore has to be raised as well, which by the checklist at the top of this page makes that release a MAJOR.

Raise it to what the artifact actually requires rather than mechanically following the pin. Raising the pin does not by itself mean the output needs the newer framework: if the rebuild only redirected a call onto a member that exists in both versions, or you raised the pin only to run a check, the bytecode may still run on the original floor, and raising `api-version` would turn a compatible repair into an unnecessary MAJOR release. The next section describes how to confirm this. Following the pin is the conservative choice when you have not confirmed it.

### Checking an artifact

Whether a given JAR can run on framework X is something you can confirm. The way to confirm it is not to rebuild, but to compare the symbols the bytecode references against what that framework actually declares:

```bash
# run from a checkout of UltiTools-Dev-Doc
python3 scripts/symcheck.py your-module.jar UltiTools-API-<the floor you declare>.jar
```

An exit code of 0 means no symbols are missing. A non-zero exit code lists what is missing, and the JAR will fail on that framework the first time it reaches one of those call sites.

Compare against the version you declare in `api-version`, not the one you pinned. These are different questions, and the first is the one your users will encounter.

#### Reading the output

First distinguish two situations, because they need different work:

- The name is gone entirely, with no overload surviving, or the class itself is absent. This is a removed API. Consult that release's removal list; what you need is a source migration.
- A symbol of the same name is still there with a different descriptor. This is a changed descriptor, and only then does the table below apply.

For a changed descriptor, look at which generation of type the missing symbol names:

| The missing symbol names | Meaning | What to do |
|---|---|---|
| The newer type, such as `BaseDataEntity` | The artifact needs a higher version than the floor it declares | Raise `api-version`; the pin does not need to change |
| The older type, such as `AbstractDataEntity` | The pin stayed on an older version, so the output is older than the declared floor | Raise the pin and rebuild. Raising `api-version` does not help here and makes matters worse |

These two are easy to confuse and the responses point in opposite directions, so it is worth reading the symbol itself first.

The script cannot make this decision for you. It receives one module JAR and one framework JAR, so it can confirm that a symbol is absent but not why, and it never sees your pin.

There are two more situations the script states rather than guesses at. A reference whose hierarchy leaves both JARs is listed as inconclusive and does not affect the exit code; this happens when a framework class inherits from a type the API JAR does not bundle, such as a server API or a UI library, in which case a module calling the inherited method is behaving normally. And if `javap` itself fails, the script stops rather than analysing incomplete output.

A manual check runs into one more detail: the constant pool records the static type of the receiver at the call site, not the class that declares the member. When you call an inherited framework method from your own plugin class, the recorded owner is your own class, in the form `com/example/MyPlugin.getContext:()…`. Filtering for references whose owner is already inside the framework's package therefore misses every inherited call, and since plugins extend `UltiToolsPlugin`, those account for most of them.

::: tip The limits of a manual check
Running `javap -s` on a single class shows the descriptor of a member, but the question here is whether anything in the whole JAR references a symbol the target framework does not have, which requires comparing two artifacts.
:::

### Supporting two framework versions at once

What cannot cover both sides is a statically linked call site, because the descriptor is fixed at compile time and one call site matches one side. There are three options, in increasing cost:

1. Accept the higher floor. This is the default choice: older servers stay on the older JAR, and the new one serves the new framework.
2. Publish separate artifacts per framework range and maintain both lines.
3. Write an adapter layer, either calling reflectively (`getMethod("getContext").invoke(plugin)` returns `Object`, and `getBean` is reached the same way) or lazily loading a different adapter per framework version. A reflective call site links to neither descriptor, so a single artifact can run on both sides. The cost is that this path loses compile-time checking: problems surface at runtime, and the next time the framework reshapes that member there is no build warning at all.

The third option is workable and should not be ruled out simply because it is listed last, but it trades a build-time failure for a runtime one, so it is worth taking only when older servers genuinely have to keep working.

This also shows the scope of the rule that a lagging pin is normal. That rule says not to move the pin without a reason, and a changed descriptor is a reason, as are the other situations the process above points back here.

### Other linkage errors

If the linkage error you have is neither of the two situations above, it belongs to one of the other JLS categories. Making an instance method `static` produces `IncompatibleClassChangeError`, narrowing a member's accessibility produces `IllegalAccessError`, and there are more. One question sets the direction: did the framework remove something?

- Yes. It should appear on the removal list. If it does not, please open an issue; that is a gap in the process rather than a problem only on your side.
- No. Try the rebuild path above: raise the pin, rebuild, raise `api-version`. If the rebuild **fails to compile**, the change broke source compatibility as well, and what you need is a migration rather than a rebuild.

[jls13]: https://docs.oracle.com/javase/specs/jls/se21/html/jls-13.html

## Current state of the modules

Most modules are still on `1.0.0`, because they have had no release requiring this decision. Two of them made a decision before this page existed and reached opposite conclusions: one used MINOR for a bug fix, the other MAJOR for a new feature, and neither matches the table above. They are being reconciled module by module rather than renumbered retroactively, because a published version number may already have been written down by server owners.
