# Module Load Ordering

::: info Ordering takes effect as of v6.3.0
`@PluginDependency` has existed since v6.2.0 as declarative metadata with no reader. As of v6.3.0, both it and `plugin.yml`'s `loadAfter` participate in the actual load order.
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

A dependency cycle, or a `depends` entry naming a module that is not installed, refuses only the affected modules — the cycle members (or the module with the missing dependency) and anything that transitively depends on them. Every unrelated module still loads.

The console names the full cycle as a path, `A -> B -> C -> A`, and says which module's author to contact. This mirrors how Paper itself reports a plugin load cycle.

## Falling back to the legacy order

`-Dultitools.useLegacyPluginLoading=true` restores the pre-6.3.0 behavior: every module loads in filesystem order with no dependency resolution at all, including no cycle detection. This is a JVM system property, consumed once at server startup, not a reloadable config key — the same shape as Paper's own `-Dpaper.useLegacyPluginLoading=true`.

::: warning Cost of the legacy switch
With dependency resolution skipped entirely, a module that relies on load order may fail to initialize, unpredictably, with no error naming the cause. Use this switch only as a temporary escape hatch while fixing the underlying cycle or missing dependency.
:::
