# Supporting servers below 1.21

7.0.0 has not been released. This page points to historical guidance for older servers.

As of v7.0.0, UltiTools targets **Paper 26.3 build 258 with Java 25**. The [framework build][pom] uses `paper-api:26.3.build.258-stable` and compiles with `--release 25`. This is a single target baseline, not a minimum-version range; older Paper builds and plain Spigot are not supported targets.

As of v7.0.0, the framework loads module JARs unchanged. It no longer rewrites bytecode at load time, probes the server API or runs start-up or offline linkage audits. See the [framework compatibility policy][admission] and the [7.0 upgrade guide](./upgrading-to-7) before moving a module to the new baseline.

If you must run on an older server, stay on the 6.x line and choose framework and module versions that support your server. See [Supporting servers below 1.21 in the archived 6.4.0 guide](/v6.4.0/guide/advanced/older-servers), which describes the historical adaptation, its limits and what to verify on older Paper versions.

[pom]: https://github.com/UltiKits/UltiTools-Reborn/blob/main/pom.xml
[admission]: https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#module-api-floor-700-and-plain-module-loading-as-of-700
