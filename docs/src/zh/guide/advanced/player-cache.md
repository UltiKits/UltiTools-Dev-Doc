# 玩家缓存

::: info 自 v6.2.0 起
`@PlayerCache` 注解自 UltiTools-API v6.2.0 起可用。
:::

插件经常在 `Map<UUID, ?>` 字段中存储玩家相关数据（冷却时间、设置、打开的 GUI 等）。如果在玩家退出时忘记清理这些 Map，就会导致内存泄漏。UltiTools 提供了 `@PlayerCache` 注解，在玩家断开连接时自动移除对应条目。

## 基本用法

在托管 Bean 中的任何 `Map<UUID, ?>` 字段上添加 `@PlayerCache` 注解：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/CooldownService.java

当玩家退出时，框架会自动调用 `cooldowns.remove(playerUuid)`，无需手动清理。

## 移除前保存

如果需要在清除缓存前持久化数据，设置 `saveBeforeRemove = true` 并实现 `PlayerCacheSaver` 接口：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlayerSettingsService.java

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

<<< @/../examples/src/main/java/com/ultikits/docs/cache/GameService.java

## 使用要求

- 字段必须是以 `UUID` 为键的 `Map`
- 字段必须在容器管理的 Bean 中（`@Service`、`@CmdExecutor`、`@EventListener`）
- 使用 `saveBeforeRemove = true` 时，Bean 必须实现 `PlayerCacheSaver`
- 如果 Map 会被异步线程访问，请使用 `ConcurrentHashMap`

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/cache/TeleportRequestService.java

::: tip
`@PlayerCache` 可以消除 Minecraft 插件中最常见的内存泄漏来源。建议在每个存储玩家状态的 `Map<UUID, ?>` 字段上使用它。
:::
