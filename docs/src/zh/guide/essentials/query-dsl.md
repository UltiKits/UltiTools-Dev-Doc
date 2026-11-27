# 流式查询 DSL

7.0.0 尚未发布。本页介绍自 v7.0.0 起适用的查询 API，概览见 [7.0.0 更新说明](../release-notes/7.0.0)。

`DataOperator#query()` 创建一个可链式调用的查询构建器。

## 基本用法

在模块中，通过 `plugin.getDataOperator(HomeEntity.class)` 获取操作器。实体必须登记在当前模块的数据作用域中。普通 Paper 插件调用 `UltiToolsAPI.connect(this)` 成功后，使用 `UltiToolsAPI.getDataOperator(this, HomeEntity.class)`。实体发现、额外登记和所有权错误见[实体登记](./data-storage#entity-registration)。

```java
DataOperator<HomeEntity> dataOperator = plugin.getDataOperator(HomeEntity.class);

// 查找某个玩家的所有家
List<HomeEntity> homes = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .list();
```

各代码片段独立使用，操作器须与实体类型对应。[完整示例](#完整示例)中的 `HomeEntity` 映射 `player_id` 和 `name`；使用 `world` 的片段假定你已添加该映射。`playerOperator` 是 `DataOperator<PlayerEntity>`，这些片段假定实体映射 `balance` 和 `level`。请使用 `@Column` 中的列名而不是 Java 字段名。MySQL 和 SQLite 会以 `DataAccessException` 拒绝 `eq` 中的未知列；`in` 对无法解析的字段不匹配任何行。

## 条件

### where / and

用 `where(column)` 指定第一个条件的列，用 `and(column)` 指定后续列。两者都只选择下一次比较使用的列；比较调用才添加条件。所有条件必须同时满足，`where` 不会清除已有条件。

```java
// 根据玩家和名称查找特定的家
HomeEntity home = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .and("name").eq("base")
    .first();
```

### 比较运算符

在调用 `where()` 或 `and()` 之后，链接以下运算符之一：

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `eq(value)` | 交给后端的 `WhereCondition`，比较方式为 `EQUAL` | `.where("name").eq("base")` |
| `ne(value)` | 非空字段值的 Java `equals` 返回 `false` | `.where("name").ne("base")` |
| `gt(value)` | 大于 | `.where("level").gt(10)` |
| `lt(value)` | 小于 | `.where("balance").lt(1000.0)` |
| `gte(value)` | 大于等于 | `.where("level").gte(5)` |
| `lte(value)` | 小于等于 | `.where("balance").lte(500.0)` |
| `like(pattern)` | 匹配整个非空值的字符串表示（见下文） | `.where("name").like("%base%")` |
| `in(collection)` | 字段值非空，且集合的 `contains` 返回 `true` | `.where("world").in(worlds)` |

```java
// 查找余额在 100 到 1000 之间的玩家
List<PlayerEntity> players = playerOperator.query()
    .where("balance").gte(100.0)
    .and("balance").lte(1000.0)
    .list();

// 查找特定世界中的家
List<String> worlds = Arrays.asList("world", "world_nether");
List<HomeEntity> homes = dataOperator.query()
    .where("world").in(worlds)
    .list();
```

`like` 在内存中使用 Java 正则表达式的 `(?i)` 模式，把 `%` 替换为 `.*`、`_` 替换为 `.`，其余字符仍按正则解释。这不是 SQL `LIKE`；用作字面量的正则元字符需要转义。

范围比较把 `null` 排在非空值之前，两个 `null` 相等；标准的有限数值按精确值比较（浮点值按其实际二进制值），而不是统一转成 `double`。内置后端拒绝 `eq(null)` 及以 `NaN`、无穷大为条件值的 `eq`。`eq(null)` 并不表示 `IS NULL`。

## 排序

使用 `orderBy(column)` 升序或 `orderByDesc(column)` 降序。只保留最后一次指定的排序列和方向。排序采用与范围条件相同的比较规则。

```java
// 按余额降序获取玩家
List<PlayerEntity> richest = playerOperator.query()
    .orderByDesc("balance")
    .list();

// 按等级升序排序
List<PlayerEntity> sorted = playerOperator.query()
    .orderBy("level")
    .list();
```

## 分页

对排序后的结果先应用 `offset(start)`（跳过的行数，默认 `0`），再应用 `limit(count)`（最多返回的行数，默认不限）。负偏移不跳过任何行，负上限表示不限，`limit(0)` 返回空结果。

```java
// 获取第 2 页，每页 10 条
int pageSize = 10;
int page = 2;
List<PlayerEntity> pageResults = playerOperator.query()
    .orderBy("id")
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .list();
```

内置后端使用默认查询实现。`list()` 把 `eq` 转成 `WhereCondition` 交给 `getAll(...)`；没有 `eq` 就调用无条件的 `getAll()`。MySQL 和 SQLite 在 SQL 中应用这些等值条件，JSON 后端自行匹配。其他条件、排序和截取在取回候选结果后由 DSL 在内存中执行。即使只取一页，也会先读取全部候选行。大表在 MySQL 或 SQLite 上可改用[数据存储](./data-storage)中的 `DataOperator.page(...)`，不要假定 JSON 的无条件分页与 SQL 相同。

## 终端操作

每个查询链必须以终端操作结束：

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `list()` | `List<T>` | 返回筛选、排序和分页后的结果 |
| `first()` | `T` | 将构建器的上限收窄为最多一行，再调用 `list()`；无结果返回 `null` |
| `exists()` | `boolean` | 无条件时检查 `getAll()` 是否非空；仅有 `eq` 时调用 `exist(...)`。这两条路径忽略分页；含其他条件时使用 `first()` |
| `count()` | `long` | 返回 `list()` 的大小，包含分页的影响，不执行 SQL `COUNT` |
| `delete()` | `int` | 按 ID 逐条删除 `list()` 选出的行；内置后端返回实际删除数 |

```java
// 检查玩家是否有家
boolean hasHomes = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .exists();

// 统计玩家的家数量
long homeCount = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .count();

// 删除特定世界的所有家
int deleted = dataOperator.query()
    .where("world").eq("old_world")
    .delete();
```

构建器有状态，独立查询请重新调用 `query()`。`delete()` 先检查所选行的 ID；若任一 ID 为 `null`，会在删除任何行之前抛出 `DataAccessException`（`ULTI-3007`）。异常原文为 `Query#delete() matched a <entity class> row with a null id, which no delete can address; nothing was deleted.`

内置后端对按 ID 找到的实体调用 `onDelete()`；其他写入方先删掉的行不计入结果。删除不会在写入时重新检查原查询条件，也不会自动为整批开启事务。第三方操作器的默认计数以删除前后的存在性检查估算。

通过 `getAll(...)` 读取时，内置后端会在 DSL 的内存处理前对每个候选实体调用 `onLoad()`，即使它最终不在结果中。仅含 `eq` 条件的 `exists()` 不走这条读取路径。

## 完整示例

下面的模块服务通过查询 DSL 查找、列出、检查和删除家。请将带 `@Table` 的 `HomeEntity` 随所属模块打包。

<<< @/../examples/src/main/java/com/ultikits/docs/query/HomeServiceImpl.java

::: tip 直接使用条件
你也可以直接把 `WhereCondition` 传给 `DataOperator`。注意，后端的比较语义不一定与 DSL 的内存比较相同。
:::
