package com.ultikits.docs.cache;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.PlayerCache;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.entities.WhereCondition;
import com.ultikits.ultitools.interfaces.DataOperator;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlayerSettingsService {

    @Autowired
    private UltiToolsPlugin plugin;

    // A read cache only. Nothing is ever written from it: the framework drops the entry when the
    // player quits, and a change is written at the moment it is made.
    @PlayerCache
    private final Map<UUID, PlayerSettings> settingsCache = new ConcurrentHashMap<>();

    public PlayerSettings getSettings(UUID playerId) {
        return settingsCache.computeIfAbsent(playerId, id -> {
            PlayerSettingsEntity stored = readStored(id);
            return stored != null ? PlayerSettings.fromEntity(stored) : new PlayerSettings();
        });
    }

    public void setShowScoreboard(UUID playerId, boolean show) {
        DataOperator<PlayerSettingsEntity> operator = plugin.getDataOperator(PlayerSettingsEntity.class);
        // Read the stored row now, not the cache: another server may have created or changed it.
        PlayerSettingsEntity stored = readStored(playerId);
        if (stored == null) {
            operator.insert(PlayerSettingsEntity.builder()
                .playerId(playerId.toString())
                .showScoreboard(show)
                .build());
        } else {
            // Write only the column that changed, so nothing else in the row is touched.
            operator.update("show_scoreboard", show, stored.getId());
        }
        // Drop the cached copy; the next read loads what is stored.
        settingsCache.remove(playerId);
    }

    private PlayerSettingsEntity readStored(UUID playerId) {
        List<PlayerSettingsEntity> rows = plugin.getDataOperator(PlayerSettingsEntity.class)
            .getAll(WhereCondition.builder().column("player_id").value(playerId.toString()).build());
        return rows.isEmpty() ? null : rows.get(0);
    }
}
