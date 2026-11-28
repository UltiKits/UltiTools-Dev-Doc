# External Plugin API

This guide describes the API as of v7.0.0 on Paper 26.3 with Java 25. For a 6.x plugin, start with the [upgrade guide](./upgrading-to-7#external-paper-plugins) or consult the [archived 6.5.0 guide](/v6.5.0/guide/advanced/external-plugin-api.html).

An external plugin remains a regular `JavaPlugin`. Paper loads its JAR from `plugins/`; UltiTools does not load it as a module. Connecting gives its components access to UltiTools dependency injection, commands, data and other services without extending `UltiToolsPlugin`.

## Quick Start

### 1. Build dependency

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>7.0.0</version>
    <scope>provided</scope>
</dependency>
```

Resolve the build dependency from Maven Central. Do not bundle UltiTools-API in your JAR; Gradle uses `compileOnly`. Download the framework JAR from GitHub Releases or Maven Central, as described in [Quick Start](/guide/quick-start).

### 2. Server dependency

```yaml
name: MyExternalPlugin
version: '1.0.0'
main: com.ultikits.docs.external.MyExternalPlugin
api-version: '26.3'
depend: [UltiTools]
```

As of v7.0.0 UltiTools itself is a Paper plugin, but on Paper 26.3 a regular `plugin.yml` plugin can still declare `depend: [UltiTools]`. Use it when enable always calls `connect`: Paper must load and enable UltiTools before your plugin. `softdepend: [UltiTools]` is for an optional integration: Paper can enable your plugin without UltiTools. In that case, check that UltiTools is enabled before entering code that uses its types; do not call `connect` unconditionally.

In this `plugin.yml`, `api-version: '26.3'` is the Paper API version, not the UltiTools module level `700`. Commands registered by UltiTools do not need a `commands:` entry.

### 3. Connection and disconnection

Call `connect` in `onEnable()`, after any plugin state needed by scanned bean initializers has been prepared, and before using connected services. It creates and refreshes the child container before returning. Both overloads return `void`. Call `disconnect` in `onDisable()`; it is a no-op if there is no adapter. UltiTools also disconnects on `PluginDisableEvent` and during its own shutdown.

<<< @/../examples/src/main/java/com/ultikits/docs/external/MyExternalPlugin.java

On success, the console includes `[UltiTools-API] External plugin connected: <name> v<version>`. Repeating `connect` on the same connected instance is ignored and logs `[UltiTools-API] Plugin <name> is already connected. Ignoring duplicate connect().` It does not rescan or add entities to that connection.

If UltiTools has not loaded, `connect` throws `IllegalStateException`. If registration throws an `Exception`, the API wraps it in `IllegalStateException` with `Failed to connect plugin <name> to UltiTools`; inspect the cause. An `Error` that escapes registration, such as `NoClassDefFoundError`, propagates without being wrapped by `connect`. The framework unwinds resources already registered, including the stage that failed, then releases the container and data scope for failures during registration. Inspect suppressed cleanup failures before retrying; plugin code's own side effects are not rolled back. Treat `isConnected` as a status check outside the connection call, not as a readiness signal from a bean initializer.

## Component scanning

The default scan starts at the package of `main` and includes its subpackages. It does not start at the JAR root or include sibling packages. If `main` is in the default package, UltiTools skips component scanning. If you move the example main class, put the example components in the same package or below it. The separate `@Table` scan looks in the plugin's own JAR, not just that component package.

| Component | Registration |
|---|---|
| `@Service` | Creates a managed bean. Use constructor injection or `@Autowired`; the plugin instance can be injected as `JavaPlugin` or its concrete main type. |
| `@CmdExecutor` | An annotated `BaseCommandExecutor` bean is compiled into a Brigadier tree unless `manualRegister = true`. The framework also discovers managed `BrigadierCommand` beans. |
| `@EventListener` | A bean implementing Bukkit `Listener` is registered unless `manualRegister = true`. Use Bukkit `@EventHandler` on its methods. |
| `@Scheduled` | Scheduled methods on managed beans use the framework scheduler and are cancelled on disconnect. Use literal `delay` and `period`; an asynchronous literal period is measured in wall-clock time at 50 ms per configured tick. |
| `@PlayerCache` | Registers per-player cache fields for quit handling, including any configured save hook; the fields stop being tracked on disconnect. |
| `@ModuleEventHandler` | A public method on a managed bean with one `ModuleEvent` parameter (or a subtype) subscribes to the shared EventBus. Publish with `UltiToolsAPI.getEventBus().publish(event)`. |

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetingService.java

<<< @/../examples/src/main/java/com/ultikits/docs/external/JoinListener.java

## Command registration

As of v7.0.0, `connect` discovers and compiles commands; UltiTools hands the trees to Paper's registrar at `LifecycleEvents.COMMANDS`. On normal Paper 26.3 startup, `POSTWORLD` plugins finish enabling before the initial command event, so connecting in `onEnable()` is early enough. Use `@CmdExecutor` and `@CmdMapping` without a `commands:` entry or a separate Bukkit `onCommand` handler. The Paper event registers command labels; `@CmdExecutor` supplies the aliases, permission and description.

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetCommand.java

An external plugin's `description` is literal even when it has its own message catalogue. Use `Messages` explicitly for replies written by your plugin. See [Command Executor](/guide/essentials/cmd-executor) for parsing and completion.

Leave `manualRegister` at its default of `false` for external annotation executors. `connect` skips executors with `manualRegister = true`, and the external plugin API has no method to register them later. If an executor uses a custom `TypeParser`, register it with `TypeParserRegistry.getInstance().register(...)` before calling `connect`, which compiles the command tree. Custom parsers do not replace built-in argument mappings.

| Situation | Console diagnostic |
|---|---|
| A new root or changed tree is connected after the initial event | `Command /<label> from <owner> was registered after start-up; it becomes available after /minecraft:reload or a restart.` |
| The label collides with a command already bound by UltiTools for another owner | `Command /<label> from <owner> (<class>) conflicts with <previous owner> (<previous class>); rejected.` |
| The Paper registrar does not return the requested label | `Command label /<label> from <owner> was not registered by Paper (label occupied).` |

An invalid mapping can instead refuse the connection. Look for `Cannot load module <owner>: executor <class>: <reason>. Change @CmdMapping formats to use distinct literal prefixes, one parameter name/type per position, terminal <name...> arrays, and registered custom type parsers.` The diagnostic says `module` even for an external plugin. A label conflict alone does not mean that `connect` failed.

`/minecraft:reload` reloads data packs and fires another commands event; it does not disconnect the plugin. `/ul reload` does not reconnect the plugin, rebind commands, or reload its configuration or catalogue overrides. Stop and restart the server after installing or replacing a JAR. Bukkit `/reload` and plugin-manager hot reload are not supported.

## Data storage and transactions

As of v7.0.0, `connect` discovers `@Table` entities in the plugin's own JAR using that plugin's class loader. For an entity your plugin owns in a separate library on its classpath, pass its class in `UltiToolsAPI.connect(this, LibraryEntity.class)`. This adds to JAR discovery; it does not let you claim another plugin's entities. Use `UltiToolsAPI.getDataOperator(plugin, Entity.class)` with the same plugin instance. A class not registered to that plugin is refused with `ULTI-3010` (`ENTITY_NOT_OWNED`).

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsEntity.java

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsService.java

The server selects the [storage backend](/guide/essentials/data-storage#entity-registration). JSON and SQLite use the external plugin's data folder. MySQL uses the configured database and the `@Table` name; choose a name that does not collide with another plugin's table. Use mapped column names in queries.

Annotate a managed service method with `@Transactional` and call it through the injected bean, rather than creating the service with `new`. The framework attaches the transaction manager for the external plugin's data scope. The same [proxy and transaction rules](/guide/advanced/transactions) apply as for a module.

## External plugin messages {#external-plugin-messages}

As of v7.0.0, bundle at least one `messages/<locale>.yml` directly under `messages/` in the plugin's own JAR, for example `messages/en.yml` or `messages/zh-CN.yml`. The filename stem must be recognized by the text engine as a locale; `messages/config.yml`, nested files and `.yaml` files do not enable a catalogue. Classes run from an unpacked directory do not enable one either. Use the same [catalogue format and language selection](/guide/essentials/messages) as a module. Choose `source-language` in `paper-plugin.yml` or, if there is no `paper-plugin.yml`, in `plugin.yml`; absent or invalid values use `en`.

With a catalogue, the injected `Messages` is bound to your plugin's normalized name. For `MyExternalPlugin`, `messages.key("greet.welcome")` gives `myexternalplugin:greet.welcome`. The framework refuses a connection if that namespace belongs to UltiTools, a loaded module or another external catalogue; a module arriving later cannot take over an existing external catalogue. Without a recognized bundled catalogue, there is no plugin-owned catalogue or generated messages directory. The bean inherits the framework `Messages` instance, with no namespace guarantee. To render a framework key, use an explicit key, such as `MessageKey.of("ultitools", "ul.help")`.

Put only changed keys in `plugins/<plugin name>/messages/<locale>.yml` (under the plugin's data folder). After a successful connection the framework writes bundled reference copies to its `messages/reference/`; editing those copies does not change the output. A refused connection does not write reference copies. Disconnect removes the in-memory catalogue without deleting files.

Call `UltiToolsAPI.reloadMessages(this)` from your own reload command to reread the bundled files and overrides. It can run on any thread, but performs synchronous file I/O under the text engine lock. Call it after `connect` returns successfully, not during bean initialization. Before connection, during registration or after disconnect, it throws `IllegalStateException` with `Plugin <name> is not connected to UltiTools`. A connected plugin without a bundled catalogue gets a no-op. Malformed override files warn in the console and are ignored; bundled text remains the fallback. `/ul reload` does not refresh external catalogues.

## Module-only features

| Feature | External plugin |
|---|---|
| Module lifecycle | No `@UltiToolsModule` lifecycle, `registerSelf()`, or module `onReload()` hook. Use `JavaPlugin` lifecycle methods and manage your own reload command. |
| Module bootstrap | `connect` is an enable-time API, not an entry point to UltiTools' early bootstrap for module enchantments, tags and data packs. An ordinary `plugin.yml` plugin does not get `ModuleBootstrapContext`. |
| Configuration entities | No module `@ConfigEntity` registration or typed `UltiToolsPlugin.getConfig(Class)`; manage your plugin's files with `JavaPlugin.getConfig()` and `reloadConfig()`. |
| Config-bound timing | A config-bound `@Scheduled` or `@CmdCD` on a discovered bean refuses connection. Use literal `delay` / `period` / `value`, or manage your own scheduling and configuration. |
| Module admission and updates | Module-level `api-version` and `/upm` do not apply. Install your JAR as a server plugin. |

## Command tests

The [UltiTools external-plugin example repository](https://github.com/UltiKits/UltiTools-External-Example) demonstrates the `JavaPlugin` integration. Choose an example revision that targets your framework version.

UltiTools 7.0 does not provide a supported fixture for testing external-plugin command registration without a server. The `LifecycleEvents.COMMANDS` handler is registered with the lifecycle manager of UltiTools, not that of the external `JavaPlugin`. In unit tests, call command handlers and completion providers directly, or use reflection to check the declared mappings, aliases and permissions. Direct calls bypass framework dispatch and cannot verify argument binding or permission checks.

On Paper, verify that the commands and aliases register, that players with and without permission see the expected commands and suggestions, and that dispatch and syntax-error feedback work through the actual command tree.

If your tests use `org.mockbukkit.mockbukkit:mockbukkit-v26.3:4.123.0` and fail during registry initialization, check the fixture `registries/registry_key_class_relation.json`. That version lacks the `minecraft:timeline` and `minecraft:world_clock` mappings needed by Paper 26.3. The framework's matching fixture lives in `src/test/resources/registries/registry_key_class_relation.json` in [UltiTools-Reborn](https://github.com/UltiKits/UltiTools-Reborn). Keep it under `src/test/resources`, not in your plugin JAR.
