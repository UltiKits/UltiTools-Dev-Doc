# Transactions

UltiTools-API 7.0.0 has not been released. This guide describes the 7.0 development version. See the [release notes](../release-notes/7.0.0) and [upgrade guide](./upgrading-to-7). For 6.x, see the [archived guide](/v6.4.0/guide/advanced/transactions.html).

MySQL, SQLite and JSON support both `DataOperator#transaction(...)` and `@Transactional`. A transaction covers operations that join the same plugin's transaction on the same thread. It does not cover work scheduled on another thread, another plugin's storage, or side effects such as player messages.

The examples assume a module and its registered entities. Package `@Table` classes in the module's own JAR, or declare additional eligible classes in `@UltiToolsModule(additionalEntities = {...})`. For a standalone Paper plugin, call `UltiToolsAPI.connect(this)` in `onEnable()` and use `UltiToolsAPI.getDataOperator(this, Entity.class)`. Its own JAR is also scanned for `@Table`; use `UltiToolsAPI.connect(this, Entity.class, ...)` for additional eligible classes. Neither entry point grants access to another module's data.

If the entity is not in the requesting scope and no owning module is known, lookup throws `DataAccessException` (`ULTI-3010`, `ENTITY_NOT_OWNED`): `Entity <class> is not registered to '<plugin>' -- use the owning module's exposed service or the EventBus instead.` If an owner is known, the message is `Entity <class> belongs to module '<owner>', not '<plugin>' -- use <owner>'s exposed service or the EventBus instead.`

## Basic Usage

### Void Transaction

Use `transaction(Runnable)` for operations that don't return a value:

```java
DataOperator<AccountEntity> dataOperator = plugin.getDataOperator(AccountEntity.class);

dataOperator.transaction(() -> {
    AccountEntity from = dataOperator.query()
        .where("player_id").eq(fromPlayer).first();
    AccountEntity to = dataOperator.query()
        .where("player_id").eq(toPlayer).first();

    from.setBalance(from.getBalance() - amount);
    to.setBalance(to.getBalance() + amount);

    try {
        dataOperator.update(from);
        dataOperator.update(to);
    } catch (IllegalAccessException e) {
        throw new RuntimeException(e);
    }
});
```

An exception that escapes the callback rolls back a transaction it started or marks a transaction it joined rollback-only. Catching an ordinary operation failure inside the callback is not equivalent. The example assumes two distinct, existing accounts; atomic writes alone do not prevent lost balance updates on every backend.

### Transaction with Return Value

Use `transaction(Callable<R>)` when you need to return a result:

```java
DataOperator<AccountEntity> dataOperator = plugin.getDataOperator(AccountEntity.class);

try {
    double newBalance = dataOperator.transaction(() -> {
        AccountEntity account = dataOperator.query()
            .where("player_id").eq(playerUuid).first();
        account.setBalance(account.getBalance() + depositAmount);
        dataOperator.update(account);
        return account.getBalance();
    });
    player.sendMessage("New balance: " + newBalance);
} catch (Exception e) {
    player.sendMessage("Transaction failed: " + e.getMessage());
}
```

The `Callable<R>` overload declares `throws Exception`. If the call joined an existing transaction, receiving the result does not mean the outer transaction has committed.

## Batch Operations

The `DataOperator` interface provides batch methods that automatically wrap operations in a transaction:

### insertAll

Insert multiple entities atomically:

```java
DataOperator<HomeEntity> homeOperator = plugin.getDataOperator(HomeEntity.class);
List<HomeEntity> homes = new ArrayList<>();
homes.add(HomeEntity.builder().name("base").playerId(uuid).build());
homes.add(HomeEntity.builder().name("mine").playerId(uuid).build());
homes.add(HomeEntity.builder().name("farm").playerId(uuid).build());

homeOperator.insertAll(homes);
```

JSON treats insertion of an existing id as a no-op. Atomicity does not mean every input creates a row.

### updateAll

Update multiple entities atomically:

```java
List<AccountEntity> accounts = dataOperator.getAll();
for (AccountEntity account : accounts) {
    account.setBalance(account.getBalance() * 1.05); // 5% interest
}

dataOperator.updateAll(accounts); // All updated or none
```

`updateAll(List<T>)` declares `throws IllegalAccessException`. The read above runs before the batch transaction unless the caller already has an active transaction.

## How It Works

| Backend | Mechanism |
|---------|-----------|
| MySQL / SQLite | A JDBC connection with auto-commit disabled, bound to the transaction on the current thread. Batch statements use the same transaction. |
| JSON | Writes are staged until commit. Rollback discards staged writes without changing committed data. |

