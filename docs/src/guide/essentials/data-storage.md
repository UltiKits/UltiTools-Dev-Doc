# Data Storage

7.0.0 has not been released. This page describes behaviour as of v7.0.0; see the [release notes](../release-notes/7.0.0) and the [upgrade guide](../advanced/upgrading-to-7). For 6.x, see the [v6.4.0 data storage archive](/v6.4.0/guide/essentials/data-storage.html).

UltiTools provides one entity API for MySQL, SQLite and JSON. A module or external plugin defines and registers its entities, then explicitly reads and writes them through a `DataOperator<T>`. The server operator selects the backend for the whole server.

## Backend Selection

In the UltiTools `config.yml`, set `datasource.type` to `sqlite`, `json`, or `mysql` (case-sensitive; whitespace is not trimmed). The shipped config selects `sqlite`; if the key resolves to no value, the fallback is `json`. For MySQL, also set `mysql.enable` to `true`, set `mysql.host`, `mysql.port`, `mysql.username`, `mysql.password`, and `mysql.database`, and create the database beforehand. Restart after changing this configuration. Switching backends does not move existing data. The storage choice is separate from your module's own [configuration files](./config-file).

The shipped MySQL pool settings under `mysql` are `connectionTimeout` (`30000`), `keepaliveTime` (`60000`), and `maxLifetime` (`1800000`) in milliseconds, `maximumPoolSize` (`8`), and `connectionTestQuery` (`select 1`). Prepared-statement settings are `cachePrepStmts` (`true`), `prepStmtCacheSize` (`250`), and `prepStmtCacheSqlLimit` (`2048`).

| Backend | UltiTools module | External plugin |
|---|---|---|
| SQLite | `plugins/UltiTools/sqliteDB/<module name>.db` | `data.db` in the plugin's data folder |
| JSON | `plugins/UltiTools/data/<module name>/<table>/<id>.json` | `data/<table>/<id>.json` in the plugin's data folder |
| MySQL | Shared database selected by `mysql.database` | Same database; no automatic plugin prefix on the table name |

An unavailable backend falls back to JSON. This can happen when MySQL is disabled, its pool could not be created, or the configured name is unknown. The startup log `Data Storage Method: <store>` reports the actual backend. If it differs from the configured one, the server logs the following `SEVERE` messages (angle brackets stand for the actual values):

```text
Data store downgraded: datasource.type in config.yml is '<configured>', but '<actual>' is actually in use. Reason: <reason>
Player data will be read from and written to the '<store>' store. Data is not shared between backends - if this is not what you want, stop the server, fix config.yml and restart.
```

A MySQL pool creation failure also logs `MySQL connection failed: <error>`. SQLite's default busy wait is 3000 ms, measured against a monotonic clock. An upgrade from a read to a write lock can still fail immediately with `SQLITE_BUSY`. Keep transactions short and do not share a live SQLite file across servers or modify it externally.

## Create Entity Class

### BaseDataEntity

Create a class that extends `BaseDataEntity<String>`, and use the `@Table` and `@Column` annotations to mark your entity class.

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserData.java

