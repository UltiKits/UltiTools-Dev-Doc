# Data Storage

UltiTools encapsulates a data storage API that supports MySQL database, SQLite database (since 6.1.0), and JSON file storage.
Data storage is transparent to developers, and UltiTools will determine which storage method
to use based on the server owner's configuration.

All you need is an entity class. CRUD operations will be done automatically by UltiTools.

::: warning Try not to nest objects
Since the API is still under development, there may be problems when dealing with complex objects, so try not to nest objects.
:::

## Create Entity Class

### AbstractDataEntity

Create a class that inherits the `AbstractDataEntity` class, and use the `@Table` and `@Column` annotations to mark your entity class.

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("some_table")
public class SomeEntity extends AbstractDataEntity {
    @Column("name")
    private String name;
    @Column(value = "something", type = "FLOAT")
    private double something;
}
```

`@Table` is used to mark the data set corresponding to the class, and `@Column` is used to mark the field corresponding to the field of the data set of the class.

`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@EqualsAndHashCode` are Lombok annotations, which are used to automatically generate `getter`, `setter`, `builder`, `equals`, `hashCode` methods.

### BaseDataEntity <Badge type="tip" text="v6.2.0+" />

Starting from v6.2.0, you can also use `BaseDataEntity` which provides a type-safe generic ID and lifecycle hooks:

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("some_table")
public class SomeEntity extends BaseDataEntity<Integer> {
    @Column("name")
    private String name;
    @Column(value = "something", type = "FLOAT")
    private double something;

    @Override
    public void onCreate() {
        // Called before first insert
    }

    @Override
    public boolean validate() {
        return name != null && !name.isEmpty();
    }
}
```

`BaseDataEntity<ID>` extends `AbstractDataEntity` and adds:

| Method | Description |
|--------|-------------|
| `onCreate()` | Called before the entity is first persisted |
| `onUpdate()` | Called before the entity is updated |
| `onDelete()` | Called before the entity is deleted |
| `onLoad()` | Called after the entity is loaded from the data store |
| `validate()` | Returns `true` if the entity is valid |
| `isNew()` | Returns `true` if the entity has no ID |
| `copyWithoutId()` | Creates a copy of the entity without the ID |

### AuditableDataEntity <Badge type="tip" text="v6.2.0+" />

For entities that require audit tracking of creation and modification, use `AuditableDataEntity`:

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("audit_log")
public class AuditEntry extends AuditableDataEntity<Integer> {
    @Column("action")
    private String action;
    @Column("details")
    private String details;
}
```

`AuditableDataEntity<ID>` extends `BaseDataEntity<ID>` and automatically manages:

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | `LocalDateTime` | Entity creation timestamp (auto-set in `onCreate()`) |
| `updatedAt` | `LocalDateTime` | Last modification timestamp (updated in `onUpdate()`) |
| `createdBy` | `UUID` | User ID who created the entity (from thread-local context) |
| `updatedBy` | `UUID` | User ID who last modified the entity (from thread-local context) |

All four fields are pre-configured with `@Column` annotations and do not need to be declared in subclasses.

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
AuditEntry entry = op.getById(1);
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

`@Column` annotation has three attributes, `value` attribute is used to specify the column of the data set corresponding to the field, `type` attribute is used to specify the type of the column of the data set corresponding to the field.

The default value of the `type` attribute is `VARCHAR(255)`.

Available types can be found in [MySQL Data Types](https://www.w3schools.com/mysql/mysql_datatypes.asp).

## CRUD Operations

UltiTools encapsulates a semantic CRUD operation API. You only need to call the corresponding method to complete the addition, deletion, modification and query of the data.

### DataOperator

`DataOperator` is used for data operations.

In the main class that inherits `UltiToolsPlugin`, there is a `getDataOperator` method to get the data operator.

You need to get the instance of the module main class, and then call the `getDataOperator` method.

```java
DataOperator<SomeEntity> dataOperator =
        SomePlugin.getInstance().getDataOperator(SomeEntity.class);
```

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
SomeEntity entity = dataOperator.getById(1);
```

Get all entities:

```java
List<SomeEntity> all = dataOperator.getAll();
```

Pagination:

```java
List<SomeEntity> page = dataOperator.page(1, 10); // page 1, 10 per page
```

::: tip Query DSL
Starting from v6.2.0, you can use the [fluent Query DSL](/en/guide/essentials/query-dsl) for more readable queries:

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
entity.setName("newName");
dataOperator.update(entity);
```

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

For operations that need to succeed or fail together, see the [Transactions](/en/guide/advanced/transactions) guide.

```java
dataOperator.transaction(() -> {
    dataOperator.insert(entity1);
    dataOperator.insert(entity2);
    // Both inserted or none
});
```
