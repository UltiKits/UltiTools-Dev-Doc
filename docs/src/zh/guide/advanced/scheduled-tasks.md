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

使用绑定的模块必须在 `plugin.yml` 中声明 `api-version: 630`。6.2.x 框架不认识这些属性，会静默忽略它们，被绑定的任务于是只会在加载时执行一次，而不是按间隔重复执行。声明这个下限后，旧框架会直接拒绝加载该模块。6.3.0 自身也会拒绝使用了绑定、却声明了更低 `api-version` 的模块。为什么只提高 `pom.xml` 中的 pin 不够，见[模块版本规范](/zh/guide/advanced/module-versioning#新增的注解属性)。

::: tip 绑定命令冷却
`@CmdCD` 也支持同样的绑定方式，见[命令冷却](/zh/guide/essentials/cmd-executor#配置项绑定的冷却时间)。
:::

## 自动生命周期管理

使用 `@Scheduled` 注解的任务由框架自动管理：

- **注册**：插件加载时自动发现并启动任务
- **取消**：当所属插件卸载或服务器关闭时，所有任务自动取消

你无需手动追踪或取消任务。

## 使用要求

- 被注解的方法必须是 `void` 且**无参数**
- 方法必须在受容器管理的 Bean 中（如 `@Service`）
- Bean 必须在 `@UltiToolsModule(scanBasePackages = {...})` 扫描的包内。下面的主类用 `scanBasePackageClasses = BoundScheduleService.class` 扫描示例服务所在的包。

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ServerMonitorService.java
