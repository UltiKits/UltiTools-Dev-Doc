package com.ultikits.docs.cache;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.PlayerCache;
import com.ultikits.ultitools.annotations.PlayerCacheSaver;
import com.ultikits.ultitools.annotations.PreDestroy;
import com.ultikits.ultitools.annotations.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlaySessionService implements PlayerCacheSaver {

    @Autowired
    private UltiToolsPlugin plugin;

    // State that exists only in this server's memory: when each player joined here.
    // No stored row holds it, so there is nothing a copy could go stale against.
    @PlayerCache(saveBeforeRemove = true)
    private final Map<UUID, Long> joinedAt = new ConcurrentHashMap<>();

    // Called from a join listener.
    public void sessionStarted(UUID playerId) {
        joinedAt.put(playerId, System.currentTimeMillis());
    }

    // Called by the framework when the player quits, just before the entry is removed.
    @Override
    public void savePlayerData(UUID playerId) {
        Long start = joinedAt.get(playerId);
        if (start == null) {
            return;
        }
        // Append one new row for the finished session. No stored row is read or overwritten.
        plugin.getDataOperator(PlaySessionEntity.class).insert(PlaySessionEntity.builder()
            .playerId(playerId.toString())
            .durationMillis(System.currentTimeMillis() - start)
            .build());
    }

    // The framework does not call savePlayerData when the server stops (players are disconnected
    // after plugins are disabled), so write the sessions that are still open.
    @PreDestroy
    public void saveOpenSessions() {
        for (UUID playerId : joinedAt.keySet()) {
            savePlayerData(playerId);
        }
        joinedAt.clear();
    }
}
