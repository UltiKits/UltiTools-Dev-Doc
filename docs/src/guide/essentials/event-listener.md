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

::: warning build() returns a listener without your filter
`build()` calls the three-argument `SimpleTempListener` constructor, which assigns the event class, priority and handler but leaves `filter` at its field default of `(ignored) -> true`, so a listener built this way runs the handler for every event of that type; `listen(...)` does pass the filter through, but it returns `void`, which leaves no handle to call `unregister()` on.
Construct `new SimpleTempListener<>(eventClass, priority, handler, filter)` directly and call `register()` on it: the legacy section below states that this form is still supported, and it is currently the only way to get a listener that both filters and can be unregistered.
Passing the filter through `build()` is tracked in [issue #313](https://github.com/UltiKits/UltiTools-Reborn/issues/313).
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

The legacy direct instantiation approach using `SimpleTempListener` is still supported and is not deprecated, unlike `PlayerTempListener` (described below); the builder API remains the recommended approach for new code:

```java
// Legacy approach - still works but not recommended
TempListener listener = new SimpleTempListener(PlayerInteractEvent.class, event -> {
    // do something...
    return true; // return true to unregister this listener
});
listener.register(); // start listening
```

For player-specific events, the legacy `PlayerTempListener` is also deprecated. Use the builder with a filter instead:

```java
// OLD (deprecated):
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

Manual unregistration requires the four-argument `SimpleTempListener` constructor described in the warning above; neither `build()` nor `listen(...)` on their own provide both a filter and a handle to call `unregister()` on.
