# External Plugin API

::: info Since v6.2.2
Available in UltiTools-API 6.2.2 and later.
:::

The External Plugin API allows **any regular Bukkit plugin running on a Paper server** to use UltiTools framework features without extending `UltiToolsPlugin`. Your plugin stays a normal `JavaPlugin` — just call `UltiToolsAPI.connect(this)` and the framework scans your package for `@Service`, `@CmdExecutor`, `@EventListener`, `@Scheduled`, and more.

## Quick Start

### 1. Add Dependency

**Maven**
```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>6.4.0</version>
    <scope>provided</scope>
</dependency>
```

### 2. Declare Dependency in plugin.yml

```yaml
name: MyExternalPlugin
version: '1.0.0'
main: com.example.myplugin.MyExternalPlugin
depend: [UltiTools]
```

::: warning UltiTools must be declared as a dependency
`depend: [UltiTools]` is **required**. UltiTools must be loaded before your plugin so the framework is ready when `connect()` is called.
:::

### 3. Connect and Disconnect

<<< @/../examples-archive/v6.4.0/src/main/java/com/ultikits/docs/external/MyExternalPlugin.java

That's it. The framework automatically scans `com.example.myplugin` (derived from your main class) for annotated classes.

## What Gets Scanned

When `connect()` is called, the framework scans your plugin's base package and registers:

| Annotation | What it does |
|------------|-------------|
| `@Service` | Registered as a bean in the IoC container |
| `@CmdExecutor` | Command class auto-registered with Bukkit |
| `@EventListener` | Listener auto-registered with Bukkit |
| `@Scheduled` | Methods scheduled as Bukkit tasks |
| `@PlayerCache` | Per-player entries removed when the player quits (`Map<UUID, ?>`; as of v6.3.0 also `Set<UUID>` and `Map<?, UUID>`), with an optional save hook (`saveBeforeRemove`) |
| `@ModuleEventHandler` | Subscribed to the UltiTools EventBus |

## Writing Services

Services work exactly like in UltiTools modules — use `@Service` and `@Autowired`:

<<< @/../examples-archive/v6.4.0/src/main/java/com/ultikits/docs/external/GreetingService.java

## Writing Commands

Use `@CmdExecutor` and `@CmdMapping` just like a UltiTools module:

<<< @/../examples-archive/v6.4.0/src/main/java/com/ultikits/docs/external/GreetCommand.java

::: tip Command descriptions are plain strings
Command descriptions use the raw `description` attribute from `@CmdExecutor`. The `i18n()` method is not available for external plugins — use plain strings.
:::

## Writing Event Listeners

<<< @/../examples-archive/v6.4.0/src/main/java/com/ultikits/docs/external/JoinListener.java

## Data Storage

Use `UltiToolsAPI.getDataOperator()` to get a `DataOperator` for your data entities. With the JSON or SQLite backend the data is stored in **your plugin's own data folder**, not UltiTools' folder. With MySQL it is stored in the server's configured MySQL database, in the table named by `@Table`, so choose a table name that no other plugin or module uses. `getDataOperator` refuses an entity class that is neither in your plugin's JAR nor passed to `connect`.

<<< @/../examples-archive/v6.4.0/src/main/java/com/ultikits/docs/external/StatsEntity.java

<<< @/../examples-archive/v6.4.0/src/main/java/com/ultikits/docs/external/StatsService.java

::: tip The server configuration selects the storage backend
The storage backend (JSON, SQLite, or MySQL) is determined by the UltiTools server configuration, not your plugin. Your code works the same regardless. Query column names must still match the entity's @Column value, not the Java field name.
:::

## EventBus

Use `UltiToolsAPI.getEventBus()` for inter-plugin communication:

```java
// Publish an event (MyCustomEvent must extend ModuleEvent)
UltiToolsAPI.getEventBus().publish(new MyCustomEvent(data));

// Subscribe via annotation in a @Service class
@ModuleEventHandler
public void onCustomEvent(MyCustomEvent event) {
    // Handle event from any module or external plugin
    // A handler parameter that does not extend ModuleEvent is skipped with a WARNING log, not registered
}
```

