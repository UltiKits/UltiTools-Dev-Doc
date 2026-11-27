# Scheduled Tasks

7.0.0 has not been released. This guide describes scheduling as of v7.0.0. For 6.x examples, see the [archived v6.4.0 guide](/v6.4.0/guide/advanced/scheduled-tasks.html). For changes to existing code, see [Scheduling and declarative GUI in the upgrade guide](upgrading-to-7#scheduler-and-screens).

Use `@Scheduled` for tasks attached to managed beans. Use an injected `com.ultikits.ultitools.scheduling.Scheduler` to submit work directly.

## Basic Usage

Add `@Scheduled` to any `void`, no-argument method inside a managed bean (such as a `@Service`):

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/AutoSaveService.java

::: tip Tick Conversion
At 20 ticks per second, 20 server ticks take one second; a slow server takes longer. A literal async annotation instead uses a fixed conversion of 50 ms per configured tick.
:::

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `delay` | `long` | `0` | Initial delay in ticks before first execution; a negative literal delay refuses module load as of v7.0.0 |
| `period` | `long` | `-1` | Repeat interval in ticks; a non-positive period means run once |
| `async` | `boolean` | `false` | Run the method body on an async worker rather than the main thread |

`period` and `delay` can instead be read from a config key through `config`, `periodKey` and `delayKey`; see [Config-Bound Timing](#config-bound-timing).

## Inherited Methods

The framework searches the bean class and its superclasses. A method inherited from a superclass is scheduled for each managed bean that inherits it. An override uses only the most derived declaration: if that declaration has no `@Scheduled`, the method is not scheduled. This applies to config-bound methods too.

## One-Time Delayed Task

Set only `delay` (leave `period` at default `-1`) to run a task once after a delay:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## Repeating Task

Set `period` to a positive value to create a repeating task:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## Async Tasks

Set `async = true` for work that does not access thread-unsafe Bukkit state, such as I/O or computation. With literal timing, both delay and period use wall-clock time (50 ms per configured tick); the following method is scheduled without an initial delay and repeats every 30 minutes, independent of server tick rate. This is different from [config-bound async execution](#config-bound-async-execution), which uses a server-tick trigger.

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

If the result requires Bukkit access, submit that part to the matching [scheduler context](#scheduler-api), for example `scheduler.entity(player).run(...)` for one player.

## Config-Bound Timing {#config-bound-timing}

A module can let a server operator tune its task timing through the module's configuration.

Use `periodKey`, `delayKey`, or both to replace the corresponding literal with a `@ConfigEntry` path. Give the config entity class with `config`. The value is read in seconds and multiplied by 20 to get ticks. The default lives only in the config field:

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleService.java

For 7.0, put these two classes in the same scanned package in your module, in separate `.java` files named after the classes. With automatic config registration enabled, let the framework discover the config class. With it disabled, return one instance of that class from `getAllConfigs()`. Do not create a separate config object for the task to read.

```java
package com.example.mymodule.scheduling;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;

@ConfigEntity("config/economy.yml")
public class BoundScheduleConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "interest.interval", comment = "Seconds between interest payouts")
    private int interestInterval = 1800;

    public BoundScheduleConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

```java
package com.example.mymodule.scheduling;

import com.ultikits.ultitools.annotations.Scheduled;
import com.ultikits.ultitools.annotations.Service;

@Service
public class BoundScheduleService {
    @Scheduled(config = BoundScheduleConfig.class, periodKey = "interest.interval", delayKey = "interest.interval")
    public void distributeInterest() {
        // Add the payout logic here.
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

The framework rejects invalid bindings at module load. For example, it refuses a module when:

- `config` is missing or neither key is set, or a key is paired with a non-default literal for the same setting;
- the config class is not registered exactly once for the module. A directory `@ConfigEntity` cannot be bound;
- the key matches no `@ConfigEntry` path;
- the bound field is not an `int`, `long`, `Integer` or `Long`;
- the value is `null`, below 1 second, or above 107,374,182 seconds (`Integer.MAX_VALUE / 20`). `0` does not mean off;
- the literal delay in a partially bound task is negative, or the literal delay or period exceeds 2,147,483,640 ticks (107,374,182 × 20).

### Applying changes on reload

A valid change takes effect on `/ul reload`. The next trigger is calculated from the last trigger plus the new period, or from the original arm tick plus the new delay before the first trigger. If it is already due, the trigger runs on the next tick. Reload leaves unchanged timings alone and does not restart a one-shot task that has already fired.

For a refused value, the running timing is kept, the framework logs a WARNING, and the reload report records a partial result with the key, refused value and timing kept. The framework localizes its own binding reasons. If an update fails partway through the binding step, the report says which outcome applies: changes already applied remain in effect, and the remaining updates did not complete. A panel edit takes effect at the next reload; an out-of-range bound value is refused before it can be written.

### Binding restrictions

- Avoid adding `@Range` to a bound field. A custom range can make configuration reload fail before the task binding can handle the value and keep the running timing.
- Only modules can bind timing. The [External Plugin API](external-plugin-api) supports literal `@Scheduled` tasks on discovered beans but rejects config-bound tasks.

### Config-bound async execution

A bound method can set `async = true`. The `global()` trigger records its server tick and submits the method body to `async()` with a wall-clock delay of 50 ms. This is not a wait for the next server tick. The timing and reload phase are measured between trigger ticks, not worker starts or completions.

Reload leaves already dispatched bodies alone. Slow bodies from separate triggers may overlap. Unload cancels pending triggers and queued bodies, but a body already running may finish.

### Required `api-version`

The 7.0 module descriptor must declare an integer `api-version` of at least `700` and no higher than the running framework’s API level, whether or not the module uses bindings. See the [upgrade guide](upgrading-to-7).

::: tip Binding a cooldown
`@CmdCD` accepts the same kind of binding for command cooldowns, see [Command cooldown](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key).
:::

## Scheduler API {#scheduler-api}

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
| `runRepeating(Duration, Duration, Consumer<? super TaskHandle>)` | Runs after the initial delay, then at the period, until cancelled, retired or unloaded. The consumer receives its own handle and may cancel itself |
| `supply(Supplier<? extends T>)` | Runs once and completes the returned `CompletableFuture` with the result or the exception |
| `isCurrentThread()` | Whether the calling thread owns this context. The async context always answers `false` |

Tick contexts round delays and periods up to whole ticks (`Ticks.ceil`), at a nominal 50 ms per tick, so they stretch when the server lags. A period must be at least one tick on a tick context and positive on the async context. `Ticks.of(long)` converts a tick count to a `Duration`.

An exception thrown by one execution of a repeating task is logged with the owner's name and does not stop the repetition. A one-shot task that throws ends `FAILED`; a repeating task never ends `FAILED`.

As of v7.0.0, a one-shot task submitted through `run`, `runLater` or `execute` that throws also logs exactly one WARNING, `[UltiTools-API] Error executing scheduled task of <owner>`, with the original exception and its stack trace, as the Bukkit scheduler did in 6.x. Its `completion()` still fails with that exception. A failing `supply` is reported only through its future and logs nothing, unless the future was cancelled after the task started; that otherwise unobservable failure is logged once.

### Handles and cancellation

`run`, `runLater` and `runRepeating` return a `TaskHandle` with `state()`, `isRepeating()`, `cancel()` and `completion()`. States are `SCHEDULED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` and `RETIRED`.

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

An async delay is not a deadline: the actual start depends on the server’s async pool. Do not call thread-unsafe Bukkit API from it.

### Unload and shutdown

Unloading a module retires its scheduler before `onUnregister()` or `@PreDestroy`: queued work and repeating tasks are cancelled, and a running one-shot may finish. Submission to a retired owner throws `RejectedExecutionException`, so perform cleanup directly in those callbacks. A failed module load also retires the instance’s scheduler, including work submitted in bean construction, `@PostConstruct` or `registerSelf()`. Neither path cancels another module instance’s work or direct Bukkit tasks.

### Framework-scheduled work {#framework-scheduled-work}

As of v7.0.0, the framework schedules its own background and main-thread work on a framework-owned `Scheduler` whose owner name is `UltiTools`, with the same contexts and rules as a module's scheduler ([#963](https://github.com/UltiKits/UltiTools-Reborn/pull/963)). Module code does not change; the differences you can observe are these:

| Framework work | Context |
|----------------|---------|
| `TeleportService#delayTeleport` countdown | `entity(player)` |
| Move check that cancels a delayed teleport | `global()` |
| Update check, periodic JSON flush (`datasource.flushRate`), credential revoke on panel logout | `async()` |
| `PanelMessageEvent` publish, PlaceholderAPI expansion download on join, the start-up economy report, panel power actions, telemetry and metrics hand-offs | `global()` |

- **Delayed teleport.** The countdown runs on the player's entity context and ends as soon as the player leaves the server. The move check reads player positions on the main thread, no longer from an async thread.
- **Failures.** A framework one-shot task that throws logs the WARNING described in [Submitting tasks](#submitting-tasks), naming `UltiTools`. Log records emitted inside a framework scheduler task are attributed as a scheduled task named `Scheduler`; records from a `BukkitRunnable` keep their `BukkitRunnable` attribution.
- **Lifetime.** `/ul reload` neither cancels nor restarts framework work; repeating framework tasks keep running once each. A module unload does not touch it. Framework work is cancelled when UltiTools is disabled, after every module has been unloaded. A panel message that arrives while UltiTools is disabling is dropped with one `FINE` log line instead of being scheduled.
- **Threading for callbacks.** Handlers of `PanelMessageEvent` run on the main thread through the framework's `global()` context. A panel responder still runs on a framework worker thread; see [Panel Integration](/guide/advanced/panel-integration).

::: warning Known limitations
A positive `datasource.flushRate` sets the JSON flush period in wall-clock seconds; a missing value or `0` uses `10` seconds, and a negative value disables periodic flushing (6.x flushed once). Normal shutdown still attempts a final checkpoint. Calling `delayTeleport` twice for one player starts two countdowns, as in 6.x.
:::

As of v7.0.0, async command bodies (`@RunAsync`, `@AsyncCommand`) and the command timeout watcher run on the framework scheduler; during module unload the framework waits for bodies still running; see [Command Executor](../essentials/cmd-executor). The framework’s startup messages also use its `global()` context.

## Automatic Lifecycle

UltiTools schedules eligible bean methods after `registerSelf()` succeeds. When the module unloads or the server stops, the owning scheduler cancels pending and repeating tasks; a running method can finish. If an annotated method throws, the framework logs a WARNING naming the method. A repeating annotation continues on subsequent triggers. This warning comes from the annotation handler, not from the direct `Scheduler` task-failure contract above.

## Requirements

- The annotated method must be `void` and take **no parameters**
- The method must be inside a bean managed by the container (e.g., `@Service`)
- Put auto-discovered beans in a scanned package. The module’s own package is the default; the main class below selects the example services’ package with `scanBasePackageClasses = BoundScheduleService.class`.

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## Complete Example

This bean schedules a heap check once a minute in wall-clock time, then submits the Bukkit operation to `global()` only when needed.

```java
@Service
public class ServerMonitorService {
    @Autowired
    private Scheduler scheduler;

    @Scheduled(delay = 1200, period = 1200, async = true)
    public void checkHeap() {
        Runtime runtime = Runtime.getRuntime();
        long used = runtime.totalMemory() - runtime.freeMemory();
        if (used > runtime.maxMemory() * 0.9) {
            scheduler.global().run(() -> Bukkit.getLogger().warning("Heap usage is above 90%"));
        }
    }
}
```
