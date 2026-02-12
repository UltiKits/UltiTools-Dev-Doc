# 事务

::: info 自 v6.2.0 起
事务支持自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 通过 `DataOperator` 接口提供编程式事务支持。事务确保一组操作要么全部成功，要么在失败时全部回滚。

## 基本用法

### 无返回值事务

使用 `transaction(Runnable)` 执行不需要返回值的操作：

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

如果事务内的任何操作抛出异常，所有更改都会被回滚。

### 带返回值事务

需要返回结果时使用 `transaction(Callable<R>)`：

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
    player.sendMessage("新余额: " + newBalance);
} catch (Exception e) {
    player.sendMessage("事务失败: " + e.getMessage());
}
```

## 批量操作

`DataOperator` 接口提供了自动包装在事务中的批量方法：

### insertAll

原子性批量插入多个实体：

```java
List<HomeEntity> homes = new ArrayList<>();
homes.add(HomeEntity.builder().name("base").playerId(uuid).build());
homes.add(HomeEntity.builder().name("mine").playerId(uuid).build());
homes.add(HomeEntity.builder().name("farm").playerId(uuid).build());

dataOperator.insertAll(homes); // 全部插入或全部不插入
```

### updateAll

原子性批量更新多个实体：

```java
List<AccountEntity> accounts = dataOperator.getAll();
for (AccountEntity account : accounts) {
    account.setBalance(account.getBalance() * 1.05); // 5% 利息
}

dataOperator.updateAll(accounts); // 全部更新或全部不更新
```

## 工作原理

事务在所有存储后端上透明运行：

| 后端 | 机制 |
|------|------|
| **MySQL / SQLite** | 使用 JDBC 事务（`Connection.setAutoCommit(false)`，提交/回滚） |
| **JSON** | 使用快照回滚（操作前复制数据，失败时恢复） |

你不需要知道当前使用的是哪个后端——相同的事务 API 适用于所有存储类型。

## 完整示例

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
                    throw new RuntimeException("账户不存在");
                }
                if (from.getBalance() < amount) {
                    throw new RuntimeException("余额不足");
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
            // 事务自动回滚
            return false;
        }
    }
}
```

::: tip
对于简单的单实体操作，你不需要事务。事务在需要确保多个操作同时成功或同时失败时最为有用。
:::
