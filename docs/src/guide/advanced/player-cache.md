# Player Cache

::: info Since v6.2.0
The `@PlayerCache` annotation is available starting from UltiTools-API v6.2.0.
:::

Plugins often store per-player data in `Map<UUID, ?>` fields (cooldowns, settings, open GUIs, etc.). If you forget to clean up these maps when a player quits, you get a memory leak. UltiTools provides the `@PlayerCache` annotation to automatically remove entries when a player disconnects.

## Basic Usage

Annotate any `Map<UUID, ?>` field in a managed bean with `@PlayerCache`:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/CooldownService.java

When a player quits, the framework automatically calls `cooldowns.remove(playerUuid)`. No manual cleanup needed.

## Save Before Remove

If you need to persist cached data before it is evicted, set `saveBeforeRemove = true` and implement the `PlayerCacheSaver` interface:

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlayerSettingsService.java

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
