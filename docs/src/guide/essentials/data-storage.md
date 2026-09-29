# Data Storage

UltiTools encapsulates a data storage API that supports MySQL database, SQLite database (since 6.1.0), and JSON file storage.
Data storage is transparent to developers, and UltiTools will determine which storage method
to use based on the server owner's configuration.

All you need is an entity class. CRUD operations will be done automatically by UltiTools.

::: warning Try not to nest objects
Since the API is still under development, there may be problems when dealing with complex objects, so try not to nest objects.
:::

## Create Entity Class

### BaseDataEntity

Create a class that extends `BaseDataEntity<String>`, and use the `@Table` and `@Column` annotations to mark your entity class.

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserData.java

`@Table` is used to mark the data set corresponding to the class, and `@Column` is used to mark the field corresponding to the field of the data set of the class.

`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@EqualsAndHashCode` are Lombok annotations, which are used to automatically generate `getter`, `setter`, `builder`, `equals`, `hashCode` methods.

::: warning Migration from AbstractDataEntity
Starting from v6.2.0, `DataOperator`, `Query`, and `UltiToolsPlugin.getDataOperator()` require entities to extend `BaseDataEntity<String>` instead of `AbstractDataEntity`. If your entity still extends `AbstractDataEntity`, change it to `BaseDataEntity<String>`.
:::

`BaseDataEntity<String>` provides lifecycle hooks for insert/update/delete/load events:

| Method | Description |
|--------|-------------|
| `onCreate()` | Called before the entity is first persisted |
| `onUpdate()` | Called before the entity is updated |
| `onDelete()` | Called before the entity is deleted |
| `onLoad()` | Called after the entity is loaded from the data store |
| `validate()` | Returns `true` if the entity is valid |
| `isNew()` | Returns `true` if the entity has no ID |
| `copyWithoutId()` | Creates a copy of the entity without the ID. The entity class must implement `Cloneable`. |