A JDBC commit can throw `DataAccessException` (`ULTI-3006`, `TRANSACTION_FAILED`) with the message `Failed to commit transaction`. The connection is discarded, but the database might already have committed. Re-read the data or check a recorded operation id before retrying work that must not run twice. If rollback itself fails, the server logs the failure; the log is not proof that the writes were undone.

### JSON Transaction Behavior

A JSON transaction sees its own staged writes. Other threads see only committed data. One commit publishes its changes across the plugin's tables together; separate reads can still straddle a commit.

- The first write locks the table against other writers until the transaction ends. A transaction started by either `DataOperator#transaction(...)` overload also locks a table on its first read. A call that joins an existing transaction keeps that transaction's isolation.
- Default `@Transactional` reads do not wait for table locks. Two callers can read the same value and overwrite each other's updates. Use `updateIf` with expected values and check its result, or choose `REPEATABLE_READ` or `SERIALIZABLE` to lock each table on its first read.
- A write, including a write outside a transaction, or a locking read waits at most five seconds for a table, shortened by the transaction deadline if earlier. Timeout throws `DataAccessException` starting `JSON write failed with a lock-wait timeout`, even for reads. A wait that would create a cycle fails immediately with `JSON write failed with a deadlock`. The framework does not retry. A failed lock wait inside a transaction marks it rollback-only; locks already held stay held until it ends.
- `REQUIRES_NEW` and `NOT_SUPPORTED` on JSON do not wait for table locks held by the suspended caller on the same thread. If they write a key the outer transaction already staged, the later outer commit can overwrite the inner value. An independent JDBC transaction can still contend with locks held by its suspended caller.

A commit with staged changes writes and forces a record in `.ultitools-journal`, then atomically renames it to a committed record before publishing in memory. The next open replays committed records before serving data. A checkpoint writes the table files and clears the covered records. An empty commit writes no record. Disk I/O runs on the committing thread, so keep main-thread transactions short.

On Linux, with storage that honours flushes, a completed commit survives power loss. On Windows and macOS, a server crash is covered, but power or OS failure can lose recent whole commits. If forcing a directory fails with an I/O error after the record is committed, the server logs a `WARNING` beginning `Could not force the directory <directory> to disk`; power-loss durability is not assured until a successful checkpoint.

Back up the journal with the tables; never delete it to clear a warning. It is at `plugins/UltiTools/data/<module name>/.ultitools-journal` for a module and `<plugin data folder>/data/.ultitools-journal` for a connected standalone plugin. A damaged committed record keeps the affected plugin's JSON data closed. The error names the record; recovery does not skip it. Move it aside only if you accept losing its changes. If the module failed to load while opening its data, restart after moving the record aside. See [Operating JSON storage](/guide/essentials/data-storage#operating-json-storage).

Use one entity class per `@Table` value in a plugin. Two classes mapped to one table can have separate caches and locks; the guarantees above do not cover access through both classes.

### JSON Entity Ids

Each JSON entity is stored as `<id>.json`. An `insert` that creates a new id refuses it, inside and outside transactions and on every operating system, with a `DataAccessException` (`ULTI-3007`, `DATA_ENTITY_INVALID`) that names the id, if the id:

- is empty, or contains `/`, `\`, NUL or another control character (U+0000 to U+001F, U+007F);
- is `.` or `..`, or ends in a dot or a space;
- is a Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`, and `COM` or `LPT` followed by a superscript `¹`, `²` or `³`, in any letter case), with or without an extension: `con.txt` is refused too, because the part before the first dot is checked;
- makes a file name `<id>.json` longer than 255 bytes in UTF-8;
- names a file the server's own file system cannot name, or one its path rules read as something other than the file `<id>.json` in the table folder. On Windows that is an id containing `<`, `>`, `:`, `"`, `|`, `?` or `*`, including an id that starts with a letter and a colon, such as `c:foo` or `p:<uuid>`: Windows reads that as a drive prefix, so the file would be another id's file or lie outside the data folder. Linux file systems generally accept these characters.

Every rule but the last holds on every operating system; the last is the file system's own. A refused insert does not mark its transaction rollback-only. An `insert` of an existing id does not replace the stored entry and does not run the new-file name check. Existing files are not renamed or rewritten by that check; their ids remain readable, updatable and deletable. Deleting an existing id these rules refuse and inserting it again, also inside one transaction, counts as creating a new id and is refused: replace such an entry with `update`. If a flush meets an id the file system cannot name, it fails with an error naming the table and the id and writes nothing. If a start-up recovery meets one in a journal record (a record copied from Linux to Windows, for example), it refuses that plugin's JSON data with an error naming the record, the table and the id, changes no file, and is handled like a damaged record.

Prefer lowercase UUID strings. Do not distinguish ids by letter case alone: they can name the same file on a case-insensitive file system.

## Complete Example

This service uses `Callable` to pass the checked exception from `update` to its caller. It demonstrates grouping writes, not a complete concurrent balance system.

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.interfaces.DataOperator;

