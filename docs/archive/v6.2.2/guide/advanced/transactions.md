# Transactions

::: info Since v6.2.0
Transaction support is available starting from UltiTools-API v6.2.0.
:::

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
| **JSON** | Uses snapshot-based rollback (copies data before changes, restores on failure) |

You don't need to know which backend is active — the same transaction API works for all storage types.

## Complete Example

```java
@Service
public class EconomyService {

    @Autowired
    private UltiToolsPlugin plugin;

    public boolean transfer(String fromUuid, String toUuid, double amount) {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);

        try {
            dataOperator.transaction(() -> {
                AccountEntity from = dataOperator.query()
                    .where("playerId").eq(fromUuid).first();
                AccountEntity to = dataOperator.query()
                    .where("playerId").eq(toUuid).first();

                if (from == null || to == null) {
                    throw new RuntimeException("Account not found");
                }
                if (from.getBalance() < amount) {
                    throw new RuntimeException("Insufficient balance");
                }

                from.setBalance(from.getBalance() - amount);
                to.setBalance(to.getBalance() + amount);

                try {
                    dataOperator.update(from);
                    dataOperator.update(to);
                } catch (IllegalAccessException e) {
                    throw new RuntimeException(e);
                }
            });
            return true;
        } catch (Exception e) {
            // Transaction rolled back automatically
            return false;
        }
    }
}
```

::: tip
For simple single-entity operations, you don't need transactions. Transactions are most useful when you need to ensure multiple operations succeed or fail together.
:::

## Declarative Transactions <Badge type="tip" text="v6.2.0+" />

The `@Transactional` annotation provides declarative transaction management on service methods. This approach is cleaner than programmatic transactions and integrates seamlessly with the IoC container.

### Prerequisites

The `@Transactional` annotation only works on methods within `@Service` beans, since transactions are implemented via CGLIB proxies:

```java
@Service
public class PaymentService {
    @Transactional
    public void processPayment(String playerId, double amount) {
        // This method will be wrapped in a transaction automatically
    }
}
```

### Basic Usage

Simply add `@Transactional` to a service method:

```java
@Service
public class AccountService {

    @Autowired
    private UltiToolsPlugin plugin;

    @Transactional
    public void transfer(String fromPlayerId, String toPlayerId, double amount) {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);

        AccountEntity from = dataOperator.query()
            .where("playerId").eq(fromPlayerId).first();
        AccountEntity to = dataOperator.query()
            .where("playerId").eq(toPlayerId).first();

        from.setBalance(from.getBalance() - amount);
        to.setBalance(to.getBalance() + amount);

        try {
            dataOperator.update(from);
            dataOperator.update(to);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }
}
```

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

The `propagation` attribute controls how the method behaves when called within an existing transaction:

| Mode | Behavior |
|------|----------|
| `REQUIRED` (default) | Joins the current transaction, or creates a new one if none exists |
| `REQUIRES_NEW` | Always creates a new transaction, suspending any existing one |
| `SUPPORTS` | Joins the current transaction if one exists; executes non-transactionally otherwise |
| `NOT_SUPPORTED` | Always executes without a transaction, suspending any existing one |
| `MANDATORY` | Requires an existing transaction; throws an exception if none exists |
| `NEVER` | Must not execute within a transaction; throws an exception if one exists |
| `NESTED` | Executes within a nested transaction (savepoint) if one exists; creates a new transaction otherwise |

Example with `REQUIRES_NEW`:

```java
@Service
public class AuditService {

    @Autowired
    private UltiToolsPlugin plugin;

    // This method always gets its own transaction, even if called from another transactional method
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAudit(String message) {
        DataOperator<AuditLogEntity> dataOperator =
            plugin.getDataOperator(AuditLogEntity.class);
        AuditLogEntity log = AuditLogEntity.builder()
            .message(message)
            .timestamp(System.currentTimeMillis())
            .build();
        dataOperator.insert(log);
    }
}
```

### Isolation Levels

The `isolation` attribute controls the isolation level for the transaction:

| Level | Prevents | Database Support |
|-------|----------|------------------|
| `DEFAULT` | Uses database default | All databases |
| `READ_UNCOMMITTED` | None (dirty reads possible) | Most databases |
| `READ_COMMITTED` | Dirty reads | Most databases |
| `REPEATABLE_READ` | Dirty reads, non-repeatable reads | Most databases |
| `SERIALIZABLE` | All consistency issues | All databases |

Higher isolation levels provide stronger consistency guarantees but may impact performance. Use `SERIALIZABLE` only when strict isolation is critical:

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public void criticalTransfer(String from, String to, double amount) {
    // Ensures complete isolation from concurrent transactions
}
```

### Custom Rollback Rules

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

### Read-Only Transactions

Mark read-only query methods with `readOnly = true` to allow the database to apply optimizations:

```java
@Service
public class PlayerRepository {

    @Autowired
    private UltiToolsPlugin plugin;

    @Transactional(readOnly = true)
    public List<PlayerEntity> getAllPlayers() {
        return plugin.getDataOperator(PlayerEntity.class).getAll();
    }

    @Transactional(readOnly = true)
    public PlayerEntity getPlayerById(UUID uuid) {
        return plugin.getDataOperator(PlayerEntity.class).query()
            .where("uuid").eq(uuid.toString()).first();
    }
}
```

### Timeout Configuration

Set a timeout (in seconds) for long-running transactions:

```java
@Transactional(timeout = 30)
public void bulkProcessing() {
    // If execution exceeds 30 seconds, the transaction is rolled back
    List<DataEntity> all = getDataOperator().getAll();
    for (DataEntity entity : all) {
        processEntity(entity);
    }
}
```

A value of `-1` (default) means no timeout.

### Important Limitations

1. **Proxy-based AOP**: The annotation only works on public methods of `@Service` beans. The method must be called through the proxy, not directly via `this`.

2. **Self-invocation bypass**: Calling a `@Transactional` method from another method in the same class bypasses the proxy:

```java
@Service
public class BadExample {

    @Transactional
    public void transactionalMethod() { }

    public void callingMethod() {
        // WRONG: This bypasses the proxy, transaction NOT applied
        this.transactionalMethod();
    }
}
```

To fix, inject the service or call via the container:

```java
@Service
public class GoodExample {

    @Autowired
    private BadExample service;  // Inject yourself for external calls

    public void callingMethod() {
        // CORRECT: This goes through the proxy, transaction IS applied
        service.transactionalMethod();
    }

    @Transactional
    public void transactionalMethod() { }
}
```

3. **Non-final classes**: The class cannot be `final` (CGLIB limitation). The same applies to methods — they must be overridable.

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

```java
@Service
public class ComplexService {

    @Autowired
    private UltiToolsPlugin plugin;

    // Declarative for simple method-level transactions
    @Transactional
    public void simpleOperation() {
        // Automatic transaction management
    }

    // Programmatic for complex multi-step workflows
    public void complexWorkflow() {
        DataOperator<Entity> dataOp = plugin.getDataOperator(Entity.class);

        // Explicit transaction with fine-grained control
        dataOp.transaction(() -> {
            // Multiple coordinated operations
            step1();
            step2();
            step3();
        });
    }
}
