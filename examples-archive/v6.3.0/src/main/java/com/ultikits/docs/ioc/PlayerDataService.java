package com.ultikits.docs.ioc;

import com.ultikits.ultitools.annotations.Service;

import java.util.UUID;

@Service
public class PlayerDataService {
    private final MyPlugin plugin;
    private final ConfigService config;

    public PlayerDataService(MyPlugin plugin, ConfigService config) {
        this.plugin = plugin;
        this.config = config;
    }

    public void syncPlayerData(UUID playerId) {
        // Use plugin.getServer(), plugin.getLogger(), etc.
        plugin.getLogger().info("Syncing data for: " + playerId);
    }
}
