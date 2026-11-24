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

## Inherited Methods

As of v6.3.0 the framework looks for `@Scheduled` methods on the bean class and on its superclasses, so a method an abstract base service declares is scheduled for every bean that extends it. An overridden method is scheduled once, with the annotation on the most derived declaration. An override that does not carry `@Scheduled` itself is not scheduled, because Java does not inherit annotations on methods. Before v6.3.0 only the bean class's own declared methods were scanned, and a `@Scheduled` method inherited from a superclass never ran ([#532](https://github.com/UltiKits/UltiTools-Reborn/issues/532)).

## One-Time Delayed Task

Set only `delay` (leave `period` at default `-1`) to run a task once after a delay:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## Repeating Task

Set `period` to a positive value to create a repeating task:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## Async Tasks

Set `async = true` for tasks that don't need to access the Bukkit API directly (e.g., database operations, HTTP requests):

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

As of v6.4.0, `async = true` also supports tasks whose timing is [bound to a config key](#config-bound-timing). Versions from v6.3.0 before v6.4.0 refuse async bindings; literal async tasks are unchanged.

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

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleService.java

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

A task whose value did not change is not touched. An invalid value on reload is not applied: the running value is kept and a WARNING names the key. As of v6.3.0 the reload is also reported as partial, naming the key, the refused value and the value kept, so `/ul reload <name>`, the `/ul reload` summary and a module's own reload command built on `reloadWithReport()` do not reply plain success ([#595](https://github.com/UltiKits/UltiTools-Reborn/issues/595)). An edit made from the panel takes effect at the next `/ul reload`. A panel write that sets a bound key outside the range above, such as `0`, is refused like a `@Range` violation, and nothing is written.

As of v6.3.2, a failure part-way through a bound timing refresh reports that updates already applied remain effective and the remaining updates did not complete. Tasks and cooldowns are updated individually, without rollback. Framework-owned rules and incomplete-config reasons in reload reports follow the server language, including Chinese; arbitrary exception messages from other code are not translated.

### Binding restrictions

- Async bindings are available as of v6.4.0; earlier versions refuse them at load. The trigger and reload phase follow the contract below. Literal `async` tasks and sync bindings are unchanged.
- Inherited methods included. As of v6.3.0 the binding is found on the same methods as an unbound `@Scheduled`, including one inherited from a superclass, which is scheduled and checked at load like one the bean class declares. (Before v6.3.0 only the bean class's own declared methods were scanned, and a method inherited from a superclass was neither scheduled nor checked, [#532](https://github.com/UltiKits/UltiTools-Reborn/issues/532).)
- No `@Range` on a bound field. The binding's range above is the field's range. A module `@Range` on the same field would instead make the configuration reload itself fail when a value is out of range, which stops the rest of that module's reload and reports it as failed (since [#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509), fixed in 6.3.0, a full `/ul reload` still continues with the next module), instead of keeping the running value. If the field already had a `@Range` before you bound it, remove it.
- Modules only. A binding on a bean of an [External Plugin API](/guide/advanced/external-plugin-api) plugin is refused.

### Config-bound async execution

As of v6.4.0, a bound method may set `async = true`. A synchronous trigger records its fire tick on the main thread, then submits the method body with a one-tick async delay. The body starts one scheduler heartbeat after the trigger, or later under load. The period and reload phase are measured between triggers, not worker starts or completions.

Reload preserves the trigger cycle: last observed fire plus the new period, or the next tick if overdue; before the first fire, the anchor remains the arm tick plus the new delay. Already-dispatched work is left alone. Slow bodies may overlap and must not call thread-unsafe Bukkit APIs. Unload cancels the trigger and queued workers; an already-running body may finish. This does not change literal async scheduling or sync bindings.

### Required `api-version`

In 6.x, a module using a binding must declare an API level of at least `630` in its `plugin.yml` (`api-version: 630` when targeting 6.3.0). A 6.2.x framework does not know these attributes and silently ignores them, so a bound task would run once at load instead of on its interval. The declared floor makes the older framework refuse the module instead. 6.3.0 itself refuses a module that uses a binding while declaring a lower `api-version`. See [Module Versioning](/guide/advanced/module-versioning#new-annotation-attributes) for why the `pom.xml` pin alone does not protect you.

As of v7.0.0, all modules, whether or not they use bindings, must be rebuilt against 7.0 and declare at least `api-version: 700`; see [Modules from 6.x to 7.0](/guide/advanced/module-versioning#modules-6x-to-7).

::: tip Binding a cooldown
`@CmdCD` accepts the same kind of binding for command cooldowns, see [Command cooldown](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key).
:::

## Scheduler API <Badge type="tip" text="v7.0.0+" />

::: info As of v7.0.0
Modules can inject `com.ultikits.ultitools.scheduling.Scheduler` and submit tasks to it directly. `@Scheduled` runs on the same scheduler. This is unreleased 7.0 behaviour.
:::

Each module instance owns one `Scheduler`. Inject it into a module bean:

```java
@Service
public class RewardService {
    @Autowired
    private Scheduler scheduler;

    public void rewardLater(Player player) {
        scheduler.entity(player).runLater(Duration.ofSeconds(5), () -> player.sendMessage("Thanks for playing!"));
    }
}
```

A `Scheduler` hands out a `TaskContext` per thread affinity. Pick the one that matches the data the task touches:

| Method | Runs on | Use for |
|--------|---------|---------|
| `global()` | Server main thread, tick based | World time, weather, server state |
| `region(Location)` / `region(World, chunkX, chunkZ)` | Server main thread, tick based | Blocks and chunks; `region(Location)` throws `IllegalArgumentException` if the location has no world |
| `entity(Entity)` | Server main thread, tick based | Work that follows one entity or player |
| `async()` | Async pool, wall-clock based | I/O, networking, computation; never Bukkit API work |

On Paper all three tick contexts run on the main thread; the contract does not declare Folia support.

### Submitting tasks

A `TaskContext` offers these methods, which also make it a `java.util.concurrent.Executor`:

| Method | Behaviour |
|--------|-----------|
| `run(Runnable)` | Runs once, never inline; on a tick context, on the next tick |
| `runLater(Duration, Runnable)` | Runs once after a delay; a zero delay behaves as `run`; a negative delay throws `IllegalArgumentException` |
| `runRepeating(Duration, Duration, Consumer<TaskHandle>)` | Runs after the initial delay, then at the period, until cancelled, retired or unloaded. The consumer receives its own handle and may cancel itself |
| `supply(Supplier<T>)` | Runs once and completes the returned `CompletableFuture` with the result or the exception |
| `isCurrentThread()` | Whether the calling thread owns this context. The async context always answers `false` |

Tick contexts round delays and periods up to whole ticks (`Ticks.ceil`), at a nominal 50 ms per tick, so they stretch when the server lags. A period must be at least one tick on a tick context and positive on the async context. `Ticks.of(long)` converts a tick count to a `Duration`.

An exception thrown by one execution of a repeating task is logged with the owner's name and does not stop the repetition. A one-shot task that throws ends `FAILED`; a repeating task never ends `FAILED`.

### Handles and cancellation

Every submission returns a `TaskHandle` with `state()`, `isRepeating()`, `cancel()` and `completion()`. States are `SCHEDULED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` and `RETIRED`.

- `cancel()` stops every run that has not started and never interrupts a run in progress. It returns `true` only for the call that moved the task to `CANCELLED`.
- A one-shot task that is already `RUNNING` cannot be cancelled: `cancel()` returns `false` and the task ends `COMPLETED` or `FAILED`.
- `completion()` completes normally after a successful one-shot, and exceptionally with the thrown exception (`FAILED`), a `CancellationException` (`CANCELLED`, including module unload) or a `TaskRetiredException` (`RETIRED`).
- Cancelling the future returned by `supply` before it completes always succeeds. A task that has not started never runs; one that has started finishes and its result is discarded.

### Behaviour to plan for

::: warning Async repeating tasks run at a fixed rate
The period is counted between the starts of consecutive runs, not from the end of one run to the start of the next. The gap between two consecutive runs of an async repeating task is therefore not guaranteed to be a full period. In the current implementation the runs of one repeating task do not execute concurrently, so a run that is still busy delays the next one, but the contract leaves overlap unspecified; do not rely on either behaviour.
:::

::: warning Entity tasks end when the entity is removed
A task bound to an entity is retired (`RETIRED`) when that entity is removed: for a non-player entity that dies, despawns or is discarded, and for a player when they disconnect. A player who dies and respawns, and any entity changing dimension, keeps its tasks. On an already removed entity, `run`, `runLater` and `runRepeating` return a handle that is already `RETIRED`, `supply` returns a future failed with `TaskRetiredException`, and `execute` throws `RejectedExecutionException`.
:::

An async task has no upper bound on its start time beyond "eventually", because it depends on the server's async pool. Do not call thread-unsafe Bukkit API from it.

### Unload and shutdown

Unloading the owning module cancels every task of that module that has not started and every repeating task. A one-shot task that is running at that moment finishes. After the unload, every submission throws `RejectedExecutionException`; obtaining a context never throws, submitting to it does. Server shutdown unloads every module, so its tasks end the same way, and framework-owned tasks are cancelled afterwards.

## Automatic Lifecycle

Tasks annotated with `@Scheduled` are automatically managed by the framework:

- **Registration**: Tasks are discovered and started when the plugin loads
- **Cancellation**: All tasks are automatically cancelled when the owning plugin is unloaded or the server shuts down

You do not need to track or cancel tasks manually. As of v7.0.0, `@Scheduled` methods run on the module's own `Scheduler`: `async = true` uses its `async()` context and every other method its `global()` context, with `delay` and `period` still counted in ticks.

## Requirements

- The annotated method must be `void` and take **no parameters**
- The method must be inside a bean managed by the container (e.g., `@Service`)
- The bean must be in a package scanned by `@UltiToolsModule(scanBasePackages = {...})`. The main class below uses `scanBasePackageClasses = BoundScheduleService.class` to scan the example services' package.

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ServerMonitorService.java
