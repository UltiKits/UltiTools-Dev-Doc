# 事件监听器

7.0.0 尚未发布。本页介绍自 v7.0.0 起的行为。6.x 用法见 [v6.4.0 归档指南](/zh/v6.4.0/guide/essentials/event-listener.html)。

UltiTools 模块可以用 `@EventListener` 监听 Paper/Bukkit 事件，也可以用 `@ModuleEventHandler` 订阅 UltiTools 模块事件。两者的注册和派发相互独立。

## 创建监听器

实现 `org.bukkit.event.Listener`。在类上标注 `com.ultikits.ultitools.annotations.EventListener`，在处理方法上标注 Bukkit 的 `@EventHandler`。处理方法的签名和优先级见 [Paper 的事件监听指南](https://docs.papermc.io/paper/dev/event-listeners)。

```java
@EventListener
public class JoinListener implements Listener {
    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage(Component.text("Welcome!"));
    }
}
```

Bukkit 在派发事件的线程上调用处理方法。UltiTools 不切换线程：玩家加入事件在 Paper 主线程上处理，但异步派发的事件不在主线程上处理。异步处理方法如果需要访问玩家、世界或服务器状态，请把工作提交到对应的[调度上下文](../advanced/scheduled-tasks#调度器-api)。延后执行的任务无法改变已经派发完毕的事件结果。

## 监听器注册

将监听器放进扫描范围。开启监听器自动注册后（见[自动注册](../advanced/auto-register)），UltiTools 从模块容器中查找带注解的 `Listener` Bean，在 `registerSelf()` 成功后向 Bukkit 注册。`manualRegister` 默认为 `false`。设置 `@EventListener(manualRegister = true)` 可跳过该 Bean 的自动注册，再在模块的 `registerSelf()` 中调用 `getListenerManager().register(this, JoinListener.class)`。该类仍须是 Bean，因为 `register` 从模块容器中获取它。

使用接收类的重载；7.0 不再提供接收监听器对象或包名的旧重载。模块卸载时，UltiTools 注销它为该模块跟踪的 Bukkit 监听器。直接通过 Bukkit 注册的监听器需要自行清理。

独立的 Paper 插件可以通过 [`UltiToolsAPI.connect(this)`](../advanced/external-plugin-api) 注册发现的监听器 Bean。下面的示例演示在已有的 `UltiToolsPlugin` 连接器中手动注册；该连接器构造器接收七个参数，其中包括 `resourceFolderPath`。

<<< @/../examples/src/main/java/com/ultikits/docs/listener/UltiToolsConnector.java

## 临时事件监听

`com.ultikits.ultitools.interfaces.TempListener` 直接向 Bukkit 注册。过滤器和处理方法都在事件派发线程上运行。处理方法返回 `true` 时注销监听器，返回 `false` 时继续监听。返回值不会取消事件。

### 临时监听器构建器

用 `TempListener.common(EventClass.class)` 创建构建器。`priority(...)` 默认为 `NORMAL`；`filter(...)` 先于处理方法执行，只有返回 `true` 才通过。用 `eventHandler(...).build()` 构建监听器，再调用 `register()` 注册，以便保留可手动注销的句柄：

```java
TempListener listener = TempListener.common(PlayerInteractEvent.class)
    .filter(event -> event.getPlayer().equals(targetPlayer) && event.getClickedBlock() != null)
    .eventHandler(event -> {
        event.getPlayer().sendMessage(Component.text("Block selected."));
        return true;
    })
    .build();
listener.register();
```

保留句柄，在操作结束时调用 `unregister()`；卸载时若它仍在监听，在 `onUnregister()` 中注销。模块的 `ListenerManager` 不跟踪由这个构建器创建的临时监听器。`listen(handler)` 一次完成构建和注册，但不返回句柄。

### 传统临时监听器（SimpleTempListener）

使用构建器或 `new SimpleTempListener<>(eventClass, priority, handler, filter)`。无参、两参和三参构造器已在 v6.4.0 移除。对指定玩家进行监听时，用玩家过滤器替代已移除的 `PlayerTempListener` 和 `TempListener.player(...)`。

## 模块事件总线 {#module-event-bus}

在受管理的 Bean 上用 `@ModuleEventHandler` 处理 `ModuleEvent`。`registerSelf()` 成功后，UltiTools 将这些方法注册到共享的 `EventBus`。卸载时会移除归属于该模块实例的订阅，包括在容器刷新或 `registerSelf()` 期间由加载线程建立的程序式订阅。对于之后建立且没有指定所属模块的订阅，请保留返回的 `Subscription` 并自行调用 `unsubscribe()`。见[模块事件总线](../advanced/module-eventbus)。

`EventBus.publish(event)` 在发布者的线程上同步调用处理方法，该线程不一定是主线程。`publishAsync(event)` 通常使用工作线程，但线程池饱和时（工作线程全部忙碌，容量为 256 的队列已满）可以在调用线程上执行。它会拒绝 `Cancellable` 事件并抛出 `IllegalArgumentException`。

自 v7.0.0 起，到达已注册 responder 的模块请求由面板桥接层通过框架调度器的 `global()` 上下文发布 `PanelMessageEvent`。事件处理方法在 Paper 主线程上运行，responder 本身仍在工作线程上运行。这是该发布者的行为，不是事件总线的一般规则。见[框架调度的工作](../advanced/scheduled-tasks#框架调度的工作)。