::: warning Lifecycle hooks are invoked by your code, not by the operator
`onCreate()`, `onUpdate()`, `onDelete()` and `onLoad()` are declared on `BaseDataEntity`, but no read or write path in the JSON, MySQL or SQLite operators calls them, so an entity that overrides them stores exactly the same data as one that does not.
Call the hook yourself around the operation, `entity.onCreate(); op.insert(entity);` before a write and `entity.onLoad();` on what a read returns: all four methods are public.
Having the operators invoke the hooks is tracked in [issue #194](https://github.com/UltiKits/UltiTools-Reborn/issues/194).
:::

### AuditableDataEntity <Badge type="tip" text="v6.2.0+" />

For entities that require audit tracking of creation and modification, use `AuditableDataEntity`:

<<< @/../examples/src/main/java/com/ultikits/docs/data/AuditEntry.java

`AuditableDataEntity<String>` extends `BaseDataEntity<String>` and automatically manages:

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | `LocalDateTime` | Entity creation timestamp (auto-set in `onCreate()`) |
| `updatedAt` | `LocalDateTime` | Last modification timestamp (updated in `onUpdate()`) |
| `createdBy` | `UUID` | User ID who created the entity (from thread-local context) |
| `updatedBy` | `UUID` | User ID who last modified the entity (from thread-local context) |

All four fields are pre-configured with `@Column` annotations and do not need to be declared in subclasses.

::: warning The four audit columns stay NULL after an insert
Because the operators do not call the lifecycle hooks, `onCreate()` and `onUpdate()` never run, so `created_at`, `updated_at`, `created_by` and `updated_by` are never written, `wasModified()` always returns `false`, and `getAge()` and `getTimeSinceUpdate()` always return `null`.
Set the thread context with `AuditableDataEntity.setCurrentUser(uuid)`, call `entity.onCreate()` or `entity.onUpdate()` before the write, and clear the context in a `finally` block: without the context the two `by` fields stay null even when the hook runs.
Having the operators invoke the hooks is tracked in [issue #194](https://github.com/UltiKits/UltiTools-Reborn/issues/194).
:::

#### User Context Management

To track which user performed operations, set the current user before database operations:

```java
import com.ultikits.ultitools.abstracts.data.AuditableDataEntity;

UUID currentUserId = player.getUniqueId();
AuditableDataEntity.setCurrentUser(currentUserId);

try {
    DataOperator<AuditEntry> op = plugin.getDataOperator(AuditEntry.class);
    AuditEntry entry = AuditEntry.builder()
        .action("login")
        .details("Player logged in from 192.168.1.1")
        .build();
    op.insert(entry);  // createdBy and updatedBy automatically set
} finally {
    AuditableDataEntity.clearCurrentUser();
}
```

::: warning Always clear the context
Use a try-finally block to ensure `clearCurrentUser()` is called, otherwise the ThreadLocal context persists across requests and may leak user identity.
:::

#### Utility Methods

`AuditableDataEntity` provides convenience methods for time-based queries:

| Method | Returns | Description |
|--------|---------|-------------|
| `getAge()` | `Duration` or `null` | Time elapsed since entity creation |
| `getTimeSinceUpdate()` | `Duration` or `null` | Time elapsed since last modification |
| `wasModified()` | `boolean` | Whether entity was modified after creation |

Example usage:

```java
AuditEntry entry = op.getById("some-id");
if (entry.wasModified()) {
    System.out.println("Modified " + entry.getTimeSinceUpdate().getSeconds() + " seconds ago");
}
```

::: info Null-safety
`getAge()` and `getTimeSinceUpdate()` return `null` if the entity has not been persisted (missing `createdAt` or `updatedAt`). Always check for null before calling methods on the returned `Duration`.
:::

### @Table

`@Table` annotation has a `value` attribute, which is used to specify the name of the data set corresponding to the class.

### @Column

`@Column` annotation has two attributes, `value` attribute is used to specify the column of the data set corresponding to the field, `type` attribute is used to specify the type of the column of the data set corresponding to the field.

The default value of the `type` attribute is `VARCHAR(255)`.

Available types can be found in [MySQL Data Types](https://www.w3schools.com/mysql/mysql_datatypes.asp).

## CRUD Operations

UltiTools encapsulates a semantic CRUD operation API. You only need to call the corresponding method to complete the addition, deletion, modification and query of the data.

### DataOperator

`DataOperator` is used for data operations.

In the main class that inherits `UltiToolsPlugin`, there is a `getDataOperator` method to get the data operator.

You need to get the instance of the module main class, and then call the `getDataOperator` method.

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserDataService.java

::: warning
`DataOperator` is not thread-safe. Please get `DataOperator` when you need it, and do not try to save `DataOperator` object.
:::

### Insert

```java
SomeEntity entity = SomeEntity.builder()
    .name("test")
    .something(42.0)
    .build();
dataOperator.insert(entity);
```

### Query

Using `WhereCondition`:

```java
List<SomeEntity> list = dataOperator.getAll(
    WhereCondition.builder()
        .column("name")
        .value("test")
        .build()
);
```

Or get a single entity by ID:

```java
SomeEntity entity = dataOperator.getById("some-id");
```

Get all entities:

```java
List<SomeEntity> all = dataOperator.getAll();
```

Pagination:

```java
List<SomeEntity> page = dataOperator.page(1, 10); // page 1, 10 per page
```

::: warning page() returns an empty list on the JSON backend
On the JSON backend `page(int, int)` forwards to `getAll(WhereCondition...)`, whose zero-length branch returns an empty list, while the same call on MySQL or SQLite builds a plain `LIMIT ? OFFSET ?` and returns the rows, so one module gives two different results depending on the configured backend.
Take `getAll()` and slice the result with `subList` when you need a page that behaves the same on every backend: `page(1, 10, WhereCondition.empty())` is not a substitute, because the relational operators do not filter empty conditions and would emit `WHERE null = ?`.
Aligning `page` and `exist` with `getAll` on empty conditions is tracked in [issue #193](https://github.com/UltiKits/UltiTools-Reborn/issues/193).
:::

::: tip Query DSL
Starting from v6.2.0, you can use the [fluent Query DSL](/guide/essentials/query-dsl) for more readable queries:

```java
SomeEntity entity = dataOperator.query()
    .where("name").eq("test")
    .first();
```
:::

### Update

Update a single field:

```java
dataOperator.update("name", "newName", entityId);
```

Update by entity object:

```java
try {
    entity.setName("newName");
    dataOperator.update(entity);
} catch (IllegalAccessException e) {
    // handle or rethrow
}
```

This overload declares `throws IllegalAccessException`, so the calling method must declare or catch it.

As of v6.3.0, every entity a read returns (`getById`, `getAll`, `page`, `getLike` and the Query DSL) is a copy, and `insert` stores a copy of the entity you pass. Changing an entity has no effect on the stored data until you pass it to `update(...)`, on every backend. Before v6.3.0 the JSON backend returned the instances it kept in memory, so there a change without `update(...)` was saved at the next flush, while MySQL and SQLite never saved it.

As of v6.3.0, `update(T)`, `update(column, value, id)`, `delById` and `updateAll` throw `DataAccessException` when the id is `null`, because no row can be addressed by it; `updateAll` checks every entity before it writes any. Rows that UltiTools-API 6.2.0 stored on SQLite without an id are given one when the table is initialised: the id the entity reports through `getId()`, or a new UUID when it reports none, as long as the entity then reports that id. One console line names the table and the count; a row that no id would make addressable is left as it is and counted in a warning. Every write stores `getId()` in the `id` column, so an entity that overrides `getId()` onto another field is addressable by the value it reports.

As of v6.3.0, an update by an id that no row has writes nothing and logs one warning naming the table and the id, on every backend, and returns normally. To learn whether the update wrote, call `updateCounted(entity)`, which returns `1` for a written row and `0` when no row has the id:

```java
if (dataOperator.updateCounted(entity) == 0) {
    // The row was deleted by another writer: nothing was written.
}
```

A `DataOperator` implementation outside the framework that does not override `updateCounted` is counted by whether a row with the id exists before its `update`.

### Conditional Update <Badge type="tip" text="v6.3.0+" />

`updateIf(entity, expected...)` writes the entity only while the stored row still matches every expected condition, and returns whether it wrote. Use it to update a value you read earlier without overwriting a change another writer made in between:

```java
Account read = dataOperator.getById(accountId);
double seen = read.getBalance();
read.setBalance(seen + amount);
boolean written = dataOperator.updateIf(read,
    WhereCondition.builder().column("balance").value(seen).build());
if (!written) {
    // Another writer changed the row first: read it again and decide again.
}
```

On MySQL and SQLite the check and the write are one `UPDATE ... WHERE id = ? AND <conditions>` statement, so the result holds across servers that share one database. On the JSON backend the check and the write run under the operator's lock; a JSON store belongs to one server. The conditions mean what they mean in `getAll(WhereCondition...)`.

`updateIf` returns `false`, and writes nothing, when no row with the entity's id matches every condition. It throws `DataAccessException` when the id is `null`, when a condition names a column the entity does not map with `@Column`, or when a condition's value is `null`, on every backend. A `DataOperator` implementation outside the framework that does not implement it throws `UnsupportedOperationException`.

### Delete

Delete by ID:

```java
dataOperator.delById(entityId);
```

Delete by condition:

```java
dataOperator.del(
    WhereCondition.builder()
        .column("name")
        .value("test")
        .build()
);
```

### WhereCondition

`WhereCondition` is used to specify the query condition.

```java
WhereCondition.builder().column("somecol").value(someval).build();
```

`column` is used to specify the column to be queried, and `value` is used to specify the value to be queried.

### Transactions <Badge type="tip" text="v6.2.0+" />

For operations that need to succeed or fail together, see the [Transactions](/guide/advanced/transactions) guide.

::: warning Only the JSON backend rolls this block back
The MySQL and SQLite operators are constructed without a transaction manager, and `transaction(...)` runs the callable directly when none is set, so the connection stays in autocommit and each `insert` below is committed on its own.
Use the JSON backend when this block has to be atomic, or take your own JDBC connection, turn off autocommit and commit or roll back yourself: the Transactions guide describes both.
Wiring the transaction manager into the relational operators is tracked in [issue #307](https://github.com/UltiKits/UltiTools-Reborn/issues/307).
:::

```java
dataOperator.transaction(() -> {
    dataOperator.insert(entity1);
    dataOperator.insert(entity2);
    // Both inserted or none
});
```