The annotations define the mapping; the entity must also be [registered to the caller](#entity-registration).

`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@EqualsAndHashCode` are Lombok annotations, which are used to automatically generate `getter`, `setter`, `builder`, `equals`, `hashCode` methods.

`BaseDataEntity<String>` declares an `@Column("id")` field. On `insert`, a null ID is filled through `setId` with a UUID string before `onCreate()`. In SQL, `id` is the primary key and is written from `getId()`; JSON uses `getId()` to key the entry and name its file. Do not redeclare the `id` field. If you override its accessors, ensure they report the same ID on write and read.

| Method | Description |
|--------|-------------|
| `onCreate()` | Called before the entity is first persisted |
| `onUpdate()` | Called before the entity is updated |
| `onDelete()` | Called before the entity is deleted |
| `onLoad()` | Called after the entity is loaded from the data store |
| `validate()` | Returns `true` by default; built-in operators do not invoke this entity validation hook automatically. |
| `isNew()` | Returns `true` if the entity has no ID |
| `copyWithoutId()` | Makes a shallow copy and clears its ID; the concrete entity class must implement `Cloneable`. |

The built-in operators call the hooks on these paths:

| Hook | Called by |
|------|-----------|
| `onCreate()` | `insert` and `insertAll`, on each entity, before its fields are written |
| `onUpdate()` | `update(entity)`, `updateAll`, `updateCounted` and `updateIf`, on the entity passed in, before its fields are written, whether or not a row is then written |
| `onDelete()` | `delById` and the Query DSL's `delete()`, on the stored entity, before it is removed; not called when no row has the id |
| `onLoad()` | `getById`, `getAll`, `page`, and `getLike`, for each entity returned by those reads. The Query DSL can filter or slice those results after loading. |

`update(column, value, id)`, `del(conditions)`, and `exist(...)` call no entity lifecycle hooks.

### AuditableDataEntity

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

An insert sets `created_at` and `updated_at`; if a user is set on the current thread, it also sets `created_by` and `updated_by`. An entity update sets `updated_at` and, if a user is set, `updated_by`, leaving the creation time and user unchanged. UltiTools annotation commands set a player sender’s UUID on the thread executing the command and restore the previous value afterward. For other entry points, such as listeners or scheduled work, set the context yourself as shown below.

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
        .details("Player signed in")
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
if (entry != null && entry.wasModified()) {
    System.out.println("Modified " + entry.getTimeSinceUpdate().getSeconds() + " seconds ago");
}
```

::: info Null-safety
`getAge()` and `getTimeSinceUpdate()` return `null` if the entity has not been persisted (missing `createdAt` or `updatedAt`). Always check for null before calling methods on the returned `Duration`.
:::

### @Table

`@Table.value` names the MySQL or SQLite table and the JSON directory holding the entity files. Use a stable, simple name such as `my_module_user_data`, with no SQL reserved word or path separator. MySQL tables share a database, so choose a name that does not collide with another plugin's tables.

### @Column

`@Column.value` specifies the column name, which can differ from the Java field name. Use the mapped column name in queries. `@Column.type` defaults to `VARCHAR(255)` and is used in the SQL table definition; it does not control JSON types. The SQL stores map annotated fields, including inherited fields, and store non-simple values as JSON text without querying inside them. JSON files use Gson's Java field names; the operator translates mapped column names to those fields. Ordinary JSON conditions can also query nested paths. For portable queries, use simple field types and mapped column names.

## CRUD Operations

UltiTools encapsulates a semantic CRUD operation API. You only need to call the corresponding method to complete the addition, deletion, modification and query of the data.

### DataOperator

A module calls `getDataOperator(Class<T>)` on its loaded `UltiToolsPlugin` instance. This example uses `UserData` packaged with the module:

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserDataService.java

Request the operator after the framework has assigned the module's data scope, not in the module constructor. Use the operator within the owning plugin's lifetime; do not pass it from an old module instance to its replacement.

### Entity Registration {#entity-registration}

- On enable, the framework automatically registers loadable `@Table` classes packaged in the module's own JAR. If an entity your module owns is in a separate library JAR, add it with `@UltiToolsModule(additionalEntities = {UserData.class})` on the main class. The automatic scan still runs.
- An ordinary Paper plugin calls `UltiToolsAPI.connect(this)` in `JavaPlugin.onEnable()`. The framework scans the plugin's own JAR; to include an owned entity in a library JAR, use `UltiToolsAPI.connect(this, UserData.class)` instead. After connecting, call the static `UltiToolsAPI.getDataOperator(this, UserData.class)`; do not construct an `UltiToolsPlugin`. Call `UltiToolsAPI.disconnect(this)` when the plugin disables. See the [External Plugin API](../advanced/external-plugin-api).
- Neither additional-registration mechanism can claim an entity that belongs to another known plugin. Use its exposed service or the `EventBus`, not its data operator.

If the caller has a data scope but the requested class is not registered in it, the operator lookup throws `DataAccessException` with `ENTITY_NOT_OWNED` (`ULTI-3010`). `getMessage()` uses the first line if no owning module is known, and the second if the owner is known (placeholders are replaced by their values):

```text
Entity <fully-qualified class name> is not registered to '<requesting plugin>' -- use the owning module's exposed service or the EventBus instead.
Entity <fully-qualified class name> belongs to module '<owner>', not '<requesting plugin>' -- use <owner>'s exposed service or the EventBus instead.
```

Check that the class can load, has `@Table`, and is packaged or explicitly registered with the caller. A module instance without a scope also gets `ULTI-3010`, but with a different message. An external plugin that has not connected gets `IllegalStateException`: `Plugin <plugin name> is not connected to UltiTools`. See [Exception Handling](../advanced/exception-handling) for error codes and formatted messages.

### Insert

```java
UserData entity = UserData.builder()
    .playerName("test")
    .balance(42.0)
    .build();
dataOperator.insert(entity);
```

`insert` is not an upsert: a duplicate ID fails the SQL insert, whereas JSON keeps the existing entry. Use `update` to change an existing entry.

### Query

Using `WhereCondition`:

```java
List<UserData> list = dataOperator.getAll(
    WhereCondition.builder()
        .column("player_name")
        .value("test")
        .build()
);
```

Or get a single entity by ID:

```java
UserData entity = dataOperator.getById("some-id");
```

Get all entities:

```java
List<UserData> all = dataOperator.getAll();
```

Pagination:

```java
List<UserData> page = dataOperator.page(1, 10); // page 1, 10 per page
```

::: warning Unfiltered JSON pagination
JSON returns an empty list from `page(int, int)`, whereas MySQL and SQLite query with `LIMIT ? OFFSET ?`. For portable pagination, supply a real condition or slice `getAll()`; do not pass `WhereCondition.empty()` to substitute for an unfiltered page, because SQL `page` rejects it.
:::

::: tip Query DSL
Use the [fluent Query DSL](./query-dsl) to chain conditions:

```java
UserData entity = dataOperator.query()
    .where("player_name").eq("test")
    .first();
```
:::

### Update

Update a single field:

```java
dataOperator.update("player_name", "newName", entityId);
```

Update by entity object:

```java
try {
    entity.setPlayerName("newName");
    dataOperator.update(entity);
} catch (IllegalAccessException e) {
    // handle or rethrow
}
```

This overload declares `throws IllegalAccessException`, so the calling method must declare or catch it.

Entities returned by reads are detached from storage, and later changes to the object passed to `insert` do not change stored data. Write field changes back explicitly.

`update(T)`, `update(column, value, id)`, `delById`, and `updateAll` reject a null ID with `DataAccessException`. `updateAll` checks all input entities before writing.

Updating an ID that does not exist does not insert a new record. SQL logs `Update of table '<table>' matched no row with id '<id>'; nothing was written.`; JSON uses `entry` instead of `row`. Use `updateCounted(entity)` for the update count:

```java
if (dataOperator.updateCounted(entity) == 0) {
    // The row was deleted by another writer: nothing was written.
}
```

A `DataOperator` implementation outside the framework that does not override `updateCounted` is counted by whether a row with the id exists before its `update`.

### Conditional Update

`updateIf(entity, expected...)` writes only if the stored record matches every expected condition and reports whether it wrote. It writes back the whole mapped entity, not just the fields in the conditions. The example assumes the account maps only `balance` besides its ID; if it maps other mutable columns, check their previous values too to avoid overwriting concurrent changes from a stale snapshot.

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

On MySQL and SQLite the check and the write are one `UPDATE ... WHERE id = ? AND <conditions>` statement. The atomic check also holds across servers sharing a MySQL database; do not share a live SQLite file. On the JSON backend the check and the write run together under the table lock; a JSON store belongs to one server. The conditions mean what they mean in `getAll(WhereCondition...)`.

`updateIf` returns `false`, and writes nothing, when no row with the entity's id matches every condition. It throws `DataAccessException` when the id is `null`, when a condition is `null`, when a condition names a column the entity does not map with `@Column`, or when a condition's value is `null` under a comparison other than the default `EQUAL`, on every backend. A `null` expected value under the default comparison means `IS NULL` (JSON: the field is absent or JSON null), so a compare-and-set against a column that was still unset when you read it misses when another writer has filled it in the meantime; this meaning belongs to `updateIf` alone ([#640](https://github.com/UltiKits/UltiTools-Reborn/issues/640)). A `DataOperator` implementation outside the framework that does not implement it throws `UnsupportedOperationException`.

Numeric `EQUAL` on a default MySQL text column and on JSON can match neighbouring integers beyond ±9,007,199,254,740,992 (2^53). An `updateIf` precondition can therefore match a value different from the one read. Do not use such numbers as exact compare-and-set (CAS) tokens. On MySQL declare `type = "BIGINT"` for exact integral equality; on JSON the condition-evaluation map has already converted numbers to `double`, so declaring a numeric column type does not restore exact matching.

### Delete

Delete by ID:

```java
dataOperator.delById(entityId);
```

Delete by condition:

```java
dataOperator.del(
    WhereCondition.builder()
        .column("player_name")
        .value("test")
        .build()
);
```

### WhereCondition

`WhereCondition` is used to specify the query condition.

```java
WhereCondition.builder().column("somecol").value(someval).build();
```

`column` is the mapped column name and `value` is the value to compare. `comparison` defaults to `Comparison.EQUAL`. Multiple conditions are combined with AND.

#### Comparisons

`EQUAL` tests equality, and `GREATER` and `LESS` are strict comparisons.

- `INCLUDE`, `STARTSWITH` and `ENDSWITH` match the value literally as text on every backend: `%`, `_`, `!` and `\` are ordinary characters, not wildcards or escapes. SQL `getLike` uses `LIKE`; JSON `getLike` tests literal prefixes, suffixes or substrings. For `Query#like`, see the [Query DSL](./query-dsl).
- Letter case and accents follow the backend: SQLite ignores the case of ASCII letters only; MySQL compares under the `utf8mb3_general_ci` collation of the tables the framework creates, which ignores case and accents (`é` matches `e`); JSON compares exactly.
- `GREATER` and `LESS` on a `byte`, `short`, `int`, `long`, `float` or `double` field (or its wrapper) compare numbers of the field's type on SQLite and JSON. Pass the value as a number of that type (`10`, not `"10"`): on MySQL a string value compares as text, so `"10"` sorts below `"2"`. On SQLite the typed comparison holds also in a column left on the default `VARCHAR(255)` type, with 64-bit integer precision, and a stored value compares the way it reads back: a `float` `0.1f` is neither greater nor less than `0.1f`. That read-back comparison applies to a value that is a finite number; a number beyond `double` range and any text are compared as bound. An infinite or NaN value is refused (see "Null and non-finite condition values" below).
- On MySQL a numeric field left in a default text column compares in double precision, exact up to ±9,007,199,254,740,992 (2^53) and approximate beyond. Declare a numeric column `type` such as `BIGINT` where exact results matter. On JSON the values are compared as `double`, also approximate beyond 2^53.
- Known limitations: on SQLite a `double` in a default column is stored with 15 significant digits, so `1/3.0` reads back and compares as `0.333333333333333`; declare `type = "DOUBLE"` to keep every digit. Non-numeric text written by hand into a numeric field's column compares on SQLite as its leading number (`'abc'` as 0, `'12abc'` as 12), while JSON compares it as text. On SQLite a number that agrees with a stored `float` to 15 significant digits but differs after them (for example a whole number of 10^15 or more such as `(1L << 53) + 1`, or a decimal with 16 or more significant digits) compares as equal to it, in a default and in a `REAL` column; pass a `float` value for a `float` field.

#### Null and non-finite condition values

`getAll`, `exist`, `page`, `del` and `updateIf` refuse a condition whose value is `null` (under any comparison) or an infinite or NaN `Double` or `Float` on SQLite, MySQL and JSON alike: they throw `DataAccessException` with `DATA_ENTITY_INVALID` (`ULTI-3007`) before anything is read, deleted or written. The one exception is `updateIf` with a `null` value under `EQUAL`, which means `IS NULL`. `del(WhereCondition.empty())` is refused the same way on every backend ([#815](https://github.com/UltiKits/UltiTools-Reborn/issues/815), [#696](https://github.com/UltiKits/UltiTools-Reborn/issues/696)). Check a value with a null check or `Double.isFinite` before building the condition.

### Transactions

For operations that need to succeed or fail together, see the [Transactions](/guide/advanced/transactions) guide.

::: tip MySQL and SQLite run this block in one JDBC transaction
MySQL and SQLite run the callback in one JDBC transaction.
JSON stages the callback’s writes and commits them as one transaction.
:::

```java
dataOperator.transaction(() -> {
    dataOperator.insert(entity1);
    dataOperator.insert(entity2);
    // Both inserted or none
});
```

On the JSON backend, a transaction begun by `transaction(...)` locks each table at its first read or write, so a read-modify-write inside it cannot lose an update; a read inside it can wait, at most 5 seconds, for another transaction that holds the table. In a `@Transactional` method at the default isolation, read-modify-write uses `updateIf` or `isolation = REPEATABLE_READ` instead; see [JSON Transaction Behavior](/guide/advanced/transactions#json-transaction-behavior).

A transaction whose own failure path fails never ends in an implicit commit ([#634](https://github.com/UltiKits/UltiTools-Reborn/issues/634)): when its rollback or its commit fails, the connection is discarded (a HikariCP pool evicts it) instead of being switched back to auto-commit, which would commit it, and the framework never retries the commit. What is stored afterwards depends on where the failure happened:

- When the action fails and the rollback succeeds, nothing is stored.
- When a SQLite or MySQL rollback fails, including the real rollback an outer commit performs for a rollback-only transaction, the framework issues no commit.
- When the commit throws `UnexpectedRollbackException` because the transaction was marked rollback-only, the transaction was rolled back and none of its writes is stored, on every backend.
- When a SQLite or MySQL commit itself fails (`DataAccessException`, `TRANSACTION_FAILED`), the outcome is unknown: the database may have applied the commit before its acknowledgement was lost, for example on a dropped MySQL connection, and discarding the connection cannot undo that. Code that must not apply a write twice, such as a payment or a reward, re-reads the data or uses `updateIf` before trying again.
- On JSON, a commit that fails commits nothing.

The caller gets the original exception, or `UnexpectedRollbackException` for a rollback-only transaction. An `Error` thrown inside `transaction(...)` rolls the transaction back (the JSON engine discards the staged writes) and is rethrown as the same instance.

## JSON Storage Trade-offs

- On Windows and macOS, durability covers a server-process crash, not loss of the last whole commits after power loss or an OS crash. Choose storage and backups for the guarantee you need; do not infer a cross-platform power-loss guarantee from Linux behavior.
- A changed commit forces its journal synchronously on the committing thread, often the server main thread. Disk contention, including world saves, can therefore add tick latency; account for this when choosing JSON for frequent transactions.
- Windows move retries do not extend to deletion: a held file fails that flush and the next flush tries again. Check failures and remove the external lock rather than assuming the 150 ms move retry covers every file operation.
- Directly constructing an operator gives it a separate identity and a sibling `<table folder>.ultitools-journal`; a common parent folder does not group separately constructed operators into one transaction. Use framework-managed operators for one plugin's coordinated tables.
- Same-thread `REQUIRES_NEW` and `NOT_SUPPORTED` work does not wait for its suspended caller's thread-owned table locks. If both write the same key, the outer commit can replace the inner value; do not treat suspension as independent locking of that key.
- JDBC and JSON timeouts differ: an exhausted JDBC budget still permits a statement with a one-second query timeout; JSON rejects a post-deadline operation and marks rollback-only. A waiting JSON read also uses the `JSON write failed ...` lock-error prefix. Handle the failure and rollback state, not the word “write” as proof that the call was a write. See [Timeout Configuration](/guide/advanced/transactions#timeout-configuration).
- JSON keeps raw `<id>.json` names, with no versioned portable encoding or automatic migration. Windows-forbidden characters can be valid on Linux. Check existing IDs before moving data; do not delete entries to get around the restriction.
- Case-only ids collide on case-insensitive filesystems. The device-name check does not universally forbid `COM0` or `LPT0`, and support by every Windows tool/provider is not promised. Prefer UUID ids; do not assume character checks alone make arbitrary names portable.

## Operating JSON Storage

Each plugin’s JSON tables have a hidden `.ultitools-journal` folder beside them. Committed transactions are written there and forced to disk before `commit` returns; recovery replays them into the table files. For a module it is `plugins/UltiTools/data/<module name>/.ultitools-journal`; for an external plugin it is `data/.ultitools-journal` inside the plugin’s data folder. See [JSON Transaction Behavior](../advanced/transactions#json-transaction-behavior).

As of v7.0.0, periodic JSON flushes use the asynchronous scheduler and wall-clock time. `datasource.flushRate` is in seconds and defaults to `10`; `0` falls back to `10`, and a negative value starts no background flush. Normal shutdown still attempts a final checkpoint. Restart after changing this value.

- Run one server process per data folder. Two servers must never use the same `plugins` data folder at the same time.
- Back up the `.ultitools-journal` folder together with the table folders, or back up with the server stopped. A copy such as `cp dir/*` skips folders whose name starts with a dot.
- Never delete `.ultitools-journal`, not even after a crash: it holds commits that are not yet in the table files.
- After a crash, start the server once before you edit any JSON data file by hand: the start replays the journal and would overwrite the edit.
- A damaged newest journal record after a power cut usually means the disk or its controller did not honour flush requests. The plugin's JSON data stays closed until you move the named file out of the journal folder and restart the server. A module that obtains its data operators while it loads is refused at that start. Only a plugin that first requests its data after it has loaded recovers at its next request, without a restart.
- One entity file that keeps failing to move (for example, a file another program keeps locked) stops every flush of that plugin from emptying the journal: records accumulate, start-up recovery takes longer, and each failed flush is reported in the server log.
- On Windows, a journal file move that another program (an antivirus scanner, an indexer, a backup tool) briefly holds is retried for at most 150 ms before the commit fails.
- A JSON data folder whose ids contain `<`, `>`, `:`, `"`, `|`, `?` or `*` cannot be copied from Linux to Windows: Windows cannot create those files. Data whose ids differ only in letter case cannot be moved to Windows or to a default macOS volume either: the files collide. If a journal record holding such an id reaches a Windows server, start-up keeps that plugin's JSON data closed and names the record: apply it on the Linux server that wrote it, or move it out of the journal folder and lose its changes.
- New ids are checked when they are created, and existing files are never renamed; see [JSON Entity Ids](/guide/advanced/transactions#json-entity-ids). A standard UUID string is a portable id; lowercase letters, digits, `-` and `_` are safe only if the id is not a Windows device name (`con`, `nul`, `aux`, `prn`, `com1`–`com9`, `lpt1`–`lpt9`). Do not key entities by player names (`Con` and `Nul` are valid names). An existing id the rules refuse keeps working for reads, `update` and delete, but deleting it and inserting it again is refused: replace it with `update`.

## Stored Items

As of v7.0.0, `ItemStackUtils` writes Base64-encoded Paper item bytes. It still reads the legacy Bukkit object streams written by its 6.x counterpart and accepts line-wrapped Base64, but 6.x cannot read the new writes. The five public methods remain available: `serializeItems`, `deserializeItems`, `serializeItem`, `deserializeItem`, and `isValidSerialized`. The array reader preserves empty slots as `null`; the single-item reader can return `null` for either an empty slot or a failed read. Read only trusted server data. A conversion failure logs `Failed to serialize ItemStack array` or `Failed to deserialize ItemStack array` at `SEVERE` and returns `null`. Back up item strings and inventories before upgrading, and do not replace data that failed to load with an empty inventory. See [Item construction and storage](../advanced/upgrading-to-7#item-migration).
