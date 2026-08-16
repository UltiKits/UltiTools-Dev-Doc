# 定时任务

::: info 自 v6.2.0 起
`@Scheduled` 注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 提供了声明式的方式来调度重复或延迟任务。无需手动创建 `BukkitRunnable` 对象，只需在方法上添加 `@Scheduled` 注解，框架会自动处理其余工作。

## 基本用法

在任意受容器管理的 Bean（如 `@Service`）中，给 `void`、无参方法添加 `@Scheduled`：

<<< @/../examples/src/main/java/com/ultikits/docs/scheduled/AutoSaveService.java

::: tip Tick 换算
Minecraft 以每秒 20 tick 的速率运行：
- 1 秒 = 20 tick
- 1 分钟 = 1,200 tick
- 5 分钟 = 6,000 tick
- 30 分钟 = 36,000 tick
:::

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `delay` | `long` | `0` | 首次执行前的延迟 tick 数 |
| `period` | `long` | `-1` | 重复间隔 tick 数。`-1` 表示只执行一次 |
| `async` | `boolean` | `false` | 在异步线程而非主线程上运行 |

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
