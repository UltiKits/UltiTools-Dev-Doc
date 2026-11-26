# Start-up Phases and Early Hooks

As of v7.0.0, the UltiTools framework JAR is a Paper plugin: it carries `paper-plugin.yml` instead of `plugin.yml`. Module JARs are unchanged and still describe themselves with their own `plugin.yml`. The framework's descriptor declares `api-version: '26.3'`, `load: POSTWORLD`, a bootstrapper and a runtime-library loader, and lists Vault and PlaceholderAPI as optional server dependencies.

::: warning Unreleased v7.0.0 behaviour
This page describes the unreleased 7.0.0 framework. A 6.x framework has no bootstrap phase and does not call early hooks.
:::

## The two phases

Start-up now runs in two phases.

1. Bootstrap phase, before any world loads. Paper first resolves the framework's runtime libraries. As of v7.0.0, UltiTools then applies pending module uninstalls, installs and updates, admits the module JARs in `plugins/UltiTools/plugins/`, builds the shared module class loader, and calls the early hook of each admitted module that declares one. It ends with one summary line:

   ```text
   [UltiTools] Bootstrap: processed pending module changes; 3 module JAR(s) on the module class path; 1 module bootstrap(s) ran, 0 failed.
   ```

2. Enable phase, after the worlds load. Module discovery, construction, the IoC container, commands, listeners and the usual `registerSelf()` hooks all run here, as they did in 6.x. Server plugins and Bukkit services are available only from this phase on.

If the bootstrap preparation as a whole fails, the framework logs `[UltiTools] Failed to prepare module bootstrap; the framework will be disabled during enable.` with the error, and then disables itself during enable. It does not start with an empty module set.

## Early hook

A module may run code in the bootstrap phase by naming a class under `bootstrapper:` in its own `plugin.yml`:

```yaml
name: MyModule
main: com.example.mymodule.MyModule
version: '1.0.0'
api-version: 700
bootstrapper: com.example.mymodule.MyModuleBootstrap
```

The class implements `com.ultikits.ultitools.bootstrap.ModuleBootstrap`, has a public no-argument constructor and must be inside the same module JAR:

```java
public final class MyModuleBootstrap implements ModuleBootstrap {
    @Override
    public void bootstrap(ModuleBootstrapContext context) throws Exception {
        context.logger().info("Preparing " + context.moduleName());
    }
}
```

`ModuleBootstrap` is marked `@ApiStatus.Experimental`. The hook is called once per start, on the server start-up thread, and only for an admitted module: a JAR that fails security validation or is refused for its `api-version` is never called. The `ModuleBootstrapContext` it receives offers the following methods (including the three content channels added as of v7.0.0):

| Method | Returns |
|---|---|
| `moduleName()` | The module's `plugin.yml` `name:`, or its JAR file name if no name is declared |
| `moduleJar()` | The absolute, normalized path of the module's JAR |
| `logger()` | A `java.util.logging.Logger` whose output goes to Paper's bootstrap logger, prefixed with `[UltiTools/<module name>]` |
| `enchantments()` | `EnchantmentChannel`, for declaring custom enchantments |
| `tags()` | `TagChannel`, for adding to or replacing tags |
| `datapacks()` | `DatapackChannel`, for declaring bundled data packs |

`ModuleBootstrapContext` is implemented by the framework; modules must not implement it.

What the hook may do: use the module's own classes, the framework classes and the server API, and write through `context.logger()`. What it may not do: there is no Bukkit server, no plugin instance (neither the module's nor any other), no IoC service and no world yet. Do not reference other plugins' classes, and do not initialize shared libraries that need Bukkit, because a failed static initializer affects every module that later uses that class.

A module without a `bootstrapper:` key starts exactly as before; the hook is optional.

## A failing early hook

The module's hook fails when it throws any exception or error, and also when the class cannot be loaded, is not inside the module's own JAR, does not implement `ModuleBootstrap`, or has no public no-argument constructor. Only that module is affected: it is not loaded at this start, while the framework and every other module start normally. Virtual machine errors such as `OutOfMemoryError` are not caught.

The operator sees two lines. In the bootstrap phase, an English error line with the stack trace:

```text
[UltiTools] Module 'MyModule-1.0.0.jar' failed in its bootstrap phase (com.example.mymodule.MyModuleBootstrap): java.lang.IllegalStateException: example -- the module is not loaded at this start. Update rollback is checked during enable; check the enable log before changing any module JARs.
```

