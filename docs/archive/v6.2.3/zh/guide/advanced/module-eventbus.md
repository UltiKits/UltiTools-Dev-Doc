# 模块事件总线

::: info 自 v6.2.2 起
模块事件总线从 UltiTools-API v6.2.2 开始可用。
:::

UltiTools 提供了一套解耦的发布/订阅事件系统，用于模块间通信。模块可以发布事件并订阅来自其他模块的事件，而无需模块之间的直接依赖。

## 定义事件

通过继承 `ModuleEvent` 创建自定义事件：

```java
import com.ultikits.ultitools.events.ModuleEvent;
import lombok.Getter;

public class BalanceChangeEvent extends ModuleEvent {
    @Getter private final UUID player;
    @Getter private final double amount;

    public BalanceChangeEvent(UUID player, double amount) {
        this.player = player;
        this.amount = amount;
    }
}
```

每个 `ModuleEvent` 自动携带：
- `sourceModule` — 发布事件的模块名称（通过 `setSourceModule()` 设置）
- `timestamp` — 事件创建的时间戳（`System.currentTimeMillis()`）

## 注解方式处理器

在任何托管 Bean 中使用 `@ModuleEventHandler` 标记方法。框架会自动发现并注册：

```java
@Service
public class AuditService {

    @ModuleEventHandler
    public void onBalanceChange(BalanceChangeEvent event) {
        Bukkit.getLogger().info(
            event.getSourceModule() + " 修改了 "
            + event.getPlayer() + " 的余额: " + event.getAmount()
        );
    }
}
```

方法必须有**且仅有一个**继承 `ModuleEvent` 的参数。

### 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `priority` | `EventPriority` | `NORMAL` | 执行顺序 — `LOWEST` 最先执行，`MONITOR` 最后执行 |
| `ignoreCancelled` | `boolean` | `false` | 如果为 `true`，当事件被取消后跳过此处理器 |

```java
@ModuleEventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
public void onHighPriority(BalanceChangeEvent event) {
    // 在 NORMAL 处理器之后执行，如果事件被取消则跳过
}
```

## 优先级顺序

处理器按优先级从低到高顺序执行：

`LOWEST` → `LOW` → `NORMAL` → `HIGH` → `HIGHEST` → `MONITOR`

::: tip MONITOR 优先级
使用 `MONITOR` 进行只读观察（日志、统计）。在此优先级避免修改事件状态。
:::

## 编程式订阅

对于动态订阅（如临时监听器），可以直接使用 EventBus API：

```java
EventBus eventBus = UltiTools.getInstance().getEventBus();

// 简单订阅
Subscription sub = eventBus.subscribe(BalanceChangeEvent.class, event -> {
    player.sendMessage("余额变动: " + event.getAmount());
});

// 稍后不再需要时取消订阅
sub.unsubscribe();
```

也支持完整选项：

```java
Subscription sub = eventBus.subscribe(
    BalanceChangeEvent.class,
    EventPriority.HIGH,
    true,       // ignoreCancelled
    "MyModule", // 所属模块名
    event -> { /* 处理器 */ }
);
```

返回的 `Subscription` 提供：
- `unsubscribe()` — 停止接收事件（可安全多次调用）
- `isActive()` — 检查订阅是否仍然活跃

## 发布事件

### 同步发布

处理器在调用线程上按优先级顺序执行：

```java
EventBus eventBus = UltiTools.getInstance().getEventBus();

BalanceChangeEvent event = new BalanceChangeEvent(player, 100.0);
event.setSourceModule("UltiEconomy");
eventBus.publish(event);
```

### 异步发布

处理器在后台线程池上执行：

```java
eventBus.publishAsync(event);
```

::: warning 异步限制
- 可取消事件**不能**异步发布 — 框架会抛出 `IllegalArgumentException`
- 异步处理器不能调用大多数 Bukkit API 方法（使用 `Bukkit.getScheduler().runTask()` 切回主线程）
:::

## 可取消事件

实现 `Cancellable` 接口允许处理器阻止后续处理：

```java
import com.ultikits.ultitools.events.Cancellable;

public class PlayerTradeEvent extends ModuleEvent implements Cancellable {
    private boolean cancelled;

    @Override
    public boolean isCancelled() { return cancelled; }

    @Override
    public void setCancelled(boolean cancelled) { this.cancelled = cancelled; }

    // ... 你的事件数据
}
```

处理器可以取消事件：

```java
@ModuleEventHandler(priority = EventPriority.LOW)
public void onTrade(PlayerTradeEvent event) {
    if (isBanned(event.getTrader())) {
        event.setCancelled(true); // 设置 ignoreCancelled=true 的后续处理器将被跳过
    }
}
```

设置了 `ignoreCancelled = true` 的处理器在事件被取消后会被跳过。

## 父类匹配

注册到父事件类型的处理器也会接收子事件：

```java
// 捕获所有 ModuleEvent
@ModuleEventHandler
public void onAnyEvent(ModuleEvent event) {
    Bukkit.getLogger().info("事件来自 " + event.getSourceModule());
}
```

注册到 `BalanceChangeEvent` 的处理器**不会**接收其他 `ModuleEvent` 子类型。

## 错误隔离

如果某个处理器抛出异常，该异常会被记录，其他处理器继续正常执行。一个有问题的处理器不会影响整个事件链。

## 自动生命周期

- **注册**：`@Service` Bean 中的 `@ModuleEventHandler` 方法在插件模块加载时被发现并注册
- **清理**：当模块卸载时，该模块拥有的所有处理器会被自动注销

对于注解方式的处理器，你不需要手动管理生命周期。

## 完整示例

**经济模块**在余额变化时发布事件：

```java
// 在 UltiEconomy 模块中
public class BalanceChangeEvent extends ModuleEvent {
    @Getter private final UUID player;
    @Getter private final double oldBalance;
    @Getter private final double newBalance;

    public BalanceChangeEvent(UUID player, double oldBalance, double newBalance) {
        this.player = player;
        this.oldBalance = oldBalance;
        this.newBalance = newBalance;
    }
}

@Service
public class EconomyService {
    @Autowired
    private UltiToolsPlugin plugin;

    public void setBalance(UUID player, double amount) {
        double old = getBalance(player);
        // ... 更新数据库 ...

        BalanceChangeEvent event = new BalanceChangeEvent(player, old, amount);
        event.setSourceModule(plugin.getPluginName());
        UltiTools.getInstance().getEventBus().publish(event);
    }
}
```

**独立的审计模块**无需依赖经济模块即可接收事件：

```java
// 在独立的审计模块中
@Service
public class AuditLogService {

    @ModuleEventHandler
    public void onBalanceChange(BalanceChangeEvent event) {
        double delta = event.getNewBalance() - event.getOldBalance();
        Bukkit.getLogger().info(String.format(
            "[审计] %s 余额: %.2f -> %.2f (变动: %+.2f) 来自 %s",
            event.getPlayer(), event.getOldBalance(),
            event.getNewBalance(), delta, event.getSourceModule()
        ));
    }
}
```

::: tip 跨模块通信
EventBus 非常适合模块需要对彼此的操作做出反应但又不想紧耦合的场景。例如：
- 经济变化触发审计日志或通知
- 玩家传送事件触发区域检查
- 自定义游戏事件协调多个模块
:::
