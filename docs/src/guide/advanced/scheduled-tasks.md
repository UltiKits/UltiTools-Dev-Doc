# Scheduled Tasks

::: info Since v6.2.0
The `@Scheduled` annotation is available starting from UltiTools-API v6.2.0.
:::

UltiTools provides a declarative way to schedule repeating or delayed tasks using the `@Scheduled` annotation. Instead of manually creating `BukkitRunnable` objects, you simply annotate a method and the framework handles the rest.

## Basic Usage

Add `@Scheduled` to any `void`, no-argument method inside a managed bean (such as a `@Service`):

```java
@Service
public class AutoSaveService {

    @Scheduled(period = 6000) // Every 5 minutes (6000 ticks)
    public void autoSave() {
        // This method is called automatically by the framework
        Bukkit.getLogger().info("Auto-saving data...");
    }
}
```

::: tip Tick Conversion
Minecraft runs at 20 ticks per second:
- 1 second = 20 ticks
- 1 minute = 1,200 ticks
- 5 minutes = 6,000 ticks
- 30 minutes = 36,000 ticks
:::

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `delay` | `long` | `0` | Initial delay in ticks before first execution |
| `period` | `long` | `-1` | Repeat interval in ticks. `-1` means run once |
| `async` | `boolean` | `false` | Run on an async thread instead of the main server thread |

## One-Time Delayed Task

Set only `delay` (leave `period` at default `-1`) to run a task once after a delay:

```java
@Service
public class WelcomeService {

    @Scheduled(delay = 100) // Run once, 5 seconds after plugin loads
    public void sendWelcomeMessage() {
        Bukkit.broadcastMessage("Plugin loaded successfully!");
    }
}
```

## Repeating Task

Set `period` to a positive value to create a repeating task:

```java
@Service
public class ScoreboardService {

    @Scheduled(delay = 20, period = 200) // Start after 1 second, repeat every 10 seconds
    public void updateScoreboard() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            // Update each player's scoreboard
        }
    }
}
```

## Async Tasks

Set `async = true` for tasks that don't need to access the Bukkit API directly (e.g., database operations, HTTP requests):

```java
@Service
public class InterestService {

    @Autowired
    private UltiToolsPlugin plugin;

    @Scheduled(period = 36000, async = true) // Every 30 minutes, async
    public void distributeInterest() {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);
        List<AccountEntity> accounts = dataOperator.getAll();
        for (AccountEntity account : accounts) {
            account.setBalance(account.getBalance() * 1.01);
            try {
                dataOperator.update(account);
            } catch (IllegalAccessException e) {
                Bukkit.getLogger().warning("Failed to update account: " + e.getMessage());
            }
        }
    }
}
```

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

```java
@UltiToolsModule(scanBasePackages = {"com.example.plugin"})
public class MyPlugin extends UltiToolsPlugin {
    @Override
    public boolean registerSelf() { return true; }
    @Override
    public void unregisterSelf() { }
}
```

## Complete Example

```java
@Service
public class ServerMonitorService {

    @Autowired
    private UltiToolsPlugin plugin;

    // Check server health every minute
    @Scheduled(delay = 1200, period = 1200, async = true)
    public void checkServerHealth() {
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        long maxMemory = runtime.maxMemory();
        double memoryUsage = (double) usedMemory / maxMemory * 100;

        if (memoryUsage > 90) {
            Bukkit.getScheduler().runTask(UltiTools.getInstance(), () -> {
                Bukkit.broadcastMessage("[Monitor] Warning: Memory usage at "
                    + String.format("%.1f", memoryUsage) + "%");
            });
        }
    }

    // Clean expired data daily (24 hours = 1,728,000 ticks)
    @Scheduled(period = 1728000, async = true)
    public void cleanExpiredData() {
        DataOperator<TempDataEntity> dataOperator =
            plugin.getDataOperator(TempDataEntity.class);
        dataOperator.query()
            .where("expireTime").lt(System.currentTimeMillis())
            .delete();
    }
}
```
