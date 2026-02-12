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
