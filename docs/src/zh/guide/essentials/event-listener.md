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

`@EventListener` 注解有一个可选的 `manualRegister` 参数（默认为 `false`）。设为 `true` 时，监听器不会在组件扫描时自动注册——你需要通过 `getListenerManager().register(this, YourListener.class)` 手动注册。

## 监听器注册

在继承了 `UltiToolsPlugin` 的类中的 `registerSelf` 中注册监听器。

```java
import com.ultikits.plugin.ultikitsapiexample.context.ContextConfig;
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.ContextEntry;
import com.ultikits.ultitools.annotations.EnableAutoRegister;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

    // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
    // 在这里请不要主动使用无参数的构造函数
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass) {
        super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        getListenerManager().register(this, SomeListener.class);
        return true;
    }

    @Override
    public void unregisterSelf() {

    }

    @Override
    public void reloadSelf() {
        super.reloadSelf();
    }
}
```

当然，你也可以使用 UltiTools 提供的自动注册功能，详情可以查看[这篇文章](/zh/guide/advanced/auto-register)。


## 临时事件监听

很多时候我们都只是需要临时监听事件，在传统的插件编写中，常常会维护一个列表来记录需要临时监听的玩家，这十分麻烦。

UltiTools 对 Bukkit 的事件监听器进行了封装，你可以十分便捷地在任何地方监听事件，即创即用，用后即销。

### 临时监听器构建器 <Badge type="tip" text="v6.2.0+" />

从 v6.2.0 开始，使用现代的 `TempListener` 构建器 API 来创建更清洁、更灵活的临时监听器：

```java
// 简单使用 - 监听所有方块交互事件
TempListener.common(PlayerInteractEvent.class)
    .eventHandler(event -> {
        player.sendMessage("你点击了一个方块！");
        return true; // 返回 true 自动注销监听器
    })
    .listen(event -> {
        // 等同于 .build().register()
    });
```

**构建器方法：**

- `eventHandler(TempEventHandler<E> handler)` — 设置事件处理器。返回 `true` 自动注销，返回 `false` 继续监听。
- `filter(Function<E, Boolean> filter)` — 添加前置过滤器。返回 `true` 处理事件，返回 `false` 忽略事件。
- `priority(EventPriority priority)` — 设置处理器优先级（默认：`NORMAL`）。
- `build()` — 构建并返回 `TempListener`（需要手动 `register()`）。
- `listen(TempEventHandler<E> handler)` — 一步构建并立即注册。

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

// 可选：如果玩家登出则手动注销
// listener.unregister();
```

::: info
`TempEventHandler<E>` 是一个函数式接口，接收事件并返回布尔值：
- 返回 `true` 自动注销监听器。
- 返回 `false` 保持监听器活跃，继续处理后续事件。
:::

### 传统临时监听器（SimpleTempListener）

传统的直接实例化方式仍然支持但已弃用，推荐使用构建器：

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

你可以使用 `unregister()` 方法手动注销任何监听器。
