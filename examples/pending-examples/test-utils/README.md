# Pending: `ultikits-test-utils` example

This directory holds one compilable example, `CooldownServiceTestUtilsTest.java`, using
`ultikits-test-utils` (matching its own README's usage snippet) against this project's real,
already-compiled `CooldownService` example class.

## Why it lives here instead of `src/main/java`

`examples/pom.xml` compiles against Maven Central's latest release, and its `mvn compile` runs on
every push and every pull request (`.github/workflows/examples-ci.yml`). `ultikits-test-utils` is
written but **not yet published to Maven Central** — see the framework repository's
`.planning/phases/08-gate-hardening-release-closeout/08-RELEASE-PACKAGE.md`, section 4.2, for the
open architectural question (a `spigot-api` SNAPSHOT dependency) blocking that publish. Declaring
the dependency in the default `<dependencies>` block, or letting the default source scan pick up
this file, would fail dependency resolution — before the compiler even runs — on every push and
every PR against this repository, for a reason that has nothing to do with anything a contributor
touched.

Keeping the file outside `src/main/java` means the default build never sees it. No compiler
`<excludes>` filter is needed, and no risk of that filter being accidentally loosened later.

## How to enable it

The `test-utils-examples` Maven profile in `examples/pom.xml` (not active by default) adds the
`ultikits-test-utils` dependency and adds this directory to the compile source roots via
`build-helper-maven-plugin`. Verified locally against a `~/.m2`-installed copy of
`ultikits-test-utils:1.0.0`:

```
mvn -f examples/pom.xml -Ptest-utils-examples clean compile   # BUILD SUCCESS, 98 files
mvn -f examples/pom.xml clean compile                         # BUILD SUCCESS, 97 files (unaffected)
```

**The lifting condition is exact:** once `com.ultikits:ultikits-test-utils:1.0.0` (or whatever
version the eventual publish uses) is resolvable from Maven Central, either activate the profile
permanently by folding its `<dependencies>` and `<build>` additions into `examples/pom.xml`'s
defaults, or move this file into `examples/src/main/java/com/ultikits/docs/testutils/` and delete
the profile. Either way, this is an item in the framework repository's release-package checklist
(`08-RELEASE-PACKAGE.md`) alongside the publish authorisation itself — not only a comment in this
file — so it is not forgotten the way a "temporarily excluded" module tends to be.
