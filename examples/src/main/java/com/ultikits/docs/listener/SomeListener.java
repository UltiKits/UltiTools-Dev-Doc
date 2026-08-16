package com.ultikits.docs.listener;

import com.ultikits.ultitools.annotations.EventListener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

// Example listener; not part of the framework.
// registerSelf() registers this listener explicitly, so scanning must not
// register it a second time.
@EventListener(manualRegister = true)
public class SomeListener implements Listener {

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage("Welcome!");
    }
}