@Service
public class EconomyService {

    @Autowired
    private UltiToolsPlugin plugin;

    public void transfer(String fromUuid, String toUuid, double amount) throws Exception {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);

        if (fromUuid.equals(toUuid) || !Double.isFinite(amount) || amount <= 0) {
            throw new IllegalArgumentException("Invalid transfer");
        }
        dataOperator.transaction(() -> {
            AccountEntity from = dataOperator.query().where("player_id").eq(fromUuid).first();
            AccountEntity to = dataOperator.query().where("player_id").eq(toUuid).first();
            if (from == null || to == null || from.getBalance() < amount) {
                throw new IllegalStateException("Missing account or insufficient balance");
            }
            from.setBalance(from.getBalance() - amount);
            to.setBalance(to.getBalance() + amount);
            dataOperator.update(from);
            dataOperator.update(to);
            return null;
        });
    }
}
```

## Declarative Transactions <Badge type="tip" text="wired since v6.3.0" />

Apply `@Transactional` to a container-created bean. Both transaction forms use the same manager for the plugin's data scope: `JdbcTransactionManager` on MySQL and SQLite, `JsonTransactionManager` on JSON. The annotation is available during normal enable and use, not in the early bootstrap hook. If storage cannot supply a manager, the container rejects a bean requiring the annotation rather than running it without transactions.

### Prerequisites

Let the container instantiate the bean, for example by scanning an `@Service` or `@Component` class. It instantiates a generated Byte Buddy subclass before injecting dependencies. Call the managed instance, not an object created with `new`; registering an already constructed instance does not make it a transaction proxy.

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PaymentService.java

### Basic Usage

Simply add `@Transactional` to a service method:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AccountService.java

A new transaction attempts commit on normal return. Exceptions follow the [rollback rules](#custom-rollback-rules). The sample assumes two distinct, existing accounts. At default JSON isolation, concurrent read-modify-write needs conditional updates or read locks.

### Annotation Attributes

The `@Transactional` annotation accepts several configuration options:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `propagation` | `Propagation` | `REQUIRED` | Transaction propagation behavior |
| `isolation` | `Isolation` | `DEFAULT` | Isolation level |
| `timeout` | `int` | `-1` | Timeout in seconds; only positive values set a deadline |
| `readOnly` | `boolean` | `false` | Request JDBC read-only mode or reject writes on JSON |
| `rollbackFor` | `Class<? extends Throwable>[]` | `{}` | Exception types that trigger rollback |
| `noRollbackFor` | `Class<? extends Throwable>[]` | `{}` | Exception types that do NOT trigger rollback |

`@Transactional` can annotate a method or a class. For an intercepted method, lookup checks its own annotation, then a class-level annotation on its declaring class or that class’s superclass chain, then an annotation on an overridden superclass method. The settings do not merge. Annotating only the subclass does not extend coverage to methods inherited without an override.

### Propagation Modes

The six modes apply to the current thread and plugin. `NESTED` is not available; a nested call is not a savepoint.

| Mode | Behavior |
|------|----------|
| `REQUIRED` (default) | Joins the current transaction, or creates a new one if none exists |
| `REQUIRES_NEW` | Always creates a new transaction, suspending any existing one |
| `SUPPORTS` | Joins the current transaction if one exists; executes non-transactionally otherwise |
| `NOT_SUPPORTED` | Always executes without a transaction, suspending any existing one |
| `MANDATORY` | Requires an existing transaction; throws `IllegalStateException` if none exists |
| `NEVER` | Must not execute within a transaction; throws `IllegalStateException` if one exists |

Example with `REQUIRES_NEW`:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AuditService.java

A joined method uses the outer scope's `isolation`, `readOnly` and `timeout`, but applies its own rollback rules. If a failure matches those rules, or a nested programmatic callback throws, the transaction becomes rollback-only even if the caller catches the failure. The transaction stays active; subsequent writes remain in it. The outermost commit rolls it back and throws `UnexpectedRollbackException`.

When the same method also uses `@ExceptionCatch`, the transaction interceptor runs outside it. If the inner interceptor turns the exception into a normal return, the outer interceptor does not roll back because of that exception; a rollback-only mark already set still takes effect.

If the joined failure escapes the outer annotated method, that method's rules still apply. A rollback normally propagates the original failure. If the outer method attempts to commit a marked transaction instead, `UnexpectedRollbackException` takes precedence and carries the original failure as a suppressed exception. Use `REQUIRES_NEW` for work that needs a separate outcome, subject to the backend's locking behavior.

### Isolation Levels

For JDBC, non-default values are passed to `Connection.setTransactionIsolation`; `DEFAULT` leaves the connection's isolation unchanged. Check the driver's support and behavior before relying on a particular level.

| Level | JSON behavior |
|-------|---------------|
| `DEFAULT`, `READ_UNCOMMITTED`, `READ_COMMITTED` | Reads see committed data and the transaction's own staged changes. The first write locks the table. |
| `REPEATABLE_READ`, `SERIALIZABLE` | The first read or write locks the table until the transaction ends. Both levels use the same table-lock behavior, not database-wide SQL serializability. |

A new programmatic JSON transaction locks at first read. Joining an existing transaction does not change its isolation.

### Custom Rollback Rules

By default, `@Transactional` rolls back on `RuntimeException` or `Error`, not on checked exceptions. `rollbackFor` adds rules; unmatched exceptions still follow the default rule. Use it to include a checked exception:

```java
@Transactional(rollbackFor = BusinessException.class)
public void processOrder(Order order) throws BusinessException {
    if (!order.isValid()) {
        throw new BusinessException("Invalid order");  // Triggers rollback
    }
    // Process order...
}
```

Use `noRollbackFor` to prevent rollback for specific exceptions:

```java
@Transactional(noRollbackFor = WarningException.class)
public void importData(String source) throws WarningException {
    try {
        // Perform import...
    } catch (MinorIssueException e) {
        throw new WarningException("Non-critical issue");
    }
}
```

When an exception matches **both** `rollbackFor` and `noRollbackFor`, the rule whose listed class is
the shallower inheritance-depth match to the thrown exception wins; on an exact-depth tie — including
the same class listed in both arrays — the transaction rolls back:

```java
class OrderException extends RuntimeException { }
class ValidationException extends OrderException { }

