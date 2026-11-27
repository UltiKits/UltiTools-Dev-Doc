# 定时任务

7.0.0 尚未发布。本页介绍自 v7.0.0 起的调度行为。6.x 示例见 [v6.4.0 归档指南](/zh/v6.4.0/guide/advanced/scheduled-tasks.html)。现有代码的改动见[升级指南中的调度与声明式 GUI](upgrading-to-7#scheduler-and-screens)。

用 `@Scheduled` 声明受管理 Bean 的定时任务。需要直接提交任务时，注入 `com.ultikits.ultitools.scheduling.Scheduler`。

## 基本用法

在任意受容器管理的 Bean（如 `@Service`）中，给 `void`、无参方法添加 `@Scheduled`：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/AutoSaveService.java

::: tip Tick 换算
服务器以每秒 20 tick 运行时，20 个服务端 tick 等于一秒；服务器卡顿时所需时间会增加。使用字面量的异步任务则按每个配置 tick 固定换算为 50 毫秒。
:::

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `delay` | `long` | `0` | 首次执行前的延迟 tick 数；自 v7.0.0 起，负数延迟字面量会导致模块加载被拒绝 |
| `period` | `long` | `-1` | 重复间隔 tick 数；非正数表示只执行一次 |
| `async` | `boolean` | `false` | 在异步工作线程而非主线程上运行方法体 |

`period` 和 `delay` 也可以通过 `config`、`periodKey`、`delayKey` 从配置项读取，见[绑定到配置项的时间](#绑定到配置项的时间)。

## 继承的方法

框架在 Bean 类及其父类上查找注解。每个继承了父类方法的受管理 Bean 都会调度该方法。对于重写的方法，只看最具体的声明；若该声明未标注 `@Scheduled`，则不调度。配置绑定的方法也遵循同样的规则。

## 一次性延迟任务

只设置 `delay`（`period` 保持默认 `-1`）即可在延迟后执行一次：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## 重复任务

设置 `period` 为正数即可创建重复任务：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## 异步任务

不访问非线程安全 Bukkit 状态的工作（如 I/O 或计算）可以设置 `async = true`。使用字面量时，延迟和周期都按实际时间计（每个配置 tick 为 50 毫秒）；下面的方法未设置首次延迟，之后按 30 分钟的周期调度，不取决于服务端 tick 速率。[配置绑定的异步执行](#配置绑定的异步执行)不同，触发器按服务端 tick 计时。

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

需要用结果访问 Bukkit 时，把这部分提交到对应的[调度上下文](#调度器-api)，例如对单个玩家用 `scheduler.entity(player).run(...)`。

## 绑定到配置项的时间 {#绑定到配置项的时间}

模块可以让服主通过模块配置调整任务的执行时间。

用 `periodKey`、`delayKey` 或两者指定 `@ConfigEntry` 路径，取代对应的字面量。用 `config` 指定配置实体类。读取到的值以秒为单位，乘以 20 换算为 tick。默认值只写在配置字段上：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleService.java

针对 7.0，可以把下面两个类放到模块的同一个扫描包中，各自保存为同名 `.java` 文件。自动注册开启时由框架扫描配置类；关闭时在 `getAllConfigs()` 中只返回一个该类的实例。不要另建一个配置对象给任务读取。

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

`delayKey` 可以与 `periodKey` 指向同一个键，这样首次执行会先等待一个完整的间隔。像发放利息这类不应在加载时立即执行的任务，通常就需要这样写。键按 `@ConfigEntry(path = ...)` 声明的路径匹配；`path` 为空时按字段名匹配。

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `config` | `Class<? extends AbstractConfigEntity>` | `AbstractConfigEntity.class`（未绑定） | `periodKey` 与 `delayKey` 所指键所在的配置实体类 |
| `periodKey` | `String` | `""`（未绑定） | 其值（秒）作为重复间隔的键，取代 `period` |
| `delayKey` | `String` | `""`（未绑定） | 其值（秒）作为首次延迟的键，取代 `delay` |

### 加载时检查

框架在模块加载时拒绝无效绑定。例如，以下情况会拒绝模块：

- 未指定 `config` 或两个键均未设置，或者同一设置同时指定了键和非默认字面量；
- 该配置类没有为模块恰好注册一次。指向目录的 `@ConfigEntity` 不能用于绑定；
- 键没有匹配到任何 `@ConfigEntry` 路径；
- 被绑定字段的类型不是 `int`、`long`、`Integer` 或 `Long`；
- 值为 `null`、小于 1 秒，或大于 107,374,182 秒（`Integer.MAX_VALUE / 20`）。`0` 不表示关闭；
- 仅绑定一项时，另一项的延迟字面量为负数，或延迟、周期的字面量超过 2,147,483,640 tick（107,374,182 × 20）。

### 重载行为

有效的改动在 `/ul reload` 时生效。下一次触发从上次触发加上新周期计算；首次触发前，则从原来的调度 tick 加上新延迟计算。如已到期，就在下一 tick 触发。未变的时间设置不受重载影响；已经触发的一次性任务不会重启。

值被拒绝时，框架保留运行中的设置，记录 WARNING，并在部分重载报告中写明键、被拒绝的值和保留的时间设置。框架自己的绑定原因会本地化。如果绑定更新中途失败，报告会说明此前已应用的更新继续生效，其余更新未完成。面板修改在下一次重载生效；绑定值超出范围时，面板在写入前拒绝。

### 绑定的限制

- 避免给绑定字段加 `@Range`。自定义范围可能让配置重载失败，导致任务绑定来不及处理该值并保留运行中的设置。
- 仅模块可以绑定时间。[外部插件 API](external-plugin-api) 支持在发现的 Bean 上使用字面量 `@Scheduled`，但会拒绝配置绑定任务。

### 配置绑定的异步执行

绑定方法可以设置 `async = true`。`global()` 触发器先记录服务端 tick，再把方法体提交到 `async()`，按实际时间延迟 50 毫秒。这不是等待下一次服务端 tick。周期与重载相位按触发器的 tick 计算，不按工作线程的开始或完成时间计算。

重载不会影响已派发的方法体。不同触发派发的耗时方法体可能重叠。卸载会取消尚未触发的任务和排队的方法体，已经运行的方法体可以完成。

### 必需的 `api-version`

无论是否使用绑定，7.0 的模块描述文件都必须声明整数 `api-version`，不低于 `700` 且不高于运行中的框架 API 级别。见[升级指南](upgrading-to-7)。

::: tip 绑定命令冷却
`@CmdCD` 也支持同样的绑定方式，见[命令冷却](/zh/guide/essentials/cmd-executor#配置项绑定的冷却时间)。
:::

## 调度器 API {#调度器-api}

每个模块实例拥有一个 `Scheduler`，可注入到模块的 Bean 中：

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

`Scheduler` 按线程归属提供不同的 `TaskContext`，请选择与任务所访问数据相符的一个：

| 方法 | 运行位置 | 用途 |
|------|----------|------|
| `global()` | 服务器主线程，按 tick 计时 | 世界时间、天气、服务器状态 |
| `region(Location)` / `region(World, chunkX, chunkZ)` | 服务器主线程，按 tick 计时 | 方块与区块；`region(Location)` 在位置没有世界时抛出 `IllegalArgumentException` |
| `entity(Entity)` | 服务器主线程，按 tick 计时 | 跟随某个实体或玩家的工作 |
| `async()` | 异步线程池，按真实时间计时 | I/O、网络、计算；不要做 Bukkit API 相关工作 |

在 Paper 上，三种 tick 上下文都运行在主线程；该契约不声明支持 Folia。

### 提交任务

`TaskContext` 提供下列方法，它同时也是 `java.util.concurrent.Executor`：

| 方法 | 行为 |
|------|------|
| `run(Runnable)` | 执行一次，绝不内联；tick 上下文中在下一个 tick 执行 |
| `runLater(Duration, Runnable)` | 延迟后执行一次；延迟为零等同于 `run`；负延迟抛出 `IllegalArgumentException` |
| `runRepeating(Duration, Duration, Consumer<? super TaskHandle>)` | 初始延迟后按周期重复，直到被取消、退役或卸载。回调会收到自己的句柄，可以自行取消 |
| `supply(Supplier<? extends T>)` | 执行一次，并用结果或抛出的异常完成返回的 `CompletableFuture` |
| `isCurrentThread()` | 调用线程当前是否拥有该上下文。异步上下文始终返回 `false` |

tick 上下文把延迟和周期向上取整为整数 tick（`Ticks.ceil`），名义上每 tick 50 毫秒，服务器卡顿时会被拉长。tick 上下文的周期至少为一个 tick，异步上下文的周期必须为正。`Ticks.of(long)` 把 tick 数转换为 `Duration`。

重复任务的某次执行抛出异常时，会连同所属者名称记录日志，不会中断重复。一次性任务抛出异常则以 `FAILED` 结束；重复任务永远不会以 `FAILED` 结束。

自 v7.0.0 起，通过 `run`、`runLater` 或 `execute` 提交的一次性任务抛出异常时，还会恰好记录一条 WARNING（`[UltiTools-API] Error executing scheduled task of <owner>`），附带原始异常及其堆栈，与 6.x 的 Bukkit 调度器一致；其 `completion()` 仍以该异常失败。`supply` 失败只交给返回的 future，不记录日志；只有 future 在任务开始后被取消、异常已无法被观察时，才记录一次。

### 句柄与取消

`run`、`runLater` 和 `runRepeating` 返回 `TaskHandle`，提供 `state()`、`isRepeating()`、`cancel()` 与 `completion()`。状态有 `SCHEDULED`、`RUNNING`、`COMPLETED`、`FAILED`、`CANCELLED`、`RETIRED`。

- `cancel()` 阻止所有尚未开始的执行，不会中断正在进行的执行。只有把任务变为 `CANCELLED` 的那一次调用返回 `true`。
- 已处于 `RUNNING` 的一次性任务无法取消：`cancel()` 返回 `false`，任务以 `COMPLETED` 或 `FAILED` 结束。
- `completion()` 在一次性任务成功后正常完成；否则异常完成：`FAILED` 为抛出的异常，`CANCELLED`（包括模块卸载）为 `CancellationException`，`RETIRED` 为 `TaskRetiredException`。
- 在 `supply` 返回的 future 完成之前取消它总是成功：尚未开始的任务不再运行；已开始的任务会执行完，结果被丢弃。

### 需要提前考虑的行为

::: warning 异步重复任务按固定频率运行
周期按相邻两次执行的开始时刻计算，而不是从上一次结束算到下一次开始。因此异步重复任务相邻两次执行之间的间隔不保证是完整的一个周期。在当前实现中，同一重复任务的各次执行不会并发，仍在忙的一次会推迟下一次；但契约没有规定是否重叠，请不要依赖这两种行为。
:::

::: warning 实体任务在实体被移除时结束
绑定到实体的任务在该实体被移除时退役（`RETIRED`）：非玩家实体死亡、消失或被丢弃时，玩家断开连接时。玩家死亡重生、实体切换维度，任务保持不变。对已被移除的实体，`run`、`runLater`、`runRepeating` 返回已处于 `RETIRED` 的句柄，`supply` 返回以 `TaskRetiredException` 失败的 future，`execute` 抛出 `RejectedExecutionException`。
:::

异步延迟不是开始期限，实际何时开始由服务器的异步线程池决定。不要在其中调用非线程安全的 Bukkit API。

### 卸载与关服

卸载模块时，框架在 `onUnregister()` 或 `@PreDestroy` 前停用其调度器：排队及重复任务会被取消，正在运行的一次性任务可以完成。向已停用的调度器提交任务会抛出 `RejectedExecutionException`，请直接在这些回调中执行清理。加载失败也会停用该实例的调度器，包括在 Bean 构建、`@PostConstruct` 或 `registerSelf()` 中提交的工作。两种情况都不会取消其他模块实例的工作，也不会取消直接提交给 Bukkit 的任务。

### 框架调度的工作 {#框架调度的工作}

自 v7.0.0 起，框架把自己的后台与主线程工作提交到一个框架自有的 `Scheduler`，其所属者名称为 `UltiTools`，上下文和规则与模块的调度器相同（[#963](https://github.com/UltiKits/UltiTools-Reborn/pull/963)）。模块代码无需改动，可以观察到的差异如下：

| 框架工作 | 上下文 |
|----------|--------|
| `TeleportService#delayTeleport` 的倒计时 | `entity(player)` |
| 取消延迟传送的移动检查 | `global()` |
| 更新检查、JSON 周期落盘（`datasource.flushRate`）、面板登出时吊销凭据 | `async()` |
| 发布 `PanelMessageEvent`、玩家加入时下载 PlaceholderAPI 扩展、启动时的经济状态报告、面板电源操作、遥测与统计数据的交接 | `global()` |

- **延迟传送。** 倒计时运行在该玩家的实体上下文中，玩家离开服务器时立即结束。移动检查在主线程上读取玩家位置，不再在异步线程上读取。
- **失败。** 框架的一次性任务抛出异常时，记录[提交任务](#提交任务)中所述的 WARNING，所属者为 `UltiTools`。在框架调度器任务中产生的日志记录，归因为名为 `Scheduler` 的定时任务；来自 `BukkitRunnable` 的记录仍归因为 `BukkitRunnable`。
- **生命周期。** `/ul reload` 不会取消或重启框架的工作，框架的重复任务仍各自只运行一份。卸载模块不影响它们。UltiTools 被禁用时，在所有模块卸载之后取消框架的工作。UltiTools 正在禁用时到达的面板消息不再调度，只记录一条 `FINE` 日志后丢弃。
- **回调线程。** `PanelMessageEvent` 的处理器通过框架的 `global()` 上下文在主线程上运行。面板 responder 仍在框架的工作线程上运行，见[面板集成](/zh/guide/advanced/panel-integration)。

::: warning 已知限制
`datasource.flushRate` 为正数时按实际时间设置 JSON 落盘周期（单位为秒）；缺省或 `0` 时使用 `10` 秒，负数禁用周期落盘，并在启动时记录一条警告（6.x 会落盘一次）。正常停服仍尝试最后一次落盘。对同一玩家调用两次 `delayTeleport` 会启动两个倒计时，与 6.x 相同。
:::

自 v7.0.0 起，异步命令方法体（`@RunAsync`、`@AsyncCommand`）与命令超时监视器运行在框架调度器上；卸载时框架会等待仍在运行的方法体，详见[命令执行器](../essentials/cmd-executor)。框架的启动消息也由框架调度器通过 `global()` 提交。

## 自动生命周期管理

`registerSelf()` 成功后，UltiTools 调度符合条件的 Bean 方法。模块卸载或停服时，所属调度器取消排队与重复任务，已经运行的方法可以完成。若被注解的方法抛出异常，框架会记录指明方法的 WARNING；重复任务仍会在之后触发。该警告来自注解处理逻辑，不适用上文直接使用 `Scheduler` 时的任务失败约定。

## 使用要求

- 被注解的方法必须是 `void` 且**无参数**
- 方法必须在受容器管理的 Bean 中（如 `@Service`）
- 让框架自动发现的 Bean 应放在扫描范围内。默认扫描模块主类所在的包；下面的主类用 `scanBasePackageClasses = BoundScheduleService.class` 选择示例服务所在的包。

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## 完整示例

这个 Bean 按实际时间每分钟调度一次堆内存检查，仅在需要时将 Bukkit 操作提交到 `global()`。

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
