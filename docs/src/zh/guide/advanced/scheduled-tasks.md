# 定时任务

::: info 自 v6.2.0 起
`@Scheduled` 注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 提供了声明式的方式来调度重复或延迟任务。无需手动创建 `BukkitRunnable` 对象，只需在方法上添加 `@Scheduled` 注解，框架会自动处理其余工作。

## 基本用法

在任意受容器管理的 Bean（如 `@Service`）中，给 `void`、无参方法添加 `@Scheduled`：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/AutoSaveService.java

::: tip Tick 换算
Minecraft 以每秒 20 tick 的速率运行：1 秒等于 20 tick，1 分钟等于 1,200 tick，5 分钟等于 6,000 tick，30 分钟等于 36,000 tick。
:::

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `delay` | `long` | `0` | 首次执行前的延迟 tick 数 |
| `period` | `long` | `-1` | 重复间隔 tick 数。`-1` 表示只执行一次 |
| `async` | `boolean` | `false` | 在异步线程而非主线程上运行 |

自 v6.3.0 起，`period` 和 `delay` 也可以通过 `config`、`periodKey`、`delayKey` 从配置项读取，见[绑定到配置项的时间](#绑定到配置项的时间)。

## 继承的方法

自 v6.3.0 起，框架会在 Bean 类及其父类上查找 `@Scheduled` 方法，因此抽象基础服务声明的方法，会为每一个继承它的 Bean 调度。被重写的方法只调度一次，使用最末一级声明上的注解。自身没有标注 `@Scheduled` 的重写方法不会被调度，因为 Java 不会继承方法上的注解。v6.3.0 之前只扫描 Bean 类自身声明的方法，从父类继承的 `@Scheduled` 方法从不执行（[#532](https://github.com/UltiKits/UltiTools-Reborn/issues/532)）。

## 一次性延迟任务

只设置 `delay`（`period` 保持默认 `-1`）即可在延迟后执行一次：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## 重复任务

设置 `period` 为正数即可创建重复任务：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## 异步任务

对于不需要直接访问 Bukkit API 的任务（如数据库操作、HTTP 请求），设置 `async = true`：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

自 v6.4.0 起，`async = true` 也支持[绑定到配置项](#绑定到配置项的时间)的任务。v6.3.0 起、v6.4.0 之前的版本会拒绝异步绑定；字面量异步任务不变。

::: warning Bukkit 线程安全
当 `async = true` 时，任务在非主线程上运行。你**不能**从异步线程调用大多数 Bukkit API 方法。如果需要在异步任务中与 Bukkit API 交互，请切换回主线程：

```java
Bukkit.getScheduler().runTask(UltiTools.getInstance(), () -> {
    // 在这里可以安全调用 Bukkit API
    player.sendMessage("操作完成！");
});
```
:::

## 绑定到配置项的时间 <Badge type="tip" text="v6.3.0+" />

::: info 自 v6.3.0 起
`@Scheduled` 可以从模块自己的配置文件中读取执行间隔和首次延迟，服主因此可以直接调整间隔，你不需要再手写第二套调度逻辑。
:::

不写 `period` 和 `delay` 字面量，改用 `periodKey` 和 `delayKey` 指定一个 `@ConfigEntry` 路径，并用 `config` 指定配置实体类。读取到的值以秒为单位，乘以 20 换算为 tick。默认值只写在配置字段上：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/BoundScheduleService.java

`delayKey` 可以与 `periodKey` 指向同一个键，这样首次执行会先等待一个完整的间隔。像发放利息这类不应在加载时立即执行的任务，通常就需要这样写。键按 `@ConfigEntry(path = ...)` 声明的路径匹配；`path` 为空时按字段名匹配。

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `config` | `Class<? extends AbstractConfigEntity>` | `AbstractConfigEntity.class`（未绑定） | `periodKey` 与 `delayKey` 所指键所在的配置实体类 |
| `periodKey` | `String` | `""`（未绑定） | 其值（秒）作为重复间隔的键，取代 `period` |
| `delayKey` | `String` | `""`（未绑定） | 其值（秒）作为首次延迟的键，取代 `delay` |

### 加载时检查

绑定在模块加载时检查。任何一项不通过，只有该模块被拒绝加载，日志中会给出键名和值。以下情况会拒绝模块：

- 字面量与取代它的键同时设置（`period` 与 `periodKey`，或 `delay` 与 `delayKey`）；
- 该配置类没有为模块恰好注册一次。指向目录的 `@ConfigEntity` 不能用于绑定；
- 键没有匹配到任何 `@ConfigEntry` 路径；
- 被绑定字段的类型不是 `int`、`long`、`Integer` 或 `Long`；
- 值为 `null`、小于 1 秒，或大于 107,374,182 秒（`Integer.MAX_VALUE / 20`，约 3.4 年）。`0` 不表示关闭。

### 重载行为

修改后的值在执行 `/ul reload` 时生效，任务保持它在当前周期中的位置：下一次执行时间为上一次执行时间加上新的间隔；如果任务还没有执行过，则为任务启动时间加上新的延迟。如果这个时间点已经过去，任务会在下一个 tick 执行。重载不会让任务提前执行，也不会因为重新计时而推迟它。

值没有变化的任务不受影响。重载时读到无效的值不会被应用：保留当前正在使用的值，并输出一条指明该键的 WARNING。自 v6.3.0 起，这次重载还会被报告为部分重载，写明该键、被拒绝的值和继续使用的值，因此 `/ul reload <模块名>`、`/ul reload` 的汇总以及基于 `reloadWithReport()` 的模块自有重载命令都不会只回复成功（[#595](https://github.com/UltiKits/UltiTools-Reborn/issues/595)）。通过面板所做的修改在下一次 `/ul reload` 时生效。面板写入如果把被绑定的键设为上述范围之外的值（例如 `0`），会像违反 `@Range` 一样被拒绝，不会写入任何内容。

自 v6.3.2 起，绑定时间刷新到一半失败时，报告会说明此前已应用的更新继续生效，其余更新未完成。任务和冷却逐个更新，不回滚。重载报告中框架自有的规则及配置未完成原因遵循服务器语言，包括中文；其他代码提供的任意异常消息不会被翻译。

### 绑定的限制

- 自 v6.4.0 起支持异步绑定；更早版本会在加载时拒绝。触发器和重载相位遵循下文的约定。字面量 `async` 任务与同步绑定不变。
- 包括继承的方法。 自 v6.3.0 起，绑定与未绑定的 `@Scheduled` 在同样的方法上查找，包括从父类继承的方法，它会像 Bean 类自身声明的方法一样被调度、在加载时被检查。（v6.3.0 之前只查找 Bean 类自身声明的方法，从父类继承的方法既不会被调度，也不会被检查，[#532](https://github.com/UltiKits/UltiTools-Reborn/issues/532)。）
- 被绑定的字段不要加 `@Range`。上述绑定范围就是该字段的范围。如果同一字段上还有模块自己的 `@Range`，重载时超出范围的值会让配置重载本身失败，停止该模块其余的重载步骤并报告为失败（[#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509) 已在 6.3.0 修复：完整的 `/ul reload` 仍会继续重载下一个模块），而不是保留当前正在使用的值。如果字段在绑定之前已经带有 `@Range`，请将其删除。
- 只支持 UltiTools 模块。 [外部插件 API](/zh/guide/advanced/external-plugin-api) 插件的 Bean 上的绑定会被拒绝。

### 配置绑定的异步执行

自 v6.4.0 起，被绑定的方法可以设置 `async = true`。同步触发器先在主线程记录触发 tick，再以一 tick 异步延迟提交方法体。方法体在触发后的一个调度心跳开始，负载较高时可能更晚。周期和重载相位按触发器之间的时间计算，不按异步方法体的开始或完成时间计算。

重载保留触发器周期：上次观察到的触发时间加新周期，已过期时为下一 tick；首次触发之前仍以启动 tick 加新延迟为准。已派发的工作不受重载影响。耗时方法体可能重叠运行，不能调用非线程安全的 Bukkit API。卸载会取消触发器和排队的方法体，已经运行的方法体可以完成。字面量异步调度与同步绑定不变。

### 必需的 `api-version`

在 6.x 中，使用绑定的模块须在 `plugin.yml` 中声明不低于 `630` 的 API 级别（面向 6.3.0 时为 `api-version: 630`）。6.2.x 框架不认识这些属性，会静默忽略它们，被绑定的任务于是只会在加载时执行一次，而不是按间隔重复执行。声明这个下限后，旧框架会直接拒绝加载该模块。6.3.0 自身也会拒绝使用了绑定、却声明了更低 `api-version` 的模块。为什么只提高 `pom.xml` 中的 pin 不够，见[模块版本规范](/zh/guide/advanced/module-versioning#新增的注解属性)。

自 v7.0.0 起，所有模块（无论是否使用绑定）都必须针对 7.0 重新构建并声明至少 `api-version: 700`，见[6.x 模块升到 7.0](/zh/guide/advanced/module-versioning#modules-6x-to-7)。

::: tip 绑定命令冷却
`@CmdCD` 也支持同样的绑定方式，见[命令冷却](/zh/guide/essentials/cmd-executor#配置项绑定的冷却时间)。
:::

## 调度器 API <Badge type="tip" text="v7.0.0+" />

::: info 自 v7.0.0 起
模块可以注入 `com.ultikits.ultitools.scheduling.Scheduler` 并直接提交任务；`@Scheduled` 运行在同一个调度器上。这是尚未发布的 7.0 行为。
:::

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
| `runRepeating(Duration, Duration, Consumer<TaskHandle>)` | 初始延迟后按周期重复，直到被取消、退役或卸载。回调会收到自己的句柄，可以自行取消 |
| `supply(Supplier<T>)` | 执行一次，并用结果或抛出的异常完成返回的 `CompletableFuture` |
| `isCurrentThread()` | 调用线程当前是否拥有该上下文。异步上下文始终返回 `false` |

tick 上下文把延迟和周期向上取整为整数 tick（`Ticks.ceil`），名义上每 tick 50 毫秒，服务器卡顿时会被拉长。tick 上下文的周期至少为一个 tick，异步上下文的周期必须为正。`Ticks.of(long)` 把 tick 数转换为 `Duration`。

重复任务的某次执行抛出异常时，会连同所属者名称记录日志，不会中断重复。一次性任务抛出异常则以 `FAILED` 结束；重复任务永远不会以 `FAILED` 结束。

自 v7.0.0 起，通过 `run`、`runLater` 或 `execute` 提交的一次性任务抛出异常时，还会恰好记录一条 WARNING（`Error executing scheduled task of <所属者>`），附带原始异常及其堆栈，与 6.x 的 Bukkit 调度器一致；其 `completion()` 仍以该异常失败。`supply` 失败只交给返回的 future，不记录日志；只有 future 在任务开始后被取消、异常已无法被观察时，才记录一次。

### 句柄与取消

每次提交都返回 `TaskHandle`，提供 `state()`、`isRepeating()`、`cancel()` 与 `completion()`。状态有 `SCHEDULED`、`RUNNING`、`COMPLETED`、`FAILED`、`CANCELLED`、`RETIRED`。

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

异步任务除“最终会执行”外没有开始时间的上限，这取决于服务器的异步线程池。不要在其中调用非线程安全的 Bukkit API。

### 卸载与关服

卸载所属模块会取消该模块所有尚未开始的任务和所有重复任务；此刻正在运行的一次性任务会执行完。卸载之后，任何提交都抛出 `RejectedExecutionException`：获取上下文不会抛出，向其提交才会。关服会卸载所有模块，其任务以同样方式结束，随后取消框架自有的任务。

### 框架调度的工作

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
`datasource.flushRate` 必须是正数秒；负数不会启动 JSON 周期落盘（6.x 会落盘一次），停服时仍会写入数据。对同一玩家调用两次 `delayTeleport` 会启动两个倒计时，与 6.x 相同。
:::

在当前的 7.0 开发线上，异步命令方法体（`@RunAsync`、`@AsyncCommand`）和框架的启动消息仍运行在 Bukkit 调度器上，不由框架调度器拥有、取消或退役。

## 自动生命周期管理

使用 `@Scheduled` 注解的任务由框架自动管理：

- **注册**：插件加载时自动发现并启动任务
- **取消**：当所属插件卸载或服务器关闭时，所有任务自动取消

你无需手动追踪或取消任务。自 v7.0.0 起，`@Scheduled` 方法运行在模块自己的 `Scheduler` 上：`async = true` 使用其 `async()` 上下文，其余使用 `global()` 上下文，`delay` 与 `period` 仍以 tick 计。

## 使用要求

- 被注解的方法必须是 `void` 且**无参数**
- 方法必须在受容器管理的 Bean 中（如 `@Service`）
- Bean 必须在 `@UltiToolsModule(scanBasePackages = {...})` 扫描的包内。下面的主类用 `scanBasePackageClasses = BoundScheduleService.class` 扫描示例服务所在的包。

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ServerMonitorService.java
