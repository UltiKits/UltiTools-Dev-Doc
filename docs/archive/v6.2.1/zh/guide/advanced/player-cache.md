# 玩家缓存

::: info 自 v6.2.0 起
`@PlayerCache` 注解自 UltiTools-API v6.2.0 起可用。
:::

插件经常在 `Map<UUID, ?>` 字段中存储玩家相关数据（冷却时间、设置、打开的 GUI 等）。如果在玩家退出时忘记清理这些 Map，就会导致内存泄漏。UltiTools 提供了 `@PlayerCache` 注解，在玩家断开连接时自动移除对应条目。

## 基本用法

在托管 Bean 中的任何 `Map<UUID, ?>` 字段上添加 `@PlayerCache` 注解：

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

当玩家退出时，框架会自动调用 `cooldowns.remove(playerUuid)`，无需手动清理。

## 移除前保存

如果需要在清除缓存前持久化数据，设置 `saveBeforeRemove = true` 并实现 `PlayerCacheSaver` 接口：

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
        // 修改暂存在内存中，直到玩家退出或手动保存
    }

    @Override
    public void savePlayerData(UUID playerId) {
        PlayerSettings settings = settingsCache.get(playerId);
        if (settings != null && settings.isDirty()) {
            try {
                plugin.getDataOperator(PlayerSettingsEntity.class).update(settings.toEntity());
            } catch (IllegalAccessException e) {
                plugin.getLogger().warning("保存玩家设置失败: " + playerId);
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

当玩家退出时，框架会：
1. 调用 `savePlayerData(playerUuid)`（因为 `saveBeforeRemove = true`）
2. 从 Map 中移除该条目

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `saveBeforeRemove` | `boolean` | `false` | 如果为 `true`，在移除条目前调用 Bean 的 `savePlayerData(UUID)` 方法。Bean 必须实现 `PlayerCacheSaver` 接口。 |

## PlayerCacheSaver 接口

```java
public interface PlayerCacheSaver {
    void savePlayerData(UUID playerId);
}
```

该接口是可选的，仅在使用 `saveBeforeRemove = true` 时才需要实现。

## 多个 Map

一个 Bean 可以有多个 `@PlayerCache` 字段，每个都会独立清理：

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
        // 仅对 saveBeforeRemove=true 的字段触发调用，
        // 但你可以在这里保存所有数据
    }
}
```

## 使用要求

- 字段必须是以 `UUID` 为键的 `Map`
- 字段必须在容器管理的 Bean 中（`@Service`、`@CmdExecutor`、`@EventListener`）
- 使用 `saveBeforeRemove = true` 时，Bean 必须实现 `PlayerCacheSaver`
- 如果 Map 会被异步线程访问，请使用 `ConcurrentHashMap`

## 完整示例

```java
@Service
public class TeleportRequestService implements PlayerCacheSaver {

    @Autowired
    private UltiToolsPlugin plugin;

    // 待处理的传送请求：请求者 -> 目标
    @PlayerCache
    private final Map<UUID, UUID> pendingRequests = new ConcurrentHashMap<>();

    // 玩家的传送偏好设置（退出时保存）
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
                plugin.getLogger().warning("保存传送偏好失败: " + e.getMessage());
            }
        }
    }
}
```

::: tip
`@PlayerCache` 可以消除 Minecraft 插件中最常见的内存泄漏来源。建议在每个存储玩家状态的 `Map<UUID, ?>` 字段上使用它。
:::