Later, during enable, one line in the language configured for UltiTools, for example in English:

```text
[UltiTools-API] Module 'MyModule-1.0.0.jar' is not loaded because its bootstrap phase failed at this start; see the earlier bootstrap error.
```

and in Chinese `[UltiTools-API] 模块 'MyModule-1.0.0.jar' 在本次启动的引导阶段失败，未加载；原因见前面的引导错误。`. Bootstrap-phase lines are English only, because the language files are not loaded yet. A module that lists the failed module under `depends` is then refused by the usual rules in [Module Load Ordering](/guide/advanced/module-dependencies).

The failure lasts only for this start. The next start calls the hook again.

## Declaring custom content {#bootstrap-content}

As of v7.0.0, use the three content channels inside `ModuleBootstrap#bootstrap(ModuleBootstrapContext)` in the class named by your module's `bootstrapper:`. They let you add new custom enchantments, change tags, and declare data packs bundled in your module JAR. The tag channel only supports `RegistryKey.ITEM` and `RegistryKey.ENCHANTMENT`. The framework does not expose other registries for direct writes or let you replace existing enchantments through the enchantment channel.

Use the namespace derived from your module name by `MessageKey.namespaceFor(...)` for new enchantment keys and for tags you create or replace with `setTag`. `addToTag` can extend a tag in another namespace. Paper runs the `EnchantmentDefinition` callback later, when it builds the enchantment registry. On a native data reload (`/minecraft:reload`), the framework replays tag declarations and data pack discovery without calling the module hook or the enchantment definition again.

This example uses the `MyModule` descriptor above. Bundle `datapacks/frost/pack.mcmeta` and the pack resources in the module JAR. Pack names match `[a-z0-9_-]{1,32}`; shipping the directory alone does not activate it. Once discovered, the pack appears as `UltiTools/mymodule.frost` in `datapack list`.

```java
public final class MyModuleBootstrap implements ModuleBootstrap {
    @Override
    public void bootstrap(ModuleBootstrapContext context) {
        Key edge = Key.key("mymodule:frost_edge");
        Key sword = Key.key("minecraft:diamond_sword");
        context.enchantments().register(edge, (builder, tags) -> builder
                .description(Component.text("Frost Edge"))
                .supportedItems(RegistrySet.keySet(RegistryKey.ITEM, RegistryKey.ITEM.typedKey(sword)))
                .weight(5).maxLevel(3)
                .minimumCost(EnchantmentRegistryEntry.EnchantmentCost.of(1, 10))
                .maximumCost(EnchantmentRegistryEntry.EnchantmentCost.of(21, 10))
                .anvilCost(2).activeSlots(EquipmentSlotGroup.MAINHAND));
        context.tags().addToTag(RegistryKey.ENCHANTMENT, Key.key("minecraft:in_enchanting_table"), List.of(edge));
        context.tags().setTag(RegistryKey.ITEM, Key.key("mymodule:frost_weapons"), List.of(sword));
        context.datapacks().embedded("frost");
    }
}
```

As of v7.0.0, a declared pack may not contain `data/<namespace>/worldgen/`, `data/<namespace>/dimension/` or `data/<namespace>/dimension_type/`, including inside pack overlays. If it does, UltiTools refuses to load the whole module, even if its hook catches the declaration exception. The enable log says the module was not loaded because the named data pack contains world-generation content, and gives the offending directory.

### When a content declaration fails

As of v7.0.0, if `bootstrap()` throws, the framework discards all of that hook's channel declarations: none are written to the game. The channels close when the hook exits, so do not keep them for `registerSelf()` or reload. This guarantee does not extend to writes already made by Paper: if, for example, an invalid enchantment definition fails during start-up, the framework stops applying further declarations for that module and refuses to load it. Entries already written or packs already discovered can remain until the next restart. Unrelated modules continue; the usual rules still apply to modules that require the failed one.

### Start-up log and content record

As of v7.0.0, bootstrap logs an English declaration count for each contributing module, for example `[UltiTools] Module 'MyModule-1.0.0.jar' declared custom content: 1 enchantment(s), 2 tag change(s), 1 data pack(s).` During enable, the server log shows a count in the server's configured language for each contributing module that did not fail during bootstrap. With `language: en`, the default message for the example is:

```text
Module 'MyModule' added custom content at this start: 1 enchantment(s), 2 tag change(s), 1 data pack(s).
```

