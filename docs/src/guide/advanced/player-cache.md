# Player Cache

::: info Since v6.2.0
The `@PlayerCache` annotation is available starting from UltiTools-API v6.2.0.
:::

Plugins often store per-player data in `Map<UUID, ?>` fields (cooldowns, settings, open GUIs, etc.). If you forget to clean up these maps when a player quits, you get a memory leak. UltiTools provides the `@PlayerCache` annotation to automatically remove entries when a player disconnects.

## Basic Usage

Annotate any `Map<UUID, ?>` field in a managed bean with `@PlayerCache`:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/CooldownService.java

When a player quits, the framework automatically calls `cooldowns.remove(playerUuid)`. No manual cleanup needed.

## Caching Stored Data

A `@PlayerCache` map works best as a read cache for data that is stored elsewhere, such as a database table. Read through the cache, write each change when it is made, and let the framework drop the entry when the player quits:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlayerSettingsService.java

`setShowScoreboard` reads the stored row, writes the one column that changed, and removes the cached entry so the next read loads the stored value. Nothing is written when the player quits, because the map holds no change that has not already been written. Do not write a cached copy back to the stored row; see [Caching on a Shared MySQL Database](#caching-on-a-shared-mysql-database).

## Save Before Remove

Set `saveBeforeRemove = true` and implement the `PlayerCacheSaver` interface to have the framework call `savePlayerData(playerUuid)` just before it removes the entry. This suits state that exists only in this server's memory and must be written once when the player leaves. It does not suit a cached copy of a stored row, because the copy can be older than the row.

When a player quits, the framework:
1. Calls `savePlayerData(playerUuid)` (because `saveBeforeRemove = true`)
2. Removes the entry from the map

## Caching on a Shared MySQL Database

Several servers can share one MySQL database, for example behind a proxy. A copy of a row that one server holds in memory can then be older than the stored row. A player leaves server A for server B and changes a setting there. If A still holds the row from before the change and writes it when the player quits, A's write replaces B's change with the old value. Writing cached copies at shutdown, or whole copies on every later change, has the same effect.

For data that is stored in a database, follow these rules:

1. Keep the cache scoped to the player's time on this server. Load the entry when the player joins or on the first read, and let `@PlayerCache` drop it when the player quits.
2. Never write a cached copy back: not when a value changes, not on quit (`saveBeforeRemove`), and not at shutdown.
3. For every change, read the stored row again, apply the change to that row, and write it.
4. When the new value depends on the value that was read, such as a counter or a toggle, write with `updateIf` conditioned on the values you read. A `false` result means another writer changed the row first: read it again and decide again. Give up after a few attempts (UltiEconomy uses three).
5. Write an increment as a compare-and-set loop of this kind, never as the cached value plus the amount.

As of v6.3.0, `DataOperator#updateIf` writes the entity only while the stored row still has every value in the conditions; see [Conditional Update](/guide/essentials/data-storage#conditional-update). It writes every mapped field of the entity, so add one condition for each column you read. The sketch below adds coins to a stored row. It needs UltiTools-API v6.3.0 or later and is not part of the compiled examples:

```java
// Requires UltiTools-API v6.3.0 or later (DataOperator#updateIf).
private static final int MAX_ATTEMPTS = 3;

public boolean addCoins(UUID playerId, int amount) {
    DataOperator<PlayerStats> stats = plugin.getDataOperator(PlayerStats.class);
    for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        PlayerStats row = stats.getById(playerId.toString()); // the stored row, never the cache
        if (row == null) {
            return false;
        }
        int coins = row.getCoins();
        int kills = row.getKills();
        row.setCoins(coins + amount); // apply this one change
        boolean written = stats.updateIf(row,
            WhereCondition.builder().column("coins").value(coins).build(),
            WhereCondition.builder().column("kills").value(kills).build());
        if (written) {
            return true;
        }
        // Another writer changed the row first: read it again and decide again.
    }
    return false; // contended: tell the player to try again instead of writing
}
```

A change that does not depend on the value read, such as switching a setting to the value the player chose, can write just that column by id with `update(column, value, id)`, as `PlayerSettingsService` does. On the JSON and SQLite backends the data belongs to one server, and the same code works unchanged.

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

<<< @/../examples/src/main/java/com/ultikits/docs/cache/GameService.java

## Requirements

- The field must be a `Map` with `UUID` keys
- The field must be in a bean managed by the container (`@Service`, `@CmdExecutor`, `@EventListener`)
- For `saveBeforeRemove = true`, the bean must implement `PlayerCacheSaver`
- Use `ConcurrentHashMap` if the map is accessed from async threads

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/cache/TeleportRequestService.java

::: tip
`@PlayerCache` eliminates the most common source of memory leaks in Minecraft plugins. Use it on every `Map<UUID, ?>` field that stores per-player state.
:::
