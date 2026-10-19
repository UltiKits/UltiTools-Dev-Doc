# Transactions

::: info Atomicity guarantee since v6.3.0
Transaction support exists since UltiTools-API v6.2.0. All three storage backends became atomic in v6.3.0.
:::

Through v6.2.5, `transaction(...)` was atomic only on the JSON backend: MySQL and SQLite ran the callable with no transaction manager attached, so each write committed as it executed. Starting in v6.3.0, all three storage backends attach a real transaction manager, and the transfer pattern below is atomic everywhere.

UltiTools provides programmatic transaction support through the `DataOperator` interface. Transactions ensure that a group of operations either all succeed or all roll back on failure.

## Basic Usage

### Void Transaction

Use `transaction(Runnable)` for operations that don't return a value:

```java
DataOperator<AccountEntity> dataOperator = plugin.getDataOperator(AccountEntity.class);

dataOperator.transaction(() -> {
    AccountEntity from = dataOperator.query()
        .where("playerId").eq(fromPlayer).first();
    AccountEntity to = dataOperator.query()
        .where("playerId").eq(toPlayer).first();

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

If any operation within the transaction throws an exception, all changes are rolled back.

### Transaction with Return Value

Use `transaction(Callable<R>)` when you need to return a result:

```java
DataOperator<AccountEntity> dataOperator = plugin.getDataOperator(AccountEntity.class);

try {
    double newBalance = dataOperator.transaction(() -> {
        AccountEntity account = dataOperator.query()
            .where("playerId").eq(playerUuid).first();
        account.setBalance(account.getBalance() + depositAmount);
        dataOperator.update(account);
        return account.getBalance();
    });
    player.sendMessage("New balance: " + newBalance);
} catch (Exception e) {
    player.sendMessage("Transaction failed: " + e.getMessage());
}
```

## Batch Operations

The `DataOperator` interface provides batch methods that automatically wrap operations in a transaction:

### insertAll

Insert multiple entities atomically:

```java
List<HomeEntity> homes = new ArrayList<>();
homes.add(HomeEntity.builder().name("base").playerId(uuid).build());
homes.add(HomeEntity.builder().name("mine").playerId(uuid).build());
homes.add(HomeEntity.builder().name("farm").playerId(uuid).build());

dataOperator.insertAll(homes); // All inserted or none
```

### updateAll

Update multiple entities atomically:

```java
List<AccountEntity> accounts = dataOperator.getAll();
for (AccountEntity account : accounts) {
    account.setBalance(account.getBalance() * 1.05); // 5% interest
}

