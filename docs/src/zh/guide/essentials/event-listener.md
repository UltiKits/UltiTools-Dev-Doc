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

::: tip build() 现在会传递你设置的过滤器 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，`.filter(x).build()` 是同时获得「可过滤」与「可注销」监听器的推荐写法：`build()` 调用的是与 `listen(...)` 相同的四参构造器，因此你设置的过滤器会真正生效，对返回的 `TempListener` 调用 `register()` 就能拿到调用 `unregister()` 所需的句柄——一次构造，两种能力，不需要第二个监听器。
在 v6.3.0 之前，`build()` 调用的是没有 filter 参数的三参构造器，过滤器会被静默丢弃；`listen(...)` 虽然传递了过滤器，却返回 `void`，拿不到注销句柄。这两个缺口由同一处修复一并关闭。
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

::: warning 四个构造器计划在 v6.3.0 移除 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，`SimpleTempListener` 的无参构造器以及两个、三个参数的重载——包括下面示例用到的无过滤器 `(Class, TempEventHandler)` 形态——都带上了 `@Deprecated(since = "6.3.0", forRemoval = true)`，计划在 v6.3.0 移除。它们彼此容易混淆：两个三参数重载仅在最后一个参数是 `EventPriority` 还是过滤器 `Function` 上不同，编译期没有任何信号提醒选错了。推荐使用上方的构建器 API，或直接使用未被废弃的四参数全参构造器 `new SimpleTempListener<>(eventClass, priority, handler, filter)`。
:::

下面示例中传统的直接实例化写法仍然可用，但其构造器已进入移除计划；新代码请使用构建器：

```java
// 传统方式 - 仍然可用，但其构造器计划在 v6.3.0 移除
TempListener listener = new SimpleTempListener(PlayerInteractEvent.class, event -> {
    // 做一些事...
    return true; // 返回 true 自动注销监听器
});
listener.register(); // 开始监听
```

对于特定玩家的事件，传统的 `PlayerTempListener` 已在 v6.3.0 移除。改为使用构建器配合过滤器：

```java
// 旧方式（已在 v6.3.0 移除）：
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

自 v6.3.0 起，本节顶部展示的 `.filter(x).build()` 就是同时获得「可过滤」与「可手动注销」监听器的推荐写法——不再需要直接构造 `SimpleTempListener`。
