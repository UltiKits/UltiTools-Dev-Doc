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
public class TeleportRequestService {

    @Autowired
    private UltiToolsPlugin plugin;

    // Pending teleport requests: requester -> target. Held in memory only.
    @PlayerCache
    private final Map<UUID, UUID> pendingRequests = new ConcurrentHashMap<>();

    // Player's teleport settings: a read cache of the stored row, dropped on quit and never written back.
    @PlayerCache
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
        return preferences.computeIfAbsent(playerId, id -> {
            TeleportPrefsEntity stored = readStored(id);
            return stored != null ? TeleportPrefs.fromEntity(stored) : new TeleportPrefs(false);
        });
    }

    public void setAutoAccept(UUID playerId, boolean autoAccept) {
        DataOperator<TeleportPrefsEntity> operator = plugin.getDataOperator(TeleportPrefsEntity.class);
        // The change is written when it is made, to the row as stored now.
        TeleportPrefsEntity stored = readStored(playerId);
        if (stored == null) {
            operator.insert(TeleportPrefsEntity.builder()
                .playerId(playerId.toString())
                .autoAccept(autoAccept)
                .build());
        } else {
            operator.update("auto_accept", autoAccept, stored.getId());
        }
        preferences.remove(playerId);
    }

    private TeleportPrefsEntity readStored(UUID playerId) {
        List<TeleportPrefsEntity> rows = plugin.getDataOperator(TeleportPrefsEntity.class)
            .getAll(WhereCondition.builder().column("player_id").value(playerId.toString()).build());
        return rows.isEmpty() ? null : rows.get(0);
    }
}
