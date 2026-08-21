# External Plugin API

::: info Since v6.2.2
Available in UltiTools-API 6.2.2 and later.
:::

The External Plugin API allows **any regular Bukkit/Spigot plugin** to use UltiTools framework features without extending `UltiToolsPlugin`. Your plugin stays a normal `JavaPlugin` — just call `UltiToolsAPI.connect(this)` and the framework scans your package for `@Service`, `@CmdExecutor`, `@EventListener`, `@Scheduled`, and more.

## Quick Start

### 1. Add Dependency

**Maven**
```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>6.2.4</version>
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

::: warning
`depend: [UltiTools]` is **required**. UltiTools must be loaded before your plugin so the framework is ready when `connect()` is called.
:::

### 3. Connect and Disconnect

<<< @/../examples/src/main/java/com/ultikits/docs/external/MyExternalPlugin.java

That's it. The framework automatically scans `com.example.myplugin` (derived from your main class) for annotated classes.

## What Gets Scanned

When `connect()` is called, the framework scans your plugin's base package and registers:

| Annotation | What it does |
|------------|-------------|
| `@Service` | Registered as a bean in the IoC container |
| `@CmdExecutor` | Command class auto-registered with Bukkit |
| `@EventListener` | Listener auto-registered with Bukkit |
| `@Scheduled` | Methods scheduled as Bukkit tasks |
| `@PlayerCache` | Fields tracked per-player with auto save/load |
| `@ModuleEventHandler` | Subscribed to the UltiTools EventBus |

## Writing Services

Services work exactly like in UltiTools modules — use `@Service` and `@Autowired`:

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetingService.java

## Writing Commands

Use `@CmdExecutor` and `@CmdMapping` just like a UltiTools module:

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetCommand.java

::: tip
Command descriptions use the raw `description` attribute from `@CmdExecutor`. The `i18n()` method is not available for external plugins — use plain strings.
:::

## Writing Event Listeners

<<< @/../examples/src/main/java/com/ultikits/docs/external/JoinListener.java

## Data Storage

Use `UltiToolsAPI.getDataOperator()` to get a `DataOperator` for your data entities. Data is stored in **your plugin's own data folder**, not UltiTools' folder.

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsEntity.java

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsService.java

::: tip
The storage backend (JSON, SQLite, or MySQL) is determined by the UltiTools server configuration, not your plugin. Your code works the same regardless.
:::

## EventBus

Use `UltiToolsAPI.getEventBus()` for inter-plugin communication:

```java
// Publish an event
UltiToolsAPI.getEventBus().publish(new MyCustomEvent(data));

// Subscribe via annotation in a @Service class
@ModuleEventHandler
public void onCustomEvent(MyCustomEvent event) {
    // Handle event from any module or external plugin
}
```

## API Reference

| Method | Description |
|--------|-------------|
| `UltiToolsAPI.connect(JavaPlugin)` | Connect plugin to UltiTools framework |
| `UltiToolsAPI.disconnect(JavaPlugin)` | Disconnect plugin from framework |
| `UltiToolsAPI.isConnected(JavaPlugin)` | Check if a plugin is connected |
| `UltiToolsAPI.getDataOperator(JavaPlugin, Class)` | Get a DataOperator scoped to the plugin's data folder |
| `UltiToolsAPI.getEventBus()` | Get the shared EventBus instance |

## Lifecycle

- **Auto-disconnect**: If your plugin is disabled (server stop, `/reload`), UltiTools automatically disconnects it via a `PluginDisableEvent` listener. You don't strictly need `disconnect()` in `onDisable()`, but it's good practice.
- **UltiTools shutdown**: When UltiTools itself shuts down, all external plugins are disconnected automatically via `disconnectAll()`.
- **Cleanup**: On disconnect, all commands, listeners, scheduled tasks, EventBus subscriptions, and PlayerCache beans registered by your plugin are removed.

## Differences from UltiTools Modules

| Feature | UltiTools Module | External Plugin |
|---------|-----------------|-----------------|
| Base class | `extends UltiToolsPlugin` | `extends JavaPlugin` |
| Registration | `@UltiToolsModule` + `registerSelf()` | `UltiToolsAPI.connect(this)` |
| i18n | `plugin.i18n("key")` available | Not available — use plain strings |
| Config entities | Full support (`@ConfigEntity`) | **Not available** — use Bukkit `getConfig()` |
| Data storage | `plugin.getDataOperator(Class)` | `UltiToolsAPI.getDataOperator(plugin, Class)` |
| Hot reload | Supported via `ul reload` | Not supported — requires server restart |
| plugin.yml | `api-version: 620` | `depend: [UltiTools]` |

## Complete Working Example

Check out the [UltiTools-External-Example](https://github.com/UltiKits/UltiTools-External-Example) repository for a fully working example that demonstrates `@Service`, `@CmdExecutor`, `@EventListener`, `@Autowired`, and `DataOperator` CRUD in a standard Bukkit plugin.

::: tip
See also: [IoC Container](/guide/advanced/ioc-container) | [Command Executor](/guide/essentials/cmd-executor) | [Scheduled Tasks](/guide/advanced/scheduled-tasks) | [Module EventBus](/guide/advanced/module-eventbus)
:::