dataOperator.updateAll(accounts); // All updated or none
```

## How It Works

Transactions work transparently across all storage backends:

| Backend | Mechanism |
|---------|-----------|
| **MySQL / SQLite** | Uses JDBC transactions (`Connection.setAutoCommit(false)`, commit/rollback) |
| **JSON** | Stages writes per transaction (as of v6.3.0): they are held for the transaction, applied together at commit, discarded on rollback, and invisible to other threads until commit |

You don't need to know which backend is active — the same transaction API works for all storage types.

::: tip Batch methods are atomic too, on every backend
`insertAll` and `updateAll` wrap their work in the same transaction mechanism, including the two direct
JDBC statement paths that used to bypass it: a batch insert whose third row violates a primary key
constraint leaves zero rows on any backend, not just JSON.
:::

::: tip JSON transactions are staged, atomic and durable (as of v6.3.0)
A JSON transaction stages its writes, commits them atomically across all of a plugin's tables, and survives a crash whole. Other threads see only committed data.
:::

### JSON Transaction Behavior

As of v6.3.0, writes inside a JSON transaction are staged for that transaction, and the transaction's own reads see them. Other threads see only committed data. Commit applies the staged writes together; rollback discards them and never touches anything that was committed. What module authors may notice:

- Other threads see each commit at one instant across all of the plugin's tables: one read returns all of a commit's changes or none of them. A transaction that covers several tables of one plugin commits as one unit and stays all-or-nothing across a crash.
- The first write to a table inside a transaction locks that table against other writers until the transaction ends. A plain write outside a transaction waits for that lock too. A read in a `@Transactional` transaction at the default isolation never waits for a table lock.
- A transaction begun by `DataOperator#transaction(...)` (either overload) locks each table at its first read or write, as `REPEATABLE_READ` does, and holds the lock until it ends. Two `transaction(...)` callbacks that read and then write one table therefore run one after the other, as in 6.2.5, where each callback held its operator's lock, and a read-modify-write inside one cannot lose an update. The cost is the one 6.2.5 also had: a read inside `transaction(...)` can wait for another transaction that holds the table, at most 5 seconds (bounded as a write is, below; 6.2.5's lock waited without a bound). A `transaction(...)` that joins an active transaction (a `@Transactional` method, or an outer `transaction(...)`) keeps that transaction's isolation, as a joined scope does in Spring: inside a `@Transactional` method at the default isolation its reads take no table lock. `@Transactional` at the default isolation does not lock at the first read.
- A write, or a read that locks the table at its first read, that meets a locked table waits at most 5 seconds, or until the transaction's `timeout` deadline if that comes sooner, and then fails with a `DataAccessException` whose message starts `JSON write failed with a lock-wait timeout` (the same text for a waiting read), and the call is not applied. A wait that would complete a cycle (each of two transactions waiting for the other) fails the call that closes the cycle at once, with a message starting `JSON write failed with a deadlock`. The framework does not retry either failure.
- Either failure marks its transaction rollback-only before the exception is thrown, so catching the exception inside the transaction does not save it: the outermost commit rolls back everything the transaction wrote and throws `UnexpectedRollbackException`. The transaction keeps its table locks until it ends.
- In a `@Transactional` method at the default isolation, two transactions can both read the same value, and the second then writes a value computed from what it read before the first committed. That lost update is not prevented. Code that computes a write from a value it read uses `DataOperator#updateIf`, whose check and write run together under the table lock, or `@Transactional(isolation = Isolation.REPEATABLE_READ)` or `Isolation.SERIALIZABLE`, which lock the table at the first read, as `DataOperator#transaction(...)` does. Inside `DataOperator#transaction(...)` it cannot happen.
- `REQUIRES_NEW` and `NOT_SUPPORTED` commit independently of the outer transaction. One difference from SQLite and MySQL: such a method runs on the same thread as the caller it suspended, and table locks belong to the thread, so it does not wait for the locks its caller holds. If it writes a key its caller already staged, the outer commit's value is the one that stays.
- A commit that changed something writes one journal record and forces it to disk before it returns, so it waits for the disk on the committing thread, which is often the server's main thread. A transaction that changed nothing writes and forces nothing.
- Durability: "durable once `commit` returns" holds fully on Linux. On Windows and macOS it holds against a server crash, but a power loss or operating-system crash can lose the last whole commits. A lost commit is lost whole, never half.
- A directory that cannot be forced to disk because of a real I/O error is logged at `WARNING` (`Could not force the directory <directory> to disk ...`). A commit made while that happens is committed and survives a server crash, and it survives a power loss only once the next flush has completed.
- If a committed journal record is found damaged at start-up, that plugin's JSON data stays closed: its data operations fail with an error naming the file, until the server operator moves the file out of the journal folder. The framework never deletes, skips or applies the damaged record, and other plugins are not affected. A module that obtains its data operators while it loads, as every shipped module does, is refused at that start, so after moving the file aside, restart the server. Only a plugin that first requests its data after it has loaded runs recovery again at its next request, without a restart. Server operators find the details under [Operating JSON storage](/guide/essentials/data-storage#operating-json-storage).
- Map each `@Table` value to one entity class. Two entity classes of one plugin that declare the same `@Table` value get two separate caches and two table locks that do not exclude each other, as in 6.2.5, so their writes are not ordered against each other and the guarantees above do not hold between them.

### JSON Entity Ids

Each JSON entity is stored as `<id>.json`. An `insert` that creates a new id refuses it, inside and outside transactions and on every operating system, with a `DataAccessException` (`DATA_ENTITY_INVALID`) that names the id, if the id:

