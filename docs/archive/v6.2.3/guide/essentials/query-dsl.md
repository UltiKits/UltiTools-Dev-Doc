# Query DSL

::: info Since v6.2.0
The fluent Query DSL is available starting from UltiTools-API v6.2.0.
:::

UltiTools provides a fluent Query DSL that lets you build data queries using a readable, chainable API. Instead of manually constructing `WhereCondition` objects, you can write expressive queries directly.

## Basic Usage

Get a `Query` builder from any `DataOperator`:

```java
DataOperator<HomeEntity> dataOperator = plugin.getDataOperator(HomeEntity.class);

// Find all homes belonging to a player
List<HomeEntity> homes = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .list();
```

## Conditions

### where / and

Use `where()` to start your first condition, and `and()` to add additional conditions:

```java
// Find a specific home by player and name
HomeEntity home = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .and("name").eq("base")
    .first();
```

### Comparison Operators

After calling `where()` or `and()`, chain one of these operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq(value)` | Equal to | `.where("name").eq("base")` |
| `ne(value)` | Not equal to | `.where("status").ne("disabled")` |
| `gt(value)` | Greater than | `.where("level").gt(10)` |
| `lt(value)` | Less than | `.where("balance").lt(1000.0)` |
| `gte(value)` | Greater than or equal | `.where("level").gte(5)` |
| `lte(value)` | Less than or equal | `.where("balance").lte(500.0)` |
| `like(pattern)` | SQL LIKE pattern | `.where("name").like("%base%")` |
| `in(collection)` | Value in collection | `.where("world").in(worldList)` |

```java
// Find players with balance between 100 and 1000
List<PlayerEntity> players = dataOperator.query()
    .where("balance").gte(100.0)
    .and("balance").lte(1000.0)
    .list();

// Find homes in specific worlds
List<String> worlds = Arrays.asList("world", "world_nether");
List<HomeEntity> homes = dataOperator.query()
    .where("world").in(worlds)
    .list();
```

## Ordering

Sort results using `orderBy()` (ascending) or `orderByDesc()` (descending):

```java
// Get players sorted by balance, highest first
List<PlayerEntity> richest = dataOperator.query()
    .orderByDesc("balance")
    .list();

// Sort by level ascending
List<PlayerEntity> sorted = dataOperator.query()
    .orderBy("level")
    .list();
```

## Pagination

Use `limit()` and `offset()` to paginate results:

```java
// Get page 2 with 10 items per page
int pageSize = 10;
int page = 2;
List<PlayerEntity> pageResults = dataOperator.query()
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .list();
```

## Terminal Operations

Every query chain must end with a terminal operation:

| Method | Return Type | Description |
|--------|-------------|-------------|
| `list()` | `List<T>` | Returns all matching results |
| `first()` | `T` (nullable) | Returns the first match, or `null` |
| `exists()` | `boolean` | Returns `true` if any match exists |
| `count()` | `long` | Counts matching results |
| `delete()` | `int` | Deletes matching results, returns count |

```java
// Check if a player has any homes
boolean hasHomes = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .exists();

// Count homes for a player
long homeCount = dataOperator.query()
    .where("playerId").eq(playerUuid)
    .count();

// Delete all homes in a specific world
int deleted = dataOperator.query()
    .where("world").eq("old_world")
    .delete();
```

## Complete Example

Here is a complete example of a service using the Query DSL:

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

::: tip Legacy API
The `WhereCondition` API still works and is not deprecated. The Query DSL is a higher-level alternative that is more readable for complex queries. You can mix both approaches freely.
:::
