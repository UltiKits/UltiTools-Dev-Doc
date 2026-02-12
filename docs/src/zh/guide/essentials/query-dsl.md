# 流式查询 DSL

::: info 自 v6.2.0 起
流式查询 DSL 自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 提供了一套流式查询 DSL，让你可以使用可读性强的链式 API 来构建数据查询。无需手动构建 `WhereCondition` 对象，你可以直接编写表达力更强的查询语句。

## 基本用法

从任意 `DataOperator` 获取 `Query` 构建器：

```java
DataOperator<HomeEntity> dataOperator = plugin.getDataOperator(HomeEntity.class);

// 查找某个玩家的所有家
List<HomeEntity> homes = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .list();
```

## 条件

### where / and

使用 `where()` 开始第一个条件，使用 `and()` 添加额外条件：

```java
// 根据玩家和名称查找特定的家
HomeEntity home = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .and("name").eq("base")
    .first();
```

### 比较运算符

在调用 `where()` 或 `and()` 之后，链接以下运算符之一：

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `eq(value)` | 等于 | `.where("name").eq("base")` |
| `ne(value)` | 不等于 | `.where("status").ne("disabled")` |
| `gt(value)` | 大于 | `.where("level").gt(10)` |
| `lt(value)` | 小于 | `.where("balance").lt(1000.0)` |
| `gte(value)` | 大于等于 | `.where("level").gte(5)` |
| `lte(value)` | 小于等于 | `.where("balance").lte(500.0)` |
| `like(pattern)` | SQL LIKE 模式匹配 | `.where("name").like("%base%")` |
| `in(collection)` | 值在集合中 | `.where("world").in(worldList)` |

```java
// 查找余额在 100 到 1000 之间的玩家
List<PlayerEntity> players = dataOperator.query()
    .where("balance").gte(100.0)
    .and("balance").lte(1000.0)
    .list();

// 查找特定世界中的家
List<String> worlds = Arrays.asList("world", "world_nether");
List<HomeEntity> homes = dataOperator.query()
    .where("world").in(worlds)
    .list();
```

## 排序

使用 `orderBy()`（升序）或 `orderByDesc()`（降序）对结果排序：

```java
// 按余额降序获取玩家
List<PlayerEntity> richest = dataOperator.query()
    .orderByDesc("balance")
    .list();

// 按等级升序排序
List<PlayerEntity> sorted = dataOperator.query()
    .orderBy("level")
    .list();
```

## 分页

使用 `limit()` 和 `offset()` 进行分页：

```java
// 获取第 2 页，每页 10 条
int pageSize = 10;
int page = 2;
List<PlayerEntity> pageResults = dataOperator.query()
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .list();
```

## 终端操作

每个查询链必须以终端操作结束：

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `list()` | `List<T>` | 返回所有匹配结果 |
| `first()` | `T`（可为null） | 返回第一个匹配结果，无匹配则返回 `null` |
| `exists()` | `boolean` | 存在匹配结果则返回 `true` |
| `count()` | `long` | 统计匹配结果数量 |
| `delete()` | `int` | 删除匹配结果，返回删除数量 |

```java
// 检查玩家是否有家
boolean hasHomes = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .exists();

// 统计玩家的家数量
long homeCount = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .count();

// 删除特定世界的所有家
int deleted = dataOperator.query()
    .where("world").eq("old_world")
    .delete();
```

## 完整示例

以下是使用查询 DSL 的完整服务示例：

```java
@Service
public class HomeServiceImpl implements HomeService {

    private final UltiToolsPlugin plugin;

    @Autowired
    public HomeServiceImpl(UltiToolsPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public HomeEntity getHome(String playerUuid, String homeName) {
        return plugin.getDataOperator(HomeEntity.class).query()
            .where("playerId").eq(playerUuid)
            .and("name").eq(homeName)
            .first();
    }

    @Override
    public List<HomeEntity> getAllHomes(String playerUuid) {
        return plugin.getDataOperator(HomeEntity.class).query()
            .where("playerId").eq(playerUuid)
            .orderBy("name")
            .list();
    }

    @Override
    public boolean homeExists(String playerUuid, String homeName) {
        return plugin.getDataOperator(HomeEntity.class).query()
            .where("playerId").eq(playerUuid)
            .and("name").eq(homeName)
            .exists();
    }

    @Override
    public void deleteHome(String playerUuid, String homeName) {
        plugin.getDataOperator(HomeEntity.class).query()
            .where("playerId").eq(playerUuid)
            .and("name").eq(homeName)
            .delete();
    }
}
```

::: tip 旧版 API
`WhereCondition` API 仍然可用且未被弃用。查询 DSL 是一个更高级的替代方案，对于复杂查询可读性更好。你可以自由混合使用两种方式。
:::
