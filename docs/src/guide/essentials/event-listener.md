# Event Listener

The event listener of UltiTools module is basically the same as Bukkit's event listener.

Please refer to [Bukkit Event Listener](https://bukkit.gamepedia.com/Event_API_Reference).

## Create a Listener

Create a class that implements `Listener` and add `@EventHandler` annotation to the method that handles the event.

```java
@EventListener
public class BackListener implements Listener {

    @EventHandler
    public void onPlayerDeath(PlayerDeathEvent event) {
        ...
    }
}
```

The `@EventListener` annotation has an optional `manualRegister` parameter (default `false`). For listeners loaded through the standard module JAR path (as with `@UltiToolsModule`), setting `manualRegister` to `true` means component scanning skips automatic registration for that listener: you must register it manually via `getListenerManager().register(this, YourListener.class)`.

## Register Event Listener

Register the listener in `registerSelf` of the class that inherits `UltiToolsPlugin`.

::: warning The six-parameter connector constructor is marked for removal
The example below calls the six-parameter `UltiToolsPlugin` constructor, which carries `@Deprecated(since = "6.0.8", forRemoval = true)` and hardcodes the resource folder path, so javac reports a removal warning on every build.
Move the integration to the External Plugin API and call `UltiToolsAPI.connect` from your own `JavaPlugin`, or keep the connector and call the seven-parameter constructor passing `resourceFolderPath` yourself: both are supported on v6.2.5.
The replacement signature for connectors is still being decided in [issue #217](https://github.com/UltiKits/UltiTools-Reborn/issues/217), and the removal itself is tracked in [issue #213](https://github.com/UltiKits/UltiTools-Reborn/issues/213).
:::

<<< @/../examples/src/main/java/com/ultikits/docs/listener/UltiToolsConnector.java

Sure, you can also use the automatic registration function provided by UltiTools. For details, please refer to [this article](/guide/advanced/auto-register).

## Temporary Listener

Many times we just need to listen to events temporarily. In traditional plugin development, we often maintain a list to record the players who need to listen temporarily, which is very troublesome.

UltiTools encapsulates Bukkit's event listener, so you can listen to events anywhere, which is very convenient and automatic.

### Temporary Listener Builder <Badge type="tip" text="v6.1.0+" />

Starting with v6.1.0, use the modern `TempListener` builder API for cleaner, more flexible temporary listeners:

```java
// Simple usage - listen to all block interactions
TempListener.common(PlayerInteractEvent.class)
    .listen(event -> {
        player.sendMessage("You clicked a block!");
        return true; // return true to auto-unregister
    });
```

**Builder Methods:**

- `eventHandler(TempEventHandler<E> handler)` — Sets the event handler. Returns `true` to auto-unregister, `false` to continue listening.
- `filter(Function<E, Boolean> filter)` — Add a pre-handler filter. Returns `true` to handle the event, `false` to ignore it.
- `priority(EventPriority priority)` — Set handler priority (default: `NORMAL`).
- `build()` — Build and return the `TempListener` (manual `register()` required).
- `listen(TempEventHandler<E> handler)` — Build and immediately register in one call.

::: tip build() passes your filter through <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, `.filter(x).build()` is the single recommended way to get a listener that both filters and can be unregistered: `build()` calls the same four-argument `SimpleTempListener` constructor `listen(...)` already used, so the filter you set is applied, and calling `register()` on the returned `TempListener` gives you the handle to call `unregister()` on — one construction call, both capabilities, no second listener needed.
Before v6.3.0, `build()` called a three-argument constructor that had no filter parameter, so a filter set through `.filter(...)` was silently discarded; `listen(...)` did pass the filter through, but returned `void`, with no handle to unregister. Both gaps are closed by the same fix.
:::

**Example: Wait for player to interact with a specific block type**

```java
// Listen for left-clicks on wooden blocks only
TempListener.common(PlayerInteractEvent.class)
    .priority(EventPriority.HIGH)
    .filter(event -> {
        Block block = event.getClickedBlock();
        return block != null && block.getType().name().contains("WOOD");
    })
    .listen(event -> {
        event.getPlayer().sendMessage("You clicked a wooden block!");
        return true; // auto-unregister after first match
    });
```

**Example: Wait for chat response with timeout**

```java
// Listen for player chat
TempListener.common(AsyncPlayerChatEvent.class)
    .filter(event -> event.getPlayer().equals(targetPlayer))
    .listen(event -> {
        String message = event.getMessage();
        if (message.equalsIgnoreCase("yes")) {
            processConfirmation(targetPlayer);
        }
        return true; // auto-unregister
    });
```

::: info
The `TempEventHandler<E>` is a functional interface that receives the event and returns a boolean:
- Return `true` to automatically unregister the listener after handling.
- Return `false` to keep the listener active for subsequent events.
:::

### Legacy Temporary Listener (SimpleTempListener)

::: warning Four constructors scheduled for removal in v6.3.0 <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, `SimpleTempListener`'s no-argument constructor and its two- and three-argument overloads — including the no-filter `(Class, TempEventHandler)` shape used below — carry `@Deprecated(since = "6.3.0", forRemoval = true)` and are scheduled for removal in v6.3.0. They confusably overlap: two three-argument overloads differ only in whether the last parameter is `EventPriority` or a filter `Function`, with no compile-time signal for picking the wrong one. Prefer the builder API above, or the four-argument all-args constructor `new SimpleTempListener<>(eventClass, priority, handler, filter)` directly, which is not deprecated.
:::

The legacy direct instantiation approach using `SimpleTempListener` still works for the example below, but the constructor it calls is now on a removal track; the builder API is the recommended approach for new code:

```java
// Legacy approach - still works, but its constructor is deprecated for removal in v6.3.0
TempListener listener = new SimpleTempListener(PlayerInteractEvent.class, event -> {
    // do something...
    return true; // return true to unregister this listener
});
listener.register(); // start listening
```

For player-specific events, the legacy `PlayerTempListener` was removed in v6.3.0. Use the builder with a filter instead:

```java
// OLD (removed in v6.3.0):
// TempListener listener = new PlayerTempListener<>(
//     PlayerInteractEvent.class,
//     event -> { /* ... */ return true; },
//     targetPlayer
// );

// NEW (recommended):
TempListener.common(PlayerInteractEvent.class)
    .filter(event -> event.getPlayer().equals(targetPlayer))
    .listen(event -> { /* ... */ return true; });
```

As of v6.3.0, `.filter(x).build()` (shown at the top of this section) is the recommended way to get a listener that both filters and can be unregistered by hand — you no longer need to construct `SimpleTempListener` directly for that combination.