- is empty, or contains `/`, `\`, NUL or another control character (U+0000 to U+001F, U+007F);
- is `.` or `..`, or ends in a dot or a space;
- is a Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`, in any letter case), with or without an extension: `con.txt` is refused too, because the part before the first dot is checked;
- makes a file name `<id>.json` longer than 255 bytes in UTF-8;
- names a file the server's own file system cannot name. On Windows that is an id containing `<`, `>`, `:`, `"`, `|`, `?` or `*`. Linux accepts these, so UltiRemoteBag's `<player uuid>:<page>` ids keep working there.

Every rule but the last holds on every operating system; the last is the file system's own. A refused insert does not mark its transaction rollback-only. An `insert` of an id that already has an entry changes nothing and is never refused, and a file that already exists is never renamed or rewritten because of these rules: it keeps loading, and updates and deletes of its id keep working. In 6.2.5 an id with `/` or `\` was written to a sub-path and read back as a corrupt entry, and on Windows an id with `:` was accepted and then failed every flush. If a flush meets an id the file system cannot name, it fails with an error naming the table and the id and writes nothing. If a start-up recovery meets one in a journal record (a record copied from Linux to Windows, for example), it refuses that plugin's JSON data with an error naming the record, the table and the id, changes no file, and is handled like a damaged record.

Use ids made of lowercase letters, digits, `-` and `_`; a UUID string always works. Two ids that differ only in letter case name the same file on a case-insensitive file system (Windows, and macOS by default) and overwrite each other there.

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/EconomyService.java

::: tip Single-entity operations need no transaction
For simple single-entity operations, you don't need transactions. Transactions are most useful when you need to ensure multiple operations succeed or fail together.
:::

## Declarative Transactions <Badge type="tip" text="wired since v6.3.0" />

::: warning Wired for the first time in v6.3.0
Through v6.2.5, `@Transactional` was never read: no interceptor ran, so annotated methods behaved exactly like unannotated ones. v6.3.0 wires it end to end and rejects unsupportable beans at load time.
:::

The `aop` package that creates the proxies was not referenced anywhere outside itself through v6.2.5: no bean post processor was registered and `TransactionInterceptor` was never instantiated, so an annotated method took exactly the same path as an unannotated one, with no commit, no rollback, and no log line. On v6.2.5, use the programmatic form shown earlier on this page instead, or drop the annotation.

