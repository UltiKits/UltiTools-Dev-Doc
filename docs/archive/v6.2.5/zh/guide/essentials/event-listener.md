# 事件监听器

UltiTools 模块的事件监听与 Bukkit 的事件监听基本相同。

参见 [Bukkit 事件监听器](https://bukkit.gamepedia.com/Event_API_Reference)。

## 创建监听器

创建一个实现 `Listener` 接口的类，并在处理事件的方法上添加 `@EventHandler` 注解。

```java
@EventListener
public class BackListener implements Listener {

    @EventHandler
    public void onPlayerDeath(PlayerDeathEvent event) {
        ...
    }
}
```

`@EventListener` 注解有一个可选的 `manualRegister` 参数（默认为 `false`）。对于通过标准模块 JAR 路径加载的监听器（例如使用 `@UltiToolsModule` 的写法），设为 `true` 时组件扫描会跳过该监听器的自动注册，需要通过 `getListenerManager().register(this, YourListener.class)` 手动注册。

## 监听器注册

在继承了 `UltiToolsPlugin` 的类中的 `registerSelf` 中注册监听器。

::: warning 六参数连接器构造器已标记为待移除
下面的示例调用的是六参数 `UltiToolsPlugin` 构造器，它带有 `@Deprecated(since = "6.0.8", forRemoval = true)` 并把资源目录路径写死，因此每次编译都会产生一条移除警告。
改用外部插件 API，在你自己的 `JavaPlugin` 里调用 `UltiToolsAPI.connect`，或者保留连接器、改调七参数构造器并自行传入 `resourceFolderPath`：这两种写法在 v6.2.5 上都可用。
连接器的替代签名仍在 [issue #217](https://github.com/UltiKits/UltiTools-Reborn/issues/217) 中讨论，移除动作本身跟踪于 [issue #213](https://github.com/UltiKits/UltiTools-Reborn/issues/213)。
:::

<<< @/../examples/src/main/java/com/ultikits/docs/listener/UltiToolsConnector.java

当然，你也可以使用 UltiTools 提供的自动注册功能，详情可以查看[这篇文章](/zh/guide/advanced/auto-register)。


## 临时事件监听

很多时候我们都只是需要临时监听事件，在传统的插件编写中，常常会维护一个列表来记录需要临时监听的玩家，这十分麻烦。

UltiTools 对 Bukkit 的事件监听器进行了封装，你可以十分便捷地在任何地方监听事件，即创即用，用后即销。

### 临时监听器构建器 <Badge type="tip" text="v6.1.0+" />

从 v6.1.0 开始，使用现代的 `TempListener` 构建器 API 来创建更清洁、更灵活的临时监听器：

```java
// 简单使用 - 监听所有方块交互事件
TempListener.common(PlayerInteractEvent.class)
    .listen(event -> {
        player.sendMessage("你点击了一个方块！");
        return true; // 返回 true 自动注销监听器
    });
```

**构建器方法：**

- `eventHandler(TempEventHandler<E> handler)` — 设置事件处理器。返回 `true` 自动注销，返回 `false` 继续监听。
- `filter(Function<E, Boolean> filter)` — 添加前置过滤器。返回 `true` 处理事件，返回 `false` 忽略事件。
- `priority(EventPriority priority)` — 设置处理器优先级（默认：`NORMAL`）。
- `build()` — 构建并返回 `TempListener`（需要手动 `register()`）。
- `listen(TempEventHandler<E> handler)` — 一步构建并立即注册。

::: warning build() 返回的监听器不带你设置的过滤器
`build()` 调用的是 `SimpleTempListener` 的三参构造器，它只赋值事件类、优先级与处理器，`filter` 保持字段初值 `(ignored) -> true`，因此这样构建出的监听器会对该类型的每一个事件执行处理器；`listen(...)` 确实传入了过滤器，但返回类型是 `void`，拿不到调用 `unregister()` 的句柄。
直接构造 `new SimpleTempListener<>(eventClass, priority, handler, filter)` 并调用它的 `register()`：本页下方的旧版小节写明这种写法仍然可用，而且它是目前唯一能同时带过滤器又能手动注销的写法。
让 `build()` 传递过滤器的修法跟踪于 [issue #313](https://github.com/UltiKits/UltiTools-Reborn/issues/313)。
:::

**示例：等待玩家与特定方块交互**

```java
// 仅监听左键点击木头类方块
TempListener.common(PlayerInteractEvent.class)
    .priority(EventPriority.HIGH)
    .filter(event -> {
        Block block = event.getClickedBlock();
        return block != null && block.getType().name().contains("WOOD");
    })
    .listen(event -> {
        event.getPlayer().sendMessage("你点击了木头方块！");
        return true; // 首次匹配后自动注销
    });
```

**示例：等待玩家聊天回复（带超时）**

```java
// 监听玩家聊天
TempListener.common(AsyncPlayerChatEvent.class)
    .filter(event -> event.getPlayer().equals(targetPlayer))
    .listen(event -> {
        String message = event.getMessage();
        if (message.equalsIgnoreCase("yes")) {
            processConfirmation(targetPlayer);
        }
        return true; // 处理后自动注销
    });
```

::: info
`TempEventHandler<E>` 是一个函数式接口，接收事件并返回布尔值：
- 返回 `true` 自动注销监听器。
- 返回 `false` 保持监听器活跃，继续处理后续事件。
:::

### 传统临时监听器（SimpleTempListener）

传统的直接实例化方式（`SimpleTempListener`）仍然可用，并未被弃用，这一点与下文的 `PlayerTempListener` 不同；新代码仍推荐使用构建器：

```java
// 传统方式 - 仍然可用但不推荐
TempListener listener = new SimpleTempListener(PlayerInteractEvent.class, event -> {
    // 做一些事...
    return true; // 返回 true 自动注销监听器
});
listener.register(); // 开始监听
```

对于特定玩家的事件，传统的 `PlayerTempListener` 也已弃用。改为使用构建器配合过滤器：

```java
// 旧方式（已弃用）：
// TempListener listener = new PlayerTempListener<>(
//     PlayerInteractEvent.class,
//     event -> { /* ... */ return true; },
//     targetPlayer
// );

// 新方式（推荐）：
TempListener.common(PlayerInteractEvent.class)
    .filter(event -> event.getPlayer().equals(targetPlayer))
    .listen(event -> { /* ... */ return true; });
```

手动注销一个带过滤器的监听器，需要使用上方警告中说明的四参数 `SimpleTempListener` 构造器；`build()` 确实会返回句柄，但会丢掉你的过滤器，而 `listen(...)` 保留过滤器却不返回任何可注销的东西。