@Transactional(rollbackFor = ValidationException.class, noRollbackFor = OrderException.class)
public void processOrder(Order order) throws ValidationException {
    if (!order.hasShippingAddress()) {
        throw new ValidationException("missing shipping address"); // rolls back:
        // ValidationException is a depth-0 match for rollbackFor, a depth-1 match for
        // noRollbackFor (one step up to OrderException) — the shallower match wins.
    }
}
```

### Read-Only Transactions

`readOnly = true` calls `Connection.setReadOnly(true)` for a new JDBC transaction. It is a driver hint, not a portable write guard. If setting it fails, the manager logs `Failed to set read-only mode`.

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PlayerRepository.java

JSON rejects a write with `DataAccessException`: `Write to JSON table '<table>' rejected: the transaction is read-only.` The refusal itself does not mark rollback-only. If it escapes an annotated method or programmatic callback, that scope's rollback rules still apply.

### Timeout Configuration

Only a positive `timeout` sets a deadline for a newly started transaction, for example `@Transactional(timeout = 30)`. The default is `-1`. Joining an existing transaction does not reset its budget. Neither backend interrupts Java code, network calls or other non-database work.

- JDBC sets `setQueryTimeout` on the framework operators' statements, including direct batch statements. Each gets the remaining whole seconds when prepared, with a minimum of one second. Even after the deadline a statement can run with a one-second query timeout; elapsed time alone does not mark rollback-only.
- JSON data operations check the deadline, which also caps table-lock waits. A deadline check that rejects an operation throws `DataAccessException` starting `JSON transaction timeout` and marks rollback-only. A failed table-lock wait uses the lock-wait diagnostic above. Merely reaching the deadline does not itself veto commit.

### Important Limitations

1. `private`, `static`, `final`, and package-private methods declared outside the bean's package cannot be intercepted. With transaction support available, an explicit annotation on an ineligible method is ignored with a warning of the form `AOP annotation ignored on <bean>: <problem> The annotation has no effect; the module still loads.` A class-level annotation also skips ineligible methods. Overridable `protected` and same-package package-private methods are eligible.
2. An eligible `this.transactionalMethod()` call on the managed subclass reaches the generated override through virtual dispatch. No self-injection is needed. A direct `super` call or a call on an object created with `new` does not enter that override.
3. If any method would otherwise be intercepted, a Java `final` or `sealed` bean fails creation. If the class restriction is the only issue reported and no method would be intercepted, the resolver warns instead. Where a subclass proxy cannot be used, open a programmatic transaction on a registered operator instead.

## Programmatic vs Declarative

Both forms can group writes atomically, but their rollback rules and default JSON read locking differ.

### Use Programmatic Transactions (`dataOperator.transaction()`) when:

- You need fine-grained control over transaction boundaries
- The transaction spans multiple service calls
- You're working outside a bean the container creates
- You want an escaping checked exception to roll back without declaring annotation rules

### Use Declarative Transactions (`@Transactional`) when:
- You want cleaner, more readable service layer code
- A single method performs all the operations that must be atomic
- You want to leverage AOP for cross-cutting concerns
- You're building service classes with multiple transactional methods

Example combining both:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/ComplexService.java
