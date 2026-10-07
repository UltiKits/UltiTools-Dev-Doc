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
public class PlayerSettingsService implements PlayerCacheSaver {

    @Autowired
    private UltiToolsPlugin plugin;

    @PlayerCache(saveBeforeRemove = true)
    private final Map<UUID, PlayerSettings> settingsCache = new ConcurrentHashMap<>();

    public PlayerSettings getSettings(UUID playerId) {
        return settingsCache.computeIfAbsent(playerId, this::loadFromDatabase);
    }

    public void updateSetting(UUID playerId, String key, Object value) {
        PlayerSettings settings = getSettings(playerId);
        settings.set(key, value);
        // Changes stay in memory until player quits or explicit save
    }

    @Override
    public void savePlayerData(UUID playerId) {
        PlayerSettings settings = settingsCache.get(playerId);
        if (settings != null && settings.isDirty()) {
            try {
                plugin.getDataOperator(PlayerSettingsEntity.class).update(settings.toEntity());
            } catch (IllegalAccessException e) {
                plugin.getLogger().warn("Failed to save settings for " + playerId);
            }
        }
    }

    private PlayerSettings loadFromDatabase(UUID playerId) {
        PlayerSettingsEntity entity = plugin.getDataOperator(PlayerSettingsEntity.class).query()
            .where("playerId").eq(playerId.toString())
            .first();
        return entity != null ? PlayerSettings.fromEntity(entity) : new PlayerSettings();
    }
}
