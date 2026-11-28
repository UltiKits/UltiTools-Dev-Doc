# Module Load Ordering

::: info Ordering takes effect as of v6.3.0
In 6.2.x `@PluginDependency` already ordered modules, but a cycle or a missing `depends` only logged an error and loaded every module in unsorted order. As of v6.3.0, `plugin.yml`'s `name:` and `loadAfter` also take part, and a missing dependency or a cycle refuses the affected modules.
:::

## Declaring dependencies

Add `@PluginDependency` to the class that extends `UltiToolsPlugin`:

```java
@UltiToolsModule(scanBasePackages = {"com.example.myplugin"})
@PluginDependency(
    depends = {"CorePlugin", "UtilsPlugin"},
    softDepends = {"OptionalPlugin"}
)
public class MyPlugin extends UltiToolsPlugin {
    // ...
}
```

| Attribute | Meaning |
|---|---|
| `depends` | Required. Missing at load time refuses this module. |
| `softDepends` | Optional. This module loads after these if they are present; their absence does not refuse it. |
| `loadBefore` | The inverse declaration: names modules that should load after this one. |

## `plugin.yml`'s `loadAfter`

`plugin.yml`'s own `loadAfter:` list is read into the same dependency graph as `@PluginDependency`, resolved by module name:

```yaml
# plugin.yml
loadAfter:
  - CorePlugin
```

No `loadAfter` attribute was added to `@PluginDependency` itself. The two mechanisms are kept separate on purpose: `plugin.yml` already has `loadAfter`, and `@PluginDependency` already has `depends`/`softDepends`/`loadBefore`, so declare an ordering constraint through whichever of the two already expresses it.

## Cycles and missing dependencies

As of v6.3.0, a `depends` entry naming a module that is not installed refuses the declaring module and every module that requires it through `depends`, directly or transitively. A module that only lists the refused module under `softDepends`, `loadBefore` or `plugin.yml`'s `loadAfter` still loads, in the order the remaining declarations give. A dependency cycle refuses its members and the modules ordered after them (before v6.3.0 a cycle only fell back to unsorted order and loaded every module). Every unrelated module still loads.

The console names the full cycle as a path, `A -> B -> C -> A`, and says which module's author to contact. This mirrors how Paper itself reports a plugin load cycle.

As of v6.3.0, a module declaring several missing `depends` targets at once is named all of them in one console line, not just the first — you no longer need to fix one, restart, and discover the next.

As of v6.3.0, when one start has both a missing dependency and an independent cycle, the modules refused are the declaring module, the modules that require it through `depends`, the cycle members and every module ordered after them. The console names the missing dependency, each cycle as a `Loop:` path and every module that did not load on a `Not loaded:` line. A cycle with no missing dependency is refused as before.

## A required server plugin is missing

As of v6.3.0, a module whose `plugin.yml` lists a server plugin under `depend:` that is not installed is refused before it is constructed, with one console line and no stack trace, for example `[UltiTools-API] Module 'UltiTools-Economy' requires Vault, which is not installed or not enabled; the module is not loaded.` Nothing of the module runs: it is not constructed, no resource is extracted and no class is scanned. This also refuses a module that lists an uninstalled plugin under `depend:` but never used that plugin's classes while loading, which used to load anyway; Bukkit itself refuses a plugin whose `depend:` is missing.

A required plugin that is installed but not enabled yet is not refused early, because it may still be enabled after UltiTools. In that case the module is refused only if loading fails because that plugin's classes are missing, with the same single line. Any other load failure, including one while every `depend:` plugin is present, still prints the `Cannot initialize plugin for …` line with its trace ([issue #554](https://github.com/UltiKits/UltiTools-Reborn/issues/554)).

## Duplicate `plugin.yml` names

As of v6.3.0: dependency resolution looks a module up by either its simple class name or its `plugin.yml` `name:` value. If two installed modules declare the SAME `name:`, only one of them can claim that name in the dependency graph — whichever module is discovered first wins, and the console logs a WARNING naming both modules and the shared name so this is not silent. Which module wins follows discovery order, which as of v6.3.0 is file-name order, so it is the same for a given modules folder on every file system; a module whose main class has that simple name takes the name first. Even so, treat this WARNING as a signal to rename one module's `plugin.yml` `name:`, not as a resolution to rely on.

## Falling back to the legacy order

`-Dultitools.useLegacyPluginLoading=true` restores the pre-6.3.0 behavior: every module loads in file-name order with no dependency resolution at all, including no cycle detection. This is a JVM system property, consumed once at server startup, not a reloadable config key — the same shape as Paper's own `-Dpaper.useLegacyPluginLoading=true`.

::: warning Cost of the legacy switch
With dependency resolution skipped entirely, a module that relies on load order may fail to initialize, unpredictably, with no error naming the cause. Use this switch only as a temporary escape hatch while fixing the underlying cycle or missing dependency.
:::
