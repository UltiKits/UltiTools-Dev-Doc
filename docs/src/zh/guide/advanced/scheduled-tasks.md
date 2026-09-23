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

## 一次性延迟任务

只设置 `delay`（`period` 保持默认 `-1`）即可在延迟后执行一次：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/WelcomeService.java

## 重复任务

设置 `period` 为正数即可创建重复任务：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ScoreboardService.java

## 异步任务

对于不需要直接访问 Bukkit API 的任务（如数据库操作、HTTP 请求），设置 `async = true`：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/InterestService.java

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

```java
@Getter
@Setter
@ConfigEntity("config/economy.yml")
public class EconomyConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "interest.interval", comment = "利息发放间隔（秒）")
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
        // 每隔 interest.interval 秒在主线程上执行一次
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

绑定在模块加载时检查。任何一项不通过，只有该模块被拒绝加载，日志中会给出键名和值。以下情况会拒绝模块：

- 字面量与取代它的键同时设置（`period` 与 `periodKey`，或 `delay` 与 `delayKey`）；
- 该配置类没有为模块恰好注册一次。指向目录的 `@ConfigEntity` 不能用于绑定；
- 键没有匹配到任何 `@ConfigEntry` 路径；
- 被绑定字段的类型不是 `int`、`long`、`Integer` 或 `Long`；
- 值为 `null`、小于 1 秒，或大于 107,374,182 秒（`Integer.MAX_VALUE / 20`，约 3.4 年）。`0` 不表示关闭。

### 重载时生效

修改后的值在执行 `/ul reload` 时生效，任务保持它在当前周期中的位置：下一次执行时间为上一次执行时间加上新的间隔；如果任务还没有执行过，则为任务启动时间加上新的延迟。如果这个时间点已经过去，任务会在下一个 tick 执行。重载不会让任务提前执行，也不会因为重新计时而推迟它。

值没有变化的任务不受影响。重载时读到无效的值不会被应用：保留当前正在使用的值，并输出一条指明该键的 WARNING。通过面板所做的修改在下一次 `/ul reload` 时生效。

### 绑定的限制

- 只支持同步任务。 被绑定的方法不能设置 `async = true`，这种组合会在加载时被拒绝。请绑定一个同步任务，再在方法体中通过 `Bukkit.getScheduler().runTaskAsynchronously(...)` 执行耗时工作。使用字面量的 `async` 任务不受影响。允许异步绑定的工作由 issue [#535](https://github.com/UltiKits/UltiTools-Reborn/issues/535) 跟踪。
- 只查找本类声明的方法。 与未绑定的 `@Scheduled` 一样，绑定只在 Bean 类自身声明的方法上查找。从父类继承的方法既不会被调度，也不会被检查，因此请把被绑定的方法声明在 Bean 类本身（[#532](https://github.com/UltiKits/UltiTools-Reborn/issues/532)）。
- 只支持 UltiTools 模块。 [外部插件 API](/zh/guide/advanced/external-plugin-api) 插件的 Bean 上的绑定会被拒绝。

### 必需的 `api-version`

使用绑定的模块必须在 `plugin.yml` 中声明 `api-version: 630`。6.2.x 框架不认识这些属性，会静默忽略它们，被绑定的任务于是只会在加载时执行一次，而不是按间隔重复执行。声明这个下限后，旧框架会直接拒绝加载该模块。6.3.0 自身也会拒绝使用了绑定、却声明了更低 `api-version` 的模块。为什么只提高 `pom.xml` 中的 pin 不够，见[模块版本规范](/zh/guide/advanced/module-versioning#新增的注解属性)。

::: tip 绑定命令冷却
`@CmdCD` 也支持同样的绑定方式，见[命令冷却](/zh/guide/essentials/cmd-executor#绑定到配置项)。
:::

## 自动生命周期管理

使用 `@Scheduled` 注解的任务由框架自动管理：

- **注册**：插件加载时自动发现并启动任务
- **取消**：当所属插件卸载或服务器关闭时，所有任务自动取消

你无需手动追踪或取消任务。

## 使用要求

- 被注解的方法必须是 `void` 且**无参数**
- 方法必须在受容器管理的 Bean 中（如 `@Service`）
- Bean 必须在 `@UltiToolsModule(scanBasePackages = {...})` 扫描的包内

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/MyPlugin.java

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/ServerMonitorService.java
