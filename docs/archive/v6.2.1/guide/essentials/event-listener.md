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

## Register Event Listener

Register the listener in `registerSelf` of the class that inherits `UltiToolsPlugin`.

```java
import com.ultikits.plugin.ultikitsapiexample.context.ContextConfig;
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.ContextEntry;
import com.ultikits.ultitools.annotations.EnableAutoRegister;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

    public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
        super(name, version, authors, depend, loadPriority, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        // register listener
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

Sure, you can also use the automatic registration function provided by UltiTools. For details, please refer to [this article](/guide/advanced/auto-register).

## Temporary Listener

Many times we just need to listen to events temporarily. In traditional plugin development, we often maintain a list to record the players who need to listen temporarily, which is very troublesome.

UltiTools encapsulates Bukkit's event listener, so you can listen to events anywhere, which is very convenient and automatic.

### Temporary Listener Builder <Badge type="tip" text="v6.2.0+" />

Starting with v6.2.0, use the modern `TempListener` builder API for cleaner, more flexible temporary listeners:

```java
// Simple usage - listen to all block interactions
TempListener.common(PlayerInteractEvent.class)
    .eventHandler(event -> {
        player.sendMessage("You clicked a block!");
        return true; // return true to auto-unregister
    })
    .listen(event -> {
        // equivalent to .build().register()
    });
```

**Builder Methods:**

- `eventHandler(TempEventHandler<E> handler)` — Sets the event handler. Returns `true` to auto-unregister, `false` to continue listening.
- `filter(Function<E, Boolean> filter)` — Add a pre-handler filter. Returns `true` to handle the event, `false` to ignore it.
- `priority(EventPriority priority)` — Set handler priority (default: `NORMAL`).
- `build()` — Build and return the `TempListener` (manual `register()` required).
- `listen(TempEventHandler<E> handler)` — Build and immediately register in one call.

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

// Optional: Manually unregister if the player logs out
// listener.unregister();
```

::: info
The `TempEventHandler<E>` is a functional interface that receives the event and returns a boolean:
- Return `true` to automatically unregister the listener after handling.
- Return `false` to keep the listener active for subsequent events.
:::

### Legacy Temporary Listener (SimpleTempListener)

The legacy direct instantiation approach is still supported but deprecated in favor of the builder:

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

You can manually unregister any listener using the `unregister()` method.
