# Player Cache

::: info Since v6.2.0
The `@PlayerCache` annotation is available starting from UltiTools-API v6.2.0.
:::

Plugins often store per-player data in `Map<UUID, ?>` fields (cooldowns, settings, open GUIs, etc.). If you forget to clean up these maps when a player quits, you get a memory leak. UltiTools provides the `@PlayerCache` annotation to automatically remove entries when a player disconnects.

## Basic Usage

Annotate any `Map<UUID, ?>` field in a managed bean with `@PlayerCache`:

```java
@Service
public class CooldownService {

    @PlayerCache
    private final Map<UUID, Long> cooldowns = new ConcurrentHashMap<>();

    public boolean isOnCooldown(UUID playerId) {
        Long expiry = cooldowns.get(playerId);
        return expiry != null && System.currentTimeMillis() < expiry;
    }

    public void setCooldown(UUID playerId, long durationMs) {
        cooldowns.put(playerId, System.currentTimeMillis() + durationMs);
    }
}
```

When a player quits, the framework automatically calls `cooldowns.remove(playerUuid)`. No manual cleanup needed.

## Save Before Remove

If you need to persist cached data before it is evicted, set `saveBeforeRemove = true` and implement the `PlayerCacheSaver` interface:

```java
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
                plugin.getLogger().warning("Failed to save settings for " + playerId);
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
```

When a player quits, the framework:
1. Calls `savePlayerData(playerUuid)` (because `saveBeforeRemove = true`)
2. Removes the entry from the map

## Annotation Reference

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `saveBeforeRemove` | `boolean` | `false` | If `true`, calls `savePlayerData(UUID)` on the bean before removing the entry. The bean must implement `PlayerCacheSaver`. |

## PlayerCacheSaver Interface

```java
public interface PlayerCacheSaver {
    void savePlayerData(UUID playerId);
}
```

This interface is optional. Only implement it when you use `saveBeforeRemove = true`.

## Multiple Maps

A single bean can have multiple `@PlayerCache` fields. Each is cleaned up independently:

```java
@Service
public class GameService implements PlayerCacheSaver {

    @PlayerCache
    private final Map<UUID, Integer> scores = new ConcurrentHashMap<>();

    @PlayerCache(saveBeforeRemove = true)
    private final Map<UUID, Inventory> openInventories = new ConcurrentHashMap<>();

    @PlayerCache
    private final Map<UUID, Long> lastActivity = new ConcurrentHashMap<>();

    @Override
    public void savePlayerData(UUID playerId) {
        // Called only for the saveBeforeRemove=true field,
        // but you can save all data here
    }
}
```

## Requirements

- The field must be a `Map` with `UUID` keys
- The field must be in a bean managed by the container (`@Service`, `@CmdExecutor`, `@EventListener`)
- For `saveBeforeRemove = true`, the bean must implement `PlayerCacheSaver`
- Use `ConcurrentHashMap` if the map is accessed from async threads

## Complete Example

```java
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
                plugin.getLogger().warning("Failed to save teleport prefs: " + e.getMessage());
            }
        }
    }
}
```

::: tip
`@PlayerCache` eliminates the most common source of memory leaks in Minecraft plugins. Use it on every `Map<UUID, ?>` field that stores per-player state.
:::