The framework-owned record at `plugins/UltiTools/bootstrap/contributions.json` tracks each module's declarations by content kind, not what Paper actually accepted. After a contributing module's JAR is removed, the next start logs the removal once, with a separate consequence for each affected kind. A module that stops declaring some entries also gets a warning about the missing entries. A JAR still present but refused for its `api-version` does not count as removed.

If the record cannot be read, the framework tries to set it aside as `contributions.json.unreadable-*` and rebuilds from declarations on this and subsequent starts. Removal warnings may be incomplete until every module has started successfully at least once; a module already removed before its record could be rebuilt cannot be recovered from current declarations. Do not edit the record or the generated ZIPs in `plugins/UltiTools/bootstrap/datapacks/`. See [Commands and pending changes](/guide/advanced/module-versioning#commands-and-pending-changes) before removing a module.

## Other plugins' classes

During enable, a module can use the classes of the server plugins it declares in its `plugin.yml` under `depend:` or `softdepend:`. A plugin listed under `softdepend:` that is not installed is skipped and does not stop the module from loading. Vault and PlaceholderAPI are always looked up, because the framework itself declares them.

Visibility is only promised for declared plugins. All modules share one module class loader, so a plugin declared by another module, or a library that a dependency exposes (for example through Vault), may happen to be visible too; do not rely on that. When a module loads a class that no declared plugin supplies, the error reads:

```text
com.example.other.SomeClass is not available to modules. If this class belongs to another server plugin, declare the providing plugin in the module's plugin.yml depend or softdepend; visibility of undeclared plugins is not guaranteed.
```

In the bootstrap phase no server plugin is loaded, so an early hook cannot use any other plugin's classes, declared or not.

## Duplicate copies and order

The framework reads the module JARs in file-name order, compared as plain strings. When several JARs declare the same `main:` class, only the first of them in that order is considered for an early hook, so the hook runs once per start. If that first copy declares no `bootstrapper:`, no hook runs for the module, even if a later copy declares one. The start-up warning about duplicate copies is described in [Two copies of one module](/guide/advanced/module-versioning#two-copies-of-one-module).

Hooks of different modules also run in file-name order, but that order is not part of the contract. Do not write a hook that depends on another module's hook having run.

## Runtime libraries

As of v7.0.0, the framework JAR no longer lists its runtime libraries under `libraries:` in `plugin.yml`. Paper downloads them through the framework's loader before the bootstrap phase:

- `commons-dbutils:commons-dbutils:1.8.1`
- `org.java-websocket:Java-WebSocket:1.6.0`
- `net.bytebuddy:byte-buddy:1.18.17`
- `com.sun.mail:javax.mail:1.6.2`
- `com.zaxxer:HikariCP:7.1.0`

The first start therefore needs network access to Maven Central; later starts reuse Paper's library cache. A failed download happens before UltiTools can log anything, so Paper may report only `Error resolving libraries`. Check the server's connectivity to the Maven repository. To use another mirror, set Paper's `PAPER_DEFAULT_CENTRAL_REPOSITORY` environment variable to its URL before starting the server.

## Known limitations

- Disabling and re-enabling UltiTools without a full restart is unsupported, as are server `/reload` and plugin-manager hot reload. The module class loader is closed when the framework disables and is not rebuilt by a re-enable. `/ul reload` still reloads configuration only.
- A module whose hook failed is not enabled, but its JAR stays on the shared module class path. Other modules that use its classes can still be affected, especially by a failed static initializer.
- As of v7.0.0, pending installs and updates are applied in bootstrap but confirmed only after modules load during enable. If start-up is interrupted before confirmation, the next start removes the unconfirmed install or restores the previous JAR for an unconfirmed update. Let start-up finish before stopping the server. See [application and recovery at start-up](/guide/advanced/module-versioning#application-and-recovery-at-start-up).
- As of v7.0.0, a module whose bootstrap succeeds but whose enable fails still contributes on every start while its JAR remains installed and its bootstrap succeeds; remove the JAR and restart to stop it.
- As of v7.0.0, a module whose tag references another module's enchantment also fails to load if that enchantment fails to register at start-up.
- As of v7.0.0, if a failed module start causes its generated data pack ZIP to be cleaned up, a previous `datapack disable` is reset; Paper enables the pack when it reappears.
- As of v7.0.0, the content channels depend on experimental Paper APIs and may change in a later 7.x release when Paper changes them.
