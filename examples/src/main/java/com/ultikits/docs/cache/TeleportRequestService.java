package com.ultikits.docs.cache;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.*;
import com.ultikits.ultitools.aop.ExceptionHandler;
import com.ultikits.ultitools.interfaces.DataOperator;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.lang.reflect.Method;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TeleportRequestService implements PlayerCacheSaver {

    @Autowired
    private UltiToolsPlugin plugin;

    // Pending teleport requests: requester -> target
    @PlayerCache
    private final Map<UUID, UUID> pendingRequests = new ConcurrentHashMap<>();

    // Player's preferred teleport settings (saved on quit)
    @PlayerCache(saveBeforeRemove = true)
    private final Map<UUID, TeleportPrefs> preferences = new ConcurrentHashMap<>();

    public void sendRequest(UUID from, UUID to) {
        pendingRequests.put(from, to);
    }

    public UUID getRequest(UUID from) {
        return pendingRequests.get(from);
    }

    public void acceptRequest(UUID from) {
        pendingRequests.remove(from);
    }

    public TeleportPrefs getPreferences(UUID playerId) {
        return preferences.computeIfAbsent(playerId, id -> new TeleportPrefs());
    }

    @Override
    public void savePlayerData(UUID playerId) {
        TeleportPrefs prefs = preferences.get(playerId);
        if (prefs != null) {
            try {
                plugin.getDataOperator(TeleportPrefsEntity.class)
                    .update(prefs.toEntity(playerId));
            } catch (IllegalAccessException e) {
                plugin.getLogger().warn("Failed to save teleport prefs: " + e.getMessage());
            }
        }
    }
}
