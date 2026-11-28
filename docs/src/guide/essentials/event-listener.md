# Event Listener

This guide describes behaviour as of v7.0.0. For 6.x, see the [archived v6.5.0 guide](/v6.5.0/guide/essentials/event-listener.html).

UltiTools modules can listen to Paper/Bukkit events with `@EventListener`, or subscribe to UltiTools module events with `@ModuleEventHandler`. These are separate registration and dispatch paths.

## Create a Listener

Implement `org.bukkit.event.Listener`. Mark the class with `com.ultikits.ultitools.annotations.EventListener` and mark its handler methods with Bukkit's `@EventHandler`. See [Paper's event listener guide](https://docs.papermc.io/paper/dev/event-listeners) for handler signatures and priorities.

```java
@EventListener
public class JoinListener implements Listener {
    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage(Component.text("Welcome!"));
    }
}
```

Bukkit calls the handler on the thread that dispatches the event. UltiTools does not switch threads: a join event runs on Paper's main thread, but an asynchronously dispatched event does not. If work from an async handler needs to access player, world or server state, submit it to the appropriate [scheduler context](../advanced/scheduled-tasks#scheduler-api). A deferred task cannot change the outcome of an event whose dispatch has already completed.

## Register Event Listener

Put the listener in a scanned package. With listener auto-registration enabled (see [Auto Registration](../advanced/auto-register)), UltiTools looks up annotated `Listener` beans in the module's container and registers them with Bukkit after `registerSelf()` succeeds. `manualRegister` defaults to `false`. Set `@EventListener(manualRegister = true)` to keep a listener bean out of automatic registration, then call `getListenerManager().register(this, JoinListener.class)` from the module's `registerSelf()`. The class must still be a bean: `register` resolves it from the module's container.

Use the class-taking overload; the old overloads that accept a listener object or a package name are not available in 7.0. On unload, UltiTools unregisters the Bukkit listeners it tracked for that module. If you register a listener directly through Bukkit, arrange its cleanup yourself.

For a standalone Paper plugin, use [`UltiToolsAPI.connect(this)`](../advanced/external-plugin-api) to register discovered listener beans. The following example shows manual registration in a connector that already extends `UltiToolsPlugin`; the connector constructor takes seven arguments, including `resourceFolderPath`.

<<< @/../examples/src/main/java/com/ultikits/docs/listener/UltiToolsConnector.java

## Temporary Listener

`com.ultikits.ultitools.interfaces.TempListener` registers directly with Bukkit. Its filter and handler run on the event's dispatch thread. Returning `true` from the handler unregisters the listener; returning `false` leaves it active. The return value does not cancel the event.

### Temporary Listener Builder

Use `TempListener.common(EventClass.class)` to create a builder. `priority(...)` defaults to `NORMAL`; `filter(...)` runs before the handler, and only `true` passes. Use `eventHandler(...).build()` and call `register()` to keep a handle you can unregister explicitly:

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

Keep the handle and call `unregister()` when the operation ends or in `onUnregister()` if it is still active: temporary listeners created by this builder are not tracked by the module's `ListenerManager`. `listen(handler)` builds and registers in one call but returns no handle.

### Legacy Temporary Listener (SimpleTempListener)

Use the builder or `new SimpleTempListener<>(eventClass, priority, handler, filter)`. The no-argument, two- and three-argument constructors were removed in v6.4.0. Use a player filter instead of the removed `PlayerTempListener` or `TempListener.player(...)`.

## Module Event Bus {#module-event-bus}

Use `@ModuleEventHandler` on a managed bean to handle a `ModuleEvent`. UltiTools registers those methods on the shared `EventBus` after `registerSelf()` succeeds. On unload it removes subscriptions owned by that module instance, including programmatic subscriptions made on the loading thread within container refresh or `registerSelf()`. For subscriptions created later without an owner, retain the returned `Subscription` and call `unsubscribe()` yourself. See [Module EventBus](../advanced/module-eventbus).

`EventBus.publish(event)` invokes handlers synchronously on the publisher's thread, not necessarily the main thread. `publishAsync(event)` normally uses workers, but can run handlers on the calling thread if the pool is saturated (all workers busy and its 256-entry queue full). It rejects `Cancellable` events with `IllegalArgumentException`.

As of v7.0.0, the panel bridge publishes `PanelMessageEvent` for module requests that reach a registered responder via the framework scheduler's `global()` context. Its handlers run on Paper's main thread; the responder itself runs on a worker. This is a property of that publisher, not of the event bus in general. See [Framework-scheduled work](../advanced/scheduled-tasks#framework-scheduled-work).
