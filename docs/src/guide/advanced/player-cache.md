# Player Cache

This page describes the player cache API as of v7.0.0. See the [7.0.0 release notes](../release-notes/7.0.0) for an overview.

`@PlayerCache` removes a player’s entries from managed collections on quit. It does not load data or guarantee persistence.

## Basic Usage

Declare a mutable `Map<UUID, ?>` field in a managed singleton and annotate it with `@PlayerCache`:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/CooldownService.java

On `PlayerQuitEvent`, the framework calls `cooldowns.remove(playerUuid)`. It does not populate the map on join or load it from storage; the bean decides when to add or load entries.

## Caching Stored Data

A `@PlayerCache` map works best as a read cache for data that is stored elsewhere, such as a database table. Read through the cache, write each change when it is made, and let the framework drop the entry when the player quits:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlayerSettingsService.java

`setShowScoreboard` reads the stored row, updates just the changed column (or inserts a row if none exists), and invalidates the cache so the next read loads from storage. Quit does not write the cached copy back. See [Caching on a Shared MySQL Database](#caching-on-a-shared-mysql-database).

Package the `@Table` entity in the owning module’s JAR. This also applies to `PlaySessionEntity` and `TeleportPrefsEntity` below. See [Entity Registration](../essentials/data-storage#entity-registration) for entity ownership and the standalone Paper plugin API.

## Save Before Remove

Set `saveBeforeRemove = true` and implement `PlayerCacheSaver` to run `savePlayerData(playerUuid)` before removal. Use it for state that exists only in memory and needs to be written on quit, not for a cached copy of a stored row.

The time a player joined this server is such state: no stored row holds it. The service below appends one new row for the finished session when the player quits, and reads or overwrites no stored row:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlaySessionService.java

At module unload or server shutdown, the framework unregisters tracked beans before closing their container. Unregistering neither empties the collections nor invokes `savePlayerData`. The example uses a separate `@PreDestroy` method to write sessions still in memory at container close. Do not rely on a quit event to save them.

For each registered field, the quit handler:
1. Calls `savePlayerData(playerUuid)` if `saveBeforeRemove = true`, even when the field is `null` or has no entry for that player.
2. Reads the collection and tries to remove the player’s entries if the collection is not `null`.

A save failure does not prevent the removal attempt. A removal failure may leave the entry in the collection. Each failed operation logs one `WARNING` with its exception or `Error`; the other fields and beans are still processed. There is no automatic retry. The messages below are logged directly in English on both locales. Angle brackets indicate runtime values.

```text
Failed to save @PlayerCache field '<field>' on <bean class> for player <UUID> on quit; continuing with the remaining entries
Failed to remove the entry of @PlayerCache field '<field>' on <bean class> for player <UUID> on quit; continuing with the remaining entries
```

## Caching on a Shared MySQL Database

Several servers can share one MySQL database, for example behind a proxy. A copy of a row that one server holds in memory can then be older than the stored row. A player leaves server A for server B and changes a setting there. If A still holds the row from before the change and writes it when the player quits, A's write replaces B's change with the old value. Writing cached copies at shutdown, or whole copies on every later change, has the same effect.

For data that is stored in a database, follow these rules:

1. Scope the cache to the player’s time on this server. Load it in your join handler or on first read and let `@PlayerCache` drop the entry on quit. It does not invalidate entries when another server writes.
2. Never write a cached copy back: not when a value changes, not on quit (`saveBeforeRemove`), and not at shutdown.
3. Use a single-column write by ID for an independent change, or read the current stored row before computing a change that depends on the old value.
4. For a change that depends on the old value, use `updateIf` with the values you read as expectations. If it returns `false`, no row matched the ID and all expectations. Read again and decide whether to retry; cap the number of attempts.
5. Write an increment as a compare-and-set loop of this kind, never as the cached value plus the amount.

`DataOperator#updateIf` tests the stored values and writes in one operation. It writes every mapped field, so condition the write on the prior value of every field being written if you need to prevent a concurrent change from being overwritten. See [Conditional Update](/guide/essentials/data-storage#conditional-update). This example assumes `PlayerStats` uses the player UUID string as its ID and maps only `coins` and `kills` besides the ID:

```java
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
        // The row is gone or no longer matches; read again.
    }
    return false; // contended: tell the player to try again instead of writing
}
```

If a change does not depend on the old value, use `update(column, value, id)` to write just that column of an existing row, as `PlayerSettingsService` does. This also works on SQLite and JSON.

The settings examples use a read followed by an insert for a missing row, not an atomic upsert. In a shared MySQL deployment, enforce uniqueness on `player_id` and handle a duplicate-key failure by re-reading the row and applying the change to it. The examples do not implement that handling.

## Annotation Reference

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `saveBeforeRemove` | `boolean` | `false` | If `true`, calls `savePlayerData(UUID)` once for this field on quit, before attempting removal. The bean must implement `PlayerCacheSaver`. |

## PlayerCacheSaver Interface

```java
public interface PlayerCacheSaver {
    void savePlayerData(UUID playerId);
}
```

The interface is in `com.ultikits.ultitools.annotations`. It is required only for beans with a field that sets `saveBeforeRemove = true`.

::: warning Cache registration refusal
A missing saver throws `PluginModuleException` (`ULTI-1001`) and fails module loading or external plugin connection. Implement `PlayerCacheSaver` on the bean or leave `saveBeforeRemove` at `false`.
:::

The exception message is `@PlayerCache field '<field>' declared on <declaring class> requests saveBeforeRemove = true, but bean <bean class> does not implement PlayerCacheSaver`. For a module, the load failure is also logged as `[UltiTools-API] <module> load failed!`. For an external plugin, `connect(...)` throws `IllegalStateException` with the message `Failed to connect plugin <plugin> to UltiTools` and keeps the original exception as its cause.

## Multiple Maps

A bean with several save-marked fields receives one callback per field, even after an earlier callback fails. Later callbacks can see earlier fields already cleaned. If one callback saves the entire bean’s state, mark only one field or make the save safe to repeat. Separate callbacks are not retries.

In this example only `openInventories` triggers a callback. Treat it as a placeholder for the bean’s save logic; do not assume the other maps are still populated when it runs. Every field is cleaned independently.

<<< @/../examples/src/main/java/com/ultikits/docs/cache/GameService.java

## Requirements

- Declare a mutable `Map<UUID, ?>`, `Map<?, UUID>`, or `Set<UUID>` with explicit `UUID` on the relevant side. Raw collections and UUID wildcards are not accepted.
- UUID-keyed maps remove the player’s key, including `Map<UUID, UUID>`. Otherwise a UUID-valued map removes all entries whose value equals the player’s UUID. A set removes the UUID itself.
- Unsupported field types are rejected with `PluginModuleException` (`ULTI-1001`): `@PlayerCache field '<field>' on <declaring class> has an unsupported shape; PlayerCacheManager can only sweep Map<UUID, ?> (key-side), Map<?, UUID> (value-side), and Set<UUID>`.
- The framework scans the existing container singletons after `registerSelf()` succeeds for a module, or during a connected Paper plugin’s registration. A managed `@Service` or an object added with `registerSingleton(...)` before the scan can be tracked. `registerType(...)` alone does not make an object a tracked singleton. External disconnect also unregisters tracked beans before closing the container.
- Saver validation checks the actual bean instance, not the class that declares the field. A subclass implementing `PlayerCacheSaver` can therefore inherit a save-marked field.
- If async code accesses a map, use a thread-safe collection such as `ConcurrentHashMap`. This does not make a sequence of cache and database operations atomic.

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/cache/TeleportRequestService.java

::: tip Quit cleanup
A UUID-keyed map evicts entries by key. In the teleport example a departing requester’s entry is removed, but requests that name the departing player only as a target are not removed by the annotation.
:::