## API Reference

| Method | Description |
|--------|-------------|
| `UltiToolsAPI.connect(JavaPlugin)` | Connect plugin to UltiTools framework |
| `UltiToolsAPI.connect(JavaPlugin, Class<?>...)` (v6.3.0+) | Connect, and also register entity classes your plugin owns that live outside its own JAR |
| `UltiToolsAPI.disconnect(JavaPlugin)` | Disconnect plugin from framework |
| `UltiToolsAPI.isConnected(JavaPlugin)` | Check if a plugin is connected |
| `UltiToolsAPI.getDataOperator(JavaPlugin, Class)` | Get a DataOperator scoped to the plugin (its data folder on JSON and SQLite) |
| `UltiToolsAPI.getEventBus()` | Get the shared EventBus instance |

## Lifecycle

- **Auto-disconnect**: If your plugin is disabled (server stop, `/reload`), UltiTools automatically disconnects it via a `PluginDisableEvent` listener. You don't strictly need `disconnect()` in `onDisable()`, but it's good practice.
- **UltiTools shutdown**: When UltiTools itself shuts down, all external plugins are disconnected automatically via `disconnectAll()`.
- **Cleanup**: On disconnect, all commands, listeners, scheduled tasks, EventBus subscriptions, and PlayerCache beans registered by your plugin are removed.
- **Refused connection** (as of v6.3.0): if `connect()` throws because the framework refused your plugin after building its container — a command executor whose declared annotations it cannot enforce, or a config-bound `@Scheduled`/`@CmdCD` — nothing it registered for your plugin is left behind, so a fixed build can connect again in the same server session ([issue #537](https://github.com/UltiKits/UltiTools-Reborn/issues/537)).

As of v6.3.2, a failure during subsequent scheduled-task, player-cache, EventBus, command or listener registration also cleans attempted registrations in reverse order, including the partially completed failing stage, before releasing the container, data scope and newly inserted ownership. The same original exception is rethrown; cleanup failures are attached as suppressed exceptions and do not stop later cleanup attempts. If cleanup itself fails, resources may remain until restart: inspect the suppressed exceptions before reconnecting. Arbitrary side effects performed by your plugin during initialization are not rolled back; plugin initialization is not a transaction.

## Differences from UltiTools Modules

| Feature | UltiTools Module | External Plugin |
|---------|-----------------|-----------------|
| Base class | `extends UltiToolsPlugin` | `extends JavaPlugin` |
| Registration | `@UltiToolsModule` + `registerSelf()` | `UltiToolsAPI.connect(this)` |
| i18n | `plugin.i18n("key")` available | Not available — use plain strings |
| Config entities | Full support (`@ConfigEntity`) | **Not available** — use Bukkit `getConfig()` |
| Config-bound `@Scheduled` / `@CmdCD` (v6.3.0+) | Supported, see [Config-Bound Timing](/guide/advanced/scheduled-tasks#config-bound-timing) | Refused, use literal `period` / `delay` / `value` |
| Data storage | `plugin.getDataOperator(Class)` | `UltiToolsAPI.getDataOperator(plugin, Class)` |
| Reload | `/ul reload` reloads module configs and language; a changed JAR still needs a server restart | Not available; implement your own reload command, and restart for a changed JAR |
| plugin.yml | `api-version: 630` for a module built for 6.3.0 (a config-bound `@Scheduled` / `@CmdCD` requires `630`) | `depend: [UltiTools]` |

## Complete Working Example

Check out the [UltiTools-External-Example](https://github.com/UltiKits/UltiTools-External-Example) repository for a fully working example that demonstrates `@Service`, `@CmdExecutor`, `@EventListener`, `@Autowired`, and `DataOperator` CRUD in a standard Bukkit plugin.

::: tip Related pages
See also: [IoC Container](/guide/advanced/ioc-container) | [Command Executor](/guide/essentials/cmd-executor) | [Scheduled Tasks](/guide/advanced/scheduled-tasks) | [Module EventBus](/guide/advanced/module-eventbus)
:::
