# Scheduled Tasks

::: info Since v6.2.0
The `@Scheduled` annotation is available starting from UltiTools-API v6.2.0.
:::

UltiTools provides a declarative way to schedule repeating or delayed tasks using the `@Scheduled` annotation. Instead of manually creating `BukkitRunnable` objects, you simply annotate a method and the framework handles the rest.

## Basic Usage

Add `@Scheduled` to any `void`, no-argument method inside a managed bean (such as a `@Service`):

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/AutoSaveService.java

::: tip Tick Conversion
Minecraft runs at 20 ticks per second: 1 second is 20 ticks, 1 minute is 1,200 ticks, 5 minutes is 6,000 ticks, and 30 minutes is 36,000 ticks.
:::

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `delay` | `long` | `0` | Initial delay in ticks before first execution |
| `period` | `long` | `-1` | Repeat interval in ticks. `-1` means run once |
| `async` | `boolean` | `false` | Run on an async thread instead of the main server thread |

## One-Time Delayed Task

Set only `delay` (leave `period` at default `-1`) to run a task once after a delay:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## Repeating Task

Set `period` to a positive value to create a repeating task:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## Async Tasks

Set `async = true` for tasks that don't need to access the Bukkit API directly (e.g., database operations, HTTP requests):

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

::: warning Bukkit Thread Safety
When `async = true`, the task runs off the main server thread. You **must not** call most Bukkit API methods from async threads. If you need to interact with the Bukkit API from an async task, dispatch back to the main thread:

```java
Bukkit.getScheduler().runTask(UltiTools.getInstance(), () -> {
    // Safe to call Bukkit API here
    player.sendMessage("Operation complete!");
});
```
:::

## Automatic Lifecycle

Tasks annotated with `@Scheduled` are automatically managed by the framework:

- **Registration**: Tasks are discovered and started when the plugin loads
- **Cancellation**: All tasks are automatically cancelled when the owning plugin is unloaded or the server shuts down

You do not need to track or cancel tasks manually.

## Requirements

- The annotated method must be `void` and take **no parameters**
- The method must be inside a bean managed by the container (e.g., `@Service`)
- The bean must be in a package scanned by `@UltiToolsModule(scanBasePackages = {...})`

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ServerMonitorService.java