Starting in v6.3.0, `@Transactional` is wired end to end on all three storage backends: SQLite and MySQL through a per-plugin `JdbcTransactionManager`, JSON through a per-plugin `JsonTransactionManager` that stages writes (see [JSON Transaction Behavior](#json-transaction-behavior)). A bean that declares `@Transactional`, including one that merely inherits or extends a class that does, is rejected at load time if the framework cannot supply a transaction manager for it, rather than silently running untransacted.

The `@Transactional` annotation provides declarative transaction management on service methods. This approach is cleaner than programmatic transactions and integrates seamlessly with the IoC container.

### Prerequisites

The `@Transactional` annotation only works on methods within `@Service` beans, since transactions are implemented via generated subclass proxies (ByteBuddy since v6.3.0; the earlier CGLIB engine had the same subclass-proxy shape):

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PaymentService.java

### Basic Usage

Simply add `@Transactional` to a service method:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AccountService.java

The method executes within a transaction that commits on success or rolls back on exception.

### Annotation Attributes

The `@Transactional` annotation accepts several configuration options:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `propagation` | `Propagation` | `REQUIRED` | Transaction propagation behavior |
| `isolation` | `Isolation` | `DEFAULT` | Isolation level |
| `timeout` | `int` | `-1` | Timeout in seconds (-1 = no timeout) |
| `readOnly` | `boolean` | `false` | Mark transaction as read-only for optimizations |
| `rollbackFor` | `Class[]` | `{}` | Exception types that trigger rollback |
| `noRollbackFor` | `Class[]` | `{}` | Exception types that do NOT trigger rollback |

### Propagation Modes

::: warning `NESTED` removed, not merely unimplemented
`Propagation.NESTED` no longer exists as of v6.3.0, and referencing it fails to compile. `REQUIRES_NEW` and `NOT_SUPPORTED` now genuinely suspend the active transaction on every backend.
:::

Through v6.2.5 the interceptor never ran at all, so this table described intended design, not observed behavior.

`NESTED` was dropped on controllability, not impossibility. It maps cleanly to `Connection.setSavepoint()`, but savepoint behavior depends on whichever `sqlite-jdbc` version the server's own Paper build happens to ship, and that is not something this project can pin or test across.

The `propagation` attribute controls how the method behaves when called within an existing transaction. As of v6.3.0 there are exactly six values, matching Jakarta Transactions 2.0's `TxType` set:

| Mode | Behavior |
|------|----------|
| `REQUIRED` (default) | Joins the current transaction, or creates a new one if none exists |
| `REQUIRES_NEW` | Always creates a new transaction, suspending any existing one |
| `SUPPORTS` | Joins the current transaction if one exists; executes non-transactionally otherwise |
| `NOT_SUPPORTED` | Always executes without a transaction, suspending any existing one |
| `MANDATORY` | Requires an existing transaction; throws an exception if none exists |
| `NEVER` | Must not execute within a transaction; throws an exception if one exists |

Example with `REQUIRES_NEW`:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AuditService.java

::: warning A failing joined method rolls back the whole transaction (as of v6.3.0)
On SQLite, MySQL and JSON alike, a `@Transactional` method that joins an active transaction (`REQUIRED`, or `SUPPORTS` or `MANDATORY` inside one) and throws an exception its `rollbackFor`/`noRollbackFor` rules accept marks the whole transaction rollback-only, even when the caller catches the exception.
The outermost commit then rolls back every write of the transaction and throws `UnexpectedRollbackException`.
:::

An exception the rules do not accept leaves the transaction committable. A joined failure that the outer method does not catch rolls the transaction back, and the caller receives the original exception. Work whose failure the caller wants to survive goes in a `REQUIRES_NEW` method, which commits or rolls back on its own.

The same rule applies to a nested `DataOperator#transaction(...)` call. As of v6.3.0, on SQLite, MySQL and JSON alike, a nested call whose callback fails marks the whole transaction rollback-only and does not end it. The outer scope's later writes stay inside the transaction, and the outer commit rolls everything back and throws `UnexpectedRollbackException`. Before 6.3.0 on SQLite and MySQL, the inner failure ended the transaction at once, and the outer scope's later writes ran without one. To survive the failure of a piece of work, let the inner failure propagate or do that work in a `REQUIRES_NEW` method.

### Isolation Levels

The `isolation` attribute controls the isolation level for the transaction:

| Level | Prevents | Database Support |
|-------|----------|------------------|
| `DEFAULT` | Uses database default | All databases |
| `READ_UNCOMMITTED` | None (dirty reads possible) | Most databases |
| `READ_COMMITTED` | Dirty reads | Most databases |
| `REPEATABLE_READ` | Dirty reads, non-repeatable reads | Most databases |
| `SERIALIZABLE` | All consistency issues | All databases |

On the JSON backend, as of v6.3.0, `REPEATABLE_READ` and `SERIALIZABLE` lock a table at the transaction's first read of it, which gives repeatable reads at table granularity. The other levels lock a table at the first write and serve `READ_UNCOMMITTED` as `READ_COMMITTED`. A transaction begun by `DataOperator#transaction(...)` locks at the first read like `REPEATABLE_READ`, whatever the level; a `transaction(...)` that joins an active transaction keeps that transaction's isolation.

Higher isolation levels provide stronger consistency guarantees but may impact performance. Use `SERIALIZABLE` only when strict isolation is critical:

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public void criticalTransfer(String from, String to, double amount) {
    // Ensures complete isolation from concurrent transactions
}
```

### Custom Rollback Rules

::: tip `rollbackFor` adds to the default rule, not replaces it
As of v6.3.0, `rollbackFor` adds to the default rollback-on-`RuntimeException`/`Error` rule rather than replacing it.
:::

An exception matching neither `rollbackFor` nor `noRollbackFor` still falls through to the default rule, so `@Transactional(rollbackFor = BusinessException.class)` still rolls back on an unrelated exception like a `NullPointerException`. Through v6.2.5, a non-empty `rollbackFor` replaced the default rule entirely, so listing one custom type silently stopped rollback for every exception not on that list; that behavior is gone as of v6.3.0.

By default, `@Transactional` rolls back on any `RuntimeException` or `Error`. Use `rollbackFor` to trigger rollback for additional exceptions:

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
        throw new WarningException("Non-critical issue, transaction commits");
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

Mark read-only query methods with `readOnly = true` to allow the database to apply optimizations:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PlayerRepository.java

On the JSON backend, as of v6.3.0, `readOnly = true` rejects writes. The refusal does not mark the transaction rollback-only: catching it leaves the transaction committable, as a failed statement does on SQLite and MySQL.

### Timeout Configuration

::: tip Per-statement bound on JDBC, deadline check on JSON
On SQLite and MySQL, `timeout` applies `setQueryTimeout` to each JDBC statement inside the transaction, against a shared budget that shrinks as the transaction progresses. On JSON, every data operation checks the deadline first. On every backend it never interrupts non-database work.
:::

`timeout` is enforced as a JDBC `setQueryTimeout` on every statement issued inside the transaction, against a shared deadline that starts when the transaction begins. Each statement gets whatever time is left in that budget when it is prepared, floored at 1 second so an exhausted budget still fails fast. This is not a bound on the method body as a whole: non-database work inside the method, such as a slow computation or an outbound network call, is never interrupted, because plain JDBC has no mechanism to cancel work already in flight.

On SQLite and MySQL, timeout is enforced as described. On the JSON backend there is no statement to bound, so the deadline is checked instead, as of v6.3.0. Every data operation inside the transaction checks it first, and an operation started after it has passed fails with a `DataAccessException` whose message starts `JSON transaction timeout`. A wait for a table lock also ends at the deadline when that comes sooner than 5 seconds. That failure marks the transaction rollback-only before it is thrown, as Spring does when a transaction's deadline has passed, so catching it does not save the transaction: the outermost commit rolls back and throws `UnexpectedRollbackException`.

This is a difference between the backends. On SQLite and MySQL, a statement issued after the deadline still runs, with a query timeout of 1 second, and nothing is marked rollback-only.

Set a timeout (in seconds) for long-running transactions:

```java
@Transactional(timeout = 30)
public void bulkProcessing() {
    // Every statement issued while this transaction is open gets a query timeout equal to
    // whatever remains of the 30-second budget when that statement is prepared.
    List<DataEntity> all = getDataOperator().getAll();
    for (DataEntity entity : all) {
        processEntity(entity);
    }
}
```

A value of `-1` (default) means no timeout — the interceptor never calls `setTimeout` for it, on any backend.

### Important Limitations

1. **Method eligibility**: `private`, `static`, and `final` methods cannot be transactional — each is dispatched in a way the proxy cannot intercept. A package-private method is also ineligible when it is declared in a different package than the bean class. `protected` and same-package package-private methods are eligible.

2. **Self-invocation is intercepted, not bypassed**: unlike delegate-based proxy frameworks, this framework's generated proxy is a *subclass* of the bean itself, not a separate object wrapping it — so a call to `this.transactionalMethod()` from another method in the same class dispatches virtually onto the proxy's override and **is** intercepted, exactly like a call made from outside the class. There is no need to inject the service into itself or call through the container to get transaction behavior on a same-class call.

3. **Non-final classes**: The class cannot be `final` (subclass-proxy limitation). The same applies to methods — they must be overridable.

## Programmatic vs Declarative

Both approaches achieve the same result. Choose based on your use case:

### Use Programmatic Transactions (`dataOperator.transaction()`) when:
- You need fine-grained control over transaction boundaries
- The transaction spans multiple service calls
- You're working outside a `@Service` bean
- You need to handle nested transactions manually

### Use Declarative Transactions (`@Transactional`) when:
- You want cleaner, more readable service layer code
- A single method performs all the operations that must be atomic
- You want to leverage AOP for cross-cutting concerns
- You're building service classes with multiple transactional methods

Example combining both:

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/ComplexService.java
