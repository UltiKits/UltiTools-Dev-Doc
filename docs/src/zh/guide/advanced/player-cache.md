# 玩家缓存

7.0.0 尚未发布。本页介绍自 v7.0.0 起适用的玩家缓存 API，概览见 [7.0.0 更新说明](../release-notes/7.0.0)。

`@PlayerCache` 在玩家退出时清理托管集合中的对应条目。它不负责载入数据，也不保证持久化。

## 基本用法

在托管的单例 Bean 中声明一个可变的 `Map<UUID, ?>` 字段，并添加 `@PlayerCache` 注解：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/CooldownService.java

收到 `PlayerQuitEvent` 时，框架调用 `cooldowns.remove(playerUuid)`。框架不会在玩家加入时填充 Map，也不会从存储中载入数据；添加或读取条目的时机由 Bean 决定。

## 缓存已存储的数据

`@PlayerCache` 的 Map 最适合用作存放在别处（例如数据库表）的数据的读缓存。通过缓存读取，每次修改在发生时就写入，玩家退出时由框架移除条目：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlayerSettingsService.java

`setShowScoreboard` 读取已存储的行，只更新发生变化的一列（没有该行时则插入），再使缓存失效，让下次读取从存储载入。退出时不会写回缓存副本。见[在共享 MySQL 数据库上使用缓存](#在共享-mysql-数据库上使用缓存)。

请将带 `@Table` 的实体随所属模块打包。下文的 `PlaySessionEntity` 和 `TeleportPrefsEntity` 也一样。实体所有权与独立 Paper 插件的 API 见[实体登记](../essentials/data-storage#entity-registration)。

## 移除前保存

设置 `saveBeforeRemove = true` 并实现 `PlayerCacheSaver`，即可在移除前运行 `savePlayerData(playerUuid)`。它适用于仅存于内存、需要在退出时写入的状态，不适用于已存储行的缓存副本。

玩家加入本服务器的时间就是这类状态：没有任何已存储的行保存它。下面的服务在玩家退出时为已结束的会话追加一行新记录，不读取也不覆盖任何已存储的行：

<<< @/../examples/src/main/java/com/ultikits/docs/cache/PlaySessionService.java

卸载模块或停服时，框架先注销跟踪的 Bean，再关闭容器。注销不会清空集合，也不会调用 `savePlayerData`。示例使用独立的 `@PreDestroy` 方法，在容器关闭时写入仍在内存中的会话。不要依赖退出事件来保存这些会话。

退出处理器对每个已登记字段执行以下操作：
1. 若 `saveBeforeRemove = true`，调用 `savePlayerData(playerUuid)`，即使该字段为 `null` 或没有该玩家的条目。
2. 读取集合；集合不是 `null` 时，尝试移除该玩家的条目。

保存失败不影响随后的移除尝试。移除失败时，条目可能留在集合中。每个失败的操作都会记录一条带有异常或 `Error` 的 `WARNING`，其余字段和 Bean 继续处理。框架不会自动重试。以下日志在两种语言下均直接输出英文，尖括号表示运行时填入的值。

```text
Failed to save @PlayerCache field '<field>' on <bean class> for player <UUID> on quit; continuing with the remaining entries
Failed to remove the entry of @PlayerCache field '<field>' on <bean class> for player <UUID> on quit; continuing with the remaining entries
```

## 在共享 MySQL 数据库上使用缓存

多台服务器可以共用一个 MySQL 数据库，例如放在代理端后面。这时某台服务器在内存里持有的行副本，可能比数据库里的行更旧。玩家从服务器 A 去了服务器 B，并在 B 上修改了一项设置。如果 A 仍然持有修改之前的行，并在玩家退出时把它写回，A 的写入会用旧值覆盖 B 上的修改。关服时写回缓存，或者之后每次修改都写回整份副本，也会出现同样的结果。

对存储在数据库中的数据，遵循下面的规则：

1. 只在玩家处于本服务器期间保留缓存。你可以在加入处理器中或首次读取时载入，退出时由 `@PlayerCache` 移除；其他服务器写入不会使本地缓存失效。
2. 永远不要把缓存中的副本写回：数值变化时不写，退出时不写（`saveBeforeRemove`），关服时也不写。
3. 不依赖旧值的修改可按 ID 只写一列；依赖旧值的修改先读取当前存储的行，再计算新值。
4. 修改依赖旧值时，把读到的值作为 `updateIf` 的预期条件。返回 `false` 表示没有行同时匹配 ID 和全部条件。重新读取并判断是否重试，同时限制尝试次数。
5. 增量也按这种比较并设置的循环来写，不要写成缓存值加增量。

`DataOperator#updateIf` 在同一次操作中检查存储值并写入。它会写入每个映射字段；若要避免覆盖并发修改，条件应检查每个写入字段的旧值。见[条件更新](/zh/guide/essentials/data-storage#条件更新)。本例假定 `PlayerStats` 使用玩家 UUID 字符串作为 ID，除 ID 外只映射 `coins` 和 `kills`：

```java
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
        // 该行已不存在或不再满足预期条件；重新读取。
    }
    return false; // 争用过多：提示玩家重试，而不是写入
}
```

不依赖旧值的修改，可用 `update(column, value, id)` 只写现有行的一列，`PlayerSettingsService` 即采用此做法。SQLite 与 JSON 后端也支持该调用。

设置示例先读后插入缺失的行，不是原子操作。多服共用 MySQL 时，应为 `player_id` 加唯一约束；遇到重复键错误时，重读已有行再应用修改。示例未实现这一处理。

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `saveBeforeRemove` | `boolean` | `false` | 为 `true` 时，退出处理会在尝试移除前，为该字段调用一次 `savePlayerData(UUID)`。Bean 必须实现 `PlayerCacheSaver`。 |

## PlayerCacheSaver 接口

```java
public interface PlayerCacheSaver {
    void savePlayerData(UUID playerId);
}
```

该接口位于 `com.ultikits.ultitools.annotations`。仅当 Bean 的字段设置了 `saveBeforeRemove = true` 时才必须实现。

::: warning 缓存注册被拒绝
缺少保存接口会抛出 `PluginModuleException`（`ULTI-1001`），导致模块加载或外部插件接入失败。请让该 Bean 实现 `PlayerCacheSaver`，或保持 `saveBeforeRemove` 为 `false`。
:::

异常原文为 `@PlayerCache field '<field>' declared on <declaring class> requests saveBeforeRemove = true, but bean <bean class> does not implement PlayerCacheSaver`。模块加载失败时还会记录 `[UltiTools-API] <module> load failed!`。外部插件的 `connect(...)` 则抛出 `IllegalStateException`，原文为 `Failed to connect plugin <plugin> to UltiTools`，并保留原异常作为原因。

## 多个 Map

同一 Bean 有多个启用保存的字段时，每个字段调用一次，前一次调用失败也不例外。后续回调可能看到前面的字段已清理。如果一次回调会保存该 Bean 的全部状态，只为一个字段启用保存，或让保存可安全地重复执行。不同字段的回调并不是重试。

本例中只有 `openInventories` 触发回调。回调体只是保存逻辑的占位，不应假定执行时其他 Map 仍有该玩家的条目。每个字段独立清理。

<<< @/../examples/src/main/java/com/ultikits/docs/cache/GameService.java

## 使用要求

- 声明可变的 `Map<UUID, ?>`、`Map<?, UUID>` 或 `Set<UUID>`，在对应位置明确写 `UUID`。不支持原始集合类型或以通配符代替 `UUID`。
- 以 UUID 为键的 Map 移除该玩家的键，`Map<UUID, UUID>` 也如此。仅值为 UUID 的 Map 移除所有值等于该玩家 UUID 的条目。Set 移除 UUID 本身。
- 不支持的字段类型会抛出 `PluginModuleException`（`ULTI-1001`），异常原文为 `@PlayerCache field '<field>' on <declaring class> has an unsupported shape; PlayerCacheManager can only sweep Map<UUID, ?> (key-side), Map<?, UUID> (value-side), and Set<UUID>`。
- 模块的 `registerSelf()` 成功后，或独立 Paper 插件接入注册时，框架扫描容器中已有的单例。托管的 `@Service` 或扫描前通过 `registerSingleton(...)` 添加的对象可以被跟踪。只有 `registerType(...)` 不会把对象加入被跟踪的单例。外部插件断开接入时，也会先注销跟踪的 Bean，再关闭容器。
- 保存接口按实际 Bean 实例校验，而不是按声明字段的类校验。因此，实现了 `PlayerCacheSaver` 的子类可以继承启用保存的字段。
- 异步代码访问 Map 时，使用 `ConcurrentHashMap` 等线程安全集合。这不会使一连串缓存与数据库操作变成原子操作。

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/cache/TeleportRequestService.java

::: tip 退出清理
以 UUID 为键的 Map 按键清理。传送示例会移除退出玩家发出的请求，但如果该玩家只是其他请求的目标，注解不会移除那些请求。
:::
