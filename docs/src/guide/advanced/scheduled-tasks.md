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

As of v6.3.0, `period` and `delay` can instead be read from a config key through `config`, `periodKey` and `delayKey`; see [Config-Bound Timing](#config-bound-timing).

## One-Time Delayed Task

Set only `delay` (leave `period` at default `-1`) to run a task once after a delay:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## Repeating Task

Set `period` to a positive value to create a repeating task:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## Async Tasks

Set `async = true` for tasks that don't need to access the Bukkit API directly (e.g., database operations, HTTP requests):

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

`async = true` applies to literal timings only. A task whose timing is [bound to a config key](#config-bound-timing) must be sync, as of v6.3.0.

::: warning Bukkit Thread Safety
When `async = true`, the task runs off the main server thread. You **must not** call most Bukkit API methods from async threads. If you need to interact with the Bukkit API from an async task, dispatch back to the main thread:

```java
Bukkit.getScheduler().runTask(UltiTools.getInstance(), () -> {
    // Safe to call Bukkit API here
    player.sendMessage("Operation complete!");
});
```
:::

## Config-Bound Timing <Badge type="tip" text="v6.3.0+" />

::: info As of v6.3.0
`@Scheduled` can read its period and initial delay from a key in your module's own config file, so a server owner can tune the interval without you writing a second scheduler.
:::

Instead of the `period` and `delay` literals, name a `@ConfigEntry` path with `periodKey` and `delayKey`, and give the config entity class with `config`. The value is read in seconds and multiplied by 20 to get ticks. The default lives only in the config field:

```java
@Getter
@Setter
@ConfigEntity("config/economy.yml")
public class EconomyConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "interest.interval", comment = "Seconds between interest payouts")
    private int interestInterval = 1800;

    public EconomyConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

```java
@Service
public class InterestService {

    @Scheduled(config = EconomyConfig.class, periodKey = "interest.interval", delayKey = "interest.interval")
    public void distributeInterest() {
        // Runs every interest.interval seconds on the main thread
    }
}
```

`delayKey` may name the same key as `periodKey`. The first run then waits one full interval, which is what a task such as a payout usually wants instead of running at load. A key is matched against `@ConfigEntry(path = ...)` as declared, or against the field name when `path` is empty.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | `Class<? extends AbstractConfigEntity>` | `AbstractConfigEntity.class` (unbound) | The config entity whose keys `periodKey` and `delayKey` name |
| `periodKey` | `String` | `""` (unbound) | Key whose value, in seconds, is the repeat interval. Replaces `period` |
| `delayKey` | `String` | `""` (unbound) | Key whose value, in seconds, is the initial delay. Replaces `delay` |

### Load-time checks

A binding is checked when the module loads. If any check fails, that module alone is refused, and the log names the key and the value. The module is refused when:

- a literal is set together with the key that replaces it (`period` with `periodKey`, or `delay` with `delayKey`);
- the config class is not registered exactly once for the module. A directory `@ConfigEntity` cannot be bound;
- the key matches no `@ConfigEntry` path;
- the bound field is not an `int`, `long`, `Integer` or `Long`;
- the value is `null`, below 1 second, or above 107,374,182 seconds (`Integer.MAX_VALUE / 20`, about 3.4 years). `0` does not mean "off".

### Applying changes on reload

A changed value is applied at `/ul reload`, and the task keeps its place in its cycle. The next run is the last run plus the new period. Before the first run it is the time the task was armed plus the new delay. If that moment has already passed, the task runs on the next tick. A reload never runs a task early and never postpones it by restarting its clock.

A task whose value did not change is not touched. An invalid value on reload is not applied: the running value is kept and a WARNING names the key. An edit made from the panel takes effect at the next `/ul reload`. A panel write that sets a bound key outside the range above, such as `0`, is refused like a `@Range` violation, and nothing is written.

### Binding restrictions

- Sync only. A bound method cannot be `async = true`; that combination is refused at load. Bind a sync task and hand the heavy work to `Bukkit.getScheduler().runTaskAsynchronously(...)` from its body. Literal `async` tasks are unaffected. Issue [#535](https://github.com/UltiKits/UltiTools-Reborn/issues/535) tracks allowing async bindings.
- Declared methods only. The binding is found on the bean class's own declared methods, the same as an unbound `@Scheduled`. A method inherited from a superclass is neither scheduled nor checked, so declare the bound method on the bean class itself ([#532](https://github.com/UltiKits/UltiTools-Reborn/issues/532)).
- No `@Range` on a bound field. The binding's range above is the field's range. A module `@Range` on the same field would make an out-of-range reload throw from the config reload itself, which aborts the rest of that module's reload ([#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509)) instead of keeping the running value. If the field already had a `@Range` before you bound it, remove it.
- Modules only. A binding on a bean of an [External Plugin API](/guide/advanced/external-plugin-api) plugin is refused.

### Required `api-version`

A module that uses a binding must declare `api-version: 630` in its `plugin.yml`. A 6.2.x framework does not know these attributes and silently ignores them, so a bound task would run once at load instead of on its interval. The declared floor makes the older framework refuse the module instead. 6.3.0 itself refuses a module that uses a binding while declaring a lower `api-version`. See [Module Versioning](/guide/advanced/module-versioning#new-annotation-attributes) for why the `pom.xml` pin alone does not protect you.

::: tip Binding a cooldown
`@CmdCD` accepts the same kind of binding for command cooldowns, see [Command cooldown](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key).
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
