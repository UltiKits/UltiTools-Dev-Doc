# Query DSL

This page describes the query API as of v7.0.0. See the [7.0.0 release notes](../release-notes/7.0.0) for an overview.

`DataOperator#query()` creates a fluent query builder.

## Basic Usage

In a module, get the operator with `plugin.getDataOperator(HomeEntity.class)`. The entity must be registered to that module’s data scope. In a standalone Paper plugin, use `UltiToolsAPI.getDataOperator(this, HomeEntity.class)` after a successful `UltiToolsAPI.connect(this)`. See [Entity Registration](./data-storage#entity-registration) for entity discovery, additional registration, and ownership errors.

```java
DataOperator<HomeEntity> dataOperator = plugin.getDataOperator(HomeEntity.class);

// Find all homes belonging to a player
List<HomeEntity> homes = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .list();
```

Use each fragment with an operator for its entity type. The `HomeEntity` in the [complete example](#complete-example) maps `player_id` and `name`; the fragments using `world` assume you added that mapping. `playerOperator` is a `DataOperator<PlayerEntity>` whose entity maps `balance` and `level`. Use the `@Column` name rather than the Java field name. MySQL and SQLite reject an unknown `eq` column with `DataAccessException`; `in` matches no rows if the field cannot be resolved.

## Conditions

### where / and

Use `where(column)` for the first condition and `and(column)` for subsequent ones. Both select the column for the next comparison; the comparison adds the condition. All conditions must match, and `where` does not clear earlier conditions.

```java
// Find a specific home by player and name
HomeEntity home = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .and("name").eq("base")
    .first();
```

### Comparison Operators

After calling `where()` or `and()`, chain one of these operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq(value)` | Backend `WhereCondition` with `EQUAL` | `.where("name").eq("base")` |
| `ne(value)` | Non-null field value whose Java `equals` returns `false` | `.where("name").ne("base")` |
| `gt(value)` | Greater than | `.where("level").gt(10)` |
| `lt(value)` | Less than | `.where("balance").lt(1000.0)` |
| `gte(value)` | Greater than or equal to | `.where("level").gte(5)` |
| `lte(value)` | Less than or equal to | `.where("balance").lte(500.0)` |
| `like(pattern)` | Matches the entire string representation of a non-null value (see below) | `.where("name").like("%base%")` |
| `in(collection)` | Non-null field value for which the collection’s `contains` returns `true` | `.where("world").in(worlds)` |

```java
// Find players with balance between 100 and 1000
List<PlayerEntity> players = playerOperator.query()
    .where("balance").gte(100.0)
    .and("balance").lte(1000.0)
    .list();

// Find homes in specific worlds
List<String> worlds = Arrays.asList("world", "world_nether");
List<HomeEntity> homes = dataOperator.query()
    .where("world").in(worlds)
    .list();
```

`like` uses Java regular expressions in memory with the `(?i)` flag. It replaces `%` with `.*` and `_` with `.`, leaving other characters to be interpreted as regex syntax. This is not SQL `LIKE`; escape regex metacharacters that should be literal.

Range comparisons treat `null` as lower than non-null values and two nulls as equal. Standard finite numbers are compared at their exact values (the actual binary value for floating point), rather than all being converted to `double`. The built-in backends reject `eq(null)` and `eq` with a NaN or infinite condition value. `eq(null)` does not mean `IS NULL`.

## Ordering

Use `orderBy(column)` for ascending order or `orderByDesc(column)` for descending order. Only the last ordering call takes effect. Sorting uses the same comparison rules as range filters.

```java
// Get players sorted by balance, highest first
List<PlayerEntity> richest = playerOperator.query()
    .orderByDesc("balance")
    .list();

// Sort by level ascending
List<PlayerEntity> sorted = playerOperator.query()
    .orderBy("level")
    .list();
```

## Pagination

After sorting, `offset(start)` skips rows (default `0`), then `limit(count)` caps what remains (unlimited by default). A negative offset skips nothing, a negative limit is unlimited, and `limit(0)` returns no rows.

```java
// Get page 2 with 10 items per page
int pageSize = 10;
int page = 2;
List<PlayerEntity> pageResults = playerOperator.query()
    .orderBy("id")
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .list();
```

The built-in backends use the default query implementation. `list()` passes `eq` conditions to `getAll(...)` as `WhereCondition` objects, or calls unfiltered `getAll()` if there are none. MySQL and SQLite apply those equality conditions in SQL; the JSON backend matches them itself. The DSL applies other filters, sorting, and slicing in memory after reading the candidates. Even a single page loads all candidates first. For large tables on MySQL or SQLite, consider `DataOperator.page(...)` in [Data Storage](./data-storage); do not assume unfiltered JSON pagination behaves like SQL.

## Terminal Operations

Every query chain must end with a terminal operation:

| Method | Return Type | Description |
|--------|-------------|-------------|
| `list()` | `List<T>` | Returns the filtered, sorted, and sliced results |
| `first()` | `T` | Narrows the builder’s limit to at most one row, then calls `list()`; returns `null` if empty |
| `exists()` | `boolean` | Tests `getAll()` for emptiness with no filters, or calls `exist(...)` with only `eq` filters. Both paths ignore pagination. Other filters use `first()` |
| `count()` | `long` | Returns the size of `list()`, including pagination; does not issue SQL `COUNT` |
| `delete()` | `int` | Deletes the rows selected by `list()` individually by ID; built-in backends return the actual number removed |

```java
// Check if a player has any homes
boolean hasHomes = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .exists();

// Count homes for a player
long homeCount = dataOperator.query()
    .where("player_id").eq(playerUuid)
    .count();

// Delete all homes in a specific world
int deleted = dataOperator.query()
    .where("world").eq("old_world")
    .delete();
```

The builder is stateful; call `query()` again for an independent query. `delete()` checks all selected IDs first and throws `DataAccessException` (`ULTI-3007`) before deleting anything if any ID is `null`. The exception message is `Query#delete() matched a <entity class> row with a null id, which no delete can address; nothing was deleted.`

Built-in backends call `onDelete()` on an entity found by ID; a row already removed by another writer is not counted. Deletion does not recheck the original filters at write time or start a transaction for the batch. With a third-party operator using the default fallback, the count is estimated by checking existence before and after deletion.

When the DSL reads through `getAll(...)`, the built-in backends call `onLoad()` for every candidate before in-memory processing, even if it does not appear in the final result. The `exists()` path for equality-only filters skips that read.

## Complete Example

This module service uses the DSL to find, list, check, and delete homes. Package the `@Table`-annotated `HomeEntity` in the owning module’s JAR.

<<< @/../examples/src/main/java/com/ultikits/docs/query/HomeServiceImpl.java

::: tip Direct conditions
You can also pass `WhereCondition` directly to `DataOperator`. Backend comparisons do not necessarily behave like the DSL’s in-memory comparisons.
:::
