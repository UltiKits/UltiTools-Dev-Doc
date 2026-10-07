# 玩家缓存

::: info 自 v6.2.0 起
`@PlayerCache` 注解自 UltiTools-API v6.2.0 起可用。
:::

插件经常在 `Map<UUID, ?>` 字段中存储玩家相关数据（冷却时间、设置、打开的 GUI 等）。如果在玩家退出时忘记清理这些 Map，就会导致内存泄漏。UltiTools 提供了 `@PlayerCache` 注解，在玩家断开连接时自动移除对应条目。

## 基本用法

在托管 Bean 中的任何 `Map<UUID, ?>` 字段上添加 `@PlayerCache` 注解：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/CooldownService.java

当玩家退出时，框架会自动调用 `cooldowns.remove(playerUuid)`，无需手动清理。

## 缓存已存储的数据

`@PlayerCache` 的 Map 最适合用作存放在别处（例如数据库表）的数据的读缓存。通过缓存读取，每次修改在发生时就写入，玩家退出时由框架移除条目：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlayerSettingsService.java

`setShowScoreboard` 读取已存储的行，只写入发生变化的那一列，然后移除缓存条目，让下一次读取载入已存储的值。玩家退出时不会写入任何内容，因为 Map 里没有尚未写入的修改。不要把缓存中的副本写回已存储的行，见[在共享 MySQL 数据库上使用缓存](#在共享-mysql-数据库上使用缓存)。

## 移除前保存

设置 `saveBeforeRemove = true` 并实现 `PlayerCacheSaver` 接口，框架会在移除条目之前调用 `savePlayerData(playerUuid)`。它适用于只存在于本服务器内存中、需要在玩家离开时写入一次的状态。它不适用于已存储的行的缓存副本，因为副本可能比数据库里的行更旧。

玩家加入本服务器的时间就是这类状态：没有任何已存储的行保存它。下面的服务在玩家退出时为已结束的会话追加一行新记录，不读取也不覆盖任何已存储的行：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlaySessionService.java

当玩家退出时，框架会：
1. 调用 `savePlayerData(playerUuid)`（因为 `saveBeforeRemove = true`）
2. 从 Map 中移除该条目

## 在共享 MySQL 数据库上使用缓存

多台服务器可以共用一个 MySQL 数据库，例如放在代理端后面。这时某台服务器在内存里持有的行副本，可能比数据库里的行更旧。玩家从服务器 A 去了服务器 B，并在 B 上修改了一项设置。如果 A 仍然持有修改之前的行，并在玩家退出时把它写回，A 的写入会用旧值覆盖 B 上的修改。关服时写回缓存，或者之后每次修改都写回整份副本，也会出现同样的结果。

对存储在数据库中的数据，遵循下面的规则：

1. 缓存只在玩家处于本服务器期间有效。玩家加入时或第一次读取时载入条目，玩家退出时由 `@PlayerCache` 移除。
2. 永远不要把缓存中的副本写回：数值变化时不写，退出时不写（`saveBeforeRemove`），关服时也不写。
3. 每次修改都重新读取已存储的行，把修改应用到这一行上再写入。
4. 新值取决于读到的旧值时（例如计数器或开关），用 `updateIf` 写入，条件为你读到的各列的值。返回 `false` 说明其他写入方先修改了这一行：重新读取并重新判断。尝试几次后仍然失败就放弃（UltiEconomy 最多尝试三次）。
5. 增量也按这种比较并设置的循环来写，不要写成缓存值加增量。

自 v6.3.0 起，`DataOperator#updateIf` 只在已存储的行仍然满足所有条件时才写入实体，详见[条件更新](/zh/guide/essentials/data-storage#条件更新)。它会写入实体的每个已映射字段，所以条件必须覆盖实体映射的每一列，而不只是你的代码读取或修改的那几列：漏掉的列如果在此期间被其他服务器修改，会被你读到的旧值覆盖。下面的示意假定 `PlayerStats` 除 id 外只映射 `coins` 和 `kills` 两列。下面的示意给一行数据增加金币。它需要 UltiTools-API v6.3.0 或更高版本，不属于编译检查的示例：

```java
// 需要 UltiTools-API v6.3.0 或更高版本（DataOperator#updateIf）。
private static final int MAX_ATTEMPTS = 3;

public boolean addCoins(UUID playerId, int amount) {
    DataOperator<PlayerStats> stats = plugin.getDataOperator(PlayerStats.class);
    for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        PlayerStats row = stats.getById(playerId.toString()); // 已存储的行，不是缓存
        if (row == null) {
            return false;
        }
        int coins = row.getCoins();
        int kills = row.getKills();
        row.setCoins(coins + amount); // 只应用这一项修改
        boolean written = stats.updateIf(row,
            WhereCondition.builder().column("coins").value(coins).build(),
            WhereCondition.builder().column("kills").value(kills).build());
        if (written) {
            return true;
        }
        // 其他写入方先修改了这一行：重新读取并重新判断。
    }
    return false; // 争用过多：提示玩家重试，而不是写入
}
```

不依赖读到的值的修改，例如把设置切换为玩家选择的值，可以用 `update(column, value, id)` 只写那一列，`PlayerSettingsService` 就是这样做的。在 JSON 和 SQLite 后端上，数据属于一台服务器，同样的代码无需改动。

本页的示例在玩家第一次修改设置时为该玩家插入一行。请给表的玩家列（`player_id`）建立唯一索引，这样两台服务器在同一时刻为同一玩家做首次修改时，不会各存一行：第二次插入会失败而不是再存一行，调用方可以读取已存储的行，把修改写到那一行上。

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

- 字段必须是以 `UUID` 为键的 `Map`（自 v6.3.0 起也可以是 `Set<UUID>`，或值为 `UUID` 的 `Map`）
- 字段必须在容器管理的 Bean 中（`@Service`、`@CmdExecutor`、`@EventListener`）
- 使用 `saveBeforeRemove = true` 时，Bean 必须实现 `PlayerCacheSaver`
- 如果 Map 会被异步线程访问，请使用 `ConcurrentHashMap`

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/cache/TeleportRequestService.java

::: tip 每个按玩家存储的 Map 都应使用 @PlayerCache
`@PlayerCache` 可以消除 Minecraft 插件中最常见的内存泄漏来源。建议在每个存储玩家状态的 `Map<UUID, ?>` 字段上使用它。
:::
