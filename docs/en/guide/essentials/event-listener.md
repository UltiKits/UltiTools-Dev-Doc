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

Sure, you can also use the automatic registration function provided by UltiTools. For details, please refer to [this article](/en/guide/advanced/auto-register).

## Temporary Listener

Many times we just need to listen to events temporarily. In traditional plugin development, we often maintain a list to record the players who need to listen temporarily, which is very troublesome.

UltiTools encapsulates Bukkit's event listener, so you can listen to players' events anywhere, which is very convenient.

You can use `SimpleTempListener` to create a temporary listener:

```java
TempListener listener = new SimpleTempListener(PlayerInteractEvent.class, event -> {
    // do something...
    return true; //return true to unregister this listener
})
listener.register(); //start listening
```

Specifically, if you need to listen to a player event for a particular player, you can use PlayerTempListener to create a temporary listener:

```java
TempListener listener = new SimpleTempListener(PlayerInteractEvent.class, event -> {
    // do something...
    return true; //return true to unregister this listener
}, player)
listener.register(); //start listening
```

You can use the `unregister()` method to manually unregister the listener.
