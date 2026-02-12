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

## 声明式事务 <Badge type="tip" text="v6.2.0+" />

`@Transactional` 注解提供了声明式事务管理，可以在服务方法上使用。相比编程式事务，这种方式代码更简洁，并且与 IoC 容器深度集成。

### 前置条件

`@Transactional` 注解仅适用于 `@Service` Bean 中的方法，因为事务通过 CGLIB 代理实现：

```java
@Service
public class PaymentService {
    @Transactional
    public void processPayment(String playerId, double amount) {
        // 此方法将自动被包装在一个事务中
    }
}
```

### 基本用法

直接在服务方法上添加 `@Transactional` 注解：

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

方法成功完成时事务提交，抛出异常时自动回滚。

### 注解属性

`@Transactional` 注解接受多个配置选项：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `propagation` | `Propagation` | `REQUIRED` | 事务传播行为 |
| `isolation` | `Isolation` | `DEFAULT` | 隔离级别 |
| `timeout` | `int` | `-1` | 超时时间（秒），-1 表示无限制 |
| `readOnly` | `boolean` | `false` | 是否为只读事务（允许数据库优化） |
| `rollbackFor` | `Class[]` | `{}` | 触发回滚的异常类型 |
| `noRollbackFor` | `Class[]` | `{}` | 不触发回滚的异常类型 |

### 传播行为

`propagation` 属性控制方法在现有事务中的行为：

| 模式 | 行为 |
|------|------|
| `REQUIRED`（默认） | 加入当前事务，若无事务则创建新事务 |
| `REQUIRES_NEW` | 总是创建新事务，挂起现有事务 |
| `SUPPORTS` | 加入现有事务，若无事务则非事务执行 |
| `NOT_SUPPORTED` | 总是非事务执行，挂起现有事务 |
| `MANDATORY` | 要求存在事务，不存在则抛异常 |
| `NEVER` | 禁止在事务内执行，若存在事务则抛异常 |
| `NESTED` | 在现有事务内创建嵌套事务（保存点），若无事务则创建新事务 |

使用 `REQUIRES_NEW` 的例子：

```java
@Service
public class AuditService {

    @Autowired
    private UltiToolsPlugin plugin;

    // 此方法总是获得独立事务，即使从另一个事务方法调用
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

### 隔离级别

`isolation` 属性控制事务的隔离级别：

| 级别 | 防止问题 | 数据库支持 |
|------|----------|-----------|
| `DEFAULT` | 使用数据库默认 | 所有数据库 |
| `READ_UNCOMMITTED` | 无（允许脏读） | 大多数数据库 |
| `READ_COMMITTED` | 脏读 | 大多数数据库 |
| `REPEATABLE_READ` | 脏读、不可重复读 | 大多数数据库 |
| `SERIALIZABLE` | 所有问题 | 所有数据库 |

隔离级别越高，一致性保证越强，但性能影响越大。仅在需要严格隔离时使用 `SERIALIZABLE`：

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public void criticalTransfer(String from, String to, double amount) {
    // 确保与并发事务完全隔离
}
```

### 自定义回滚规则

默认情况下，`@Transactional` 在 `RuntimeException` 或 `Error` 时回滚。使用 `rollbackFor` 指定额外的回滚异常：

```java
@Transactional(rollbackFor = BusinessException.class)
public void processOrder(Order order) throws BusinessException {
    if (!order.isValid()) {
        throw new BusinessException("订单无效");  // 触发回滚
    }
    // 处理订单...
}
```

使用 `noRollbackFor` 防止特定异常触发回滚：

```java
@Transactional(noRollbackFor = WarningException.class)
public void importData(String source) throws WarningException {
    try {
        // 执行导入...
    } catch (MinorIssueException e) {
        throw new WarningException("非关键问题，事务提交");
    }
}
```

### 只读事务

在只读查询方法上标记 `readOnly = true`，允许数据库应用优化：

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

### 超时配置

为长时间运行的事务设置超时（秒）：

```java
@Transactional(timeout = 30)
public void bulkProcessing() {
    // 执行超过 30 秒则事务回滚
    List<DataEntity> all = getDataOperator().getAll();
    for (DataEntity entity : all) {
        processEntity(entity);
    }
}
```

默认值 `-1` 表示无超时限制。

### 重要限制

1. **基于代理的 AOP**：注解仅适用于 `@Service` Bean 中的公有方法。必须通过代理调用，而非直接调用。

2. **自调用绕过代理**：在同一类中调用 `@Transactional` 方法会绕过代理：

```java
@Service
public class BadExample {

    @Transactional
    public void transactionalMethod() { }

    public void callingMethod() {
        // 错误：绕过代理，事务不生效
        this.transactionalMethod();
    }
}
```

修复方法是注入服务或通过容器调用：

```java
@Service
public class GoodExample {

    @Autowired
    private BadExample service;  // 注入自己以进行外部调用

    public void callingMethod() {
        // 正确：通过代理调用，事务生效
        service.transactionalMethod();
    }

    @Transactional
    public void transactionalMethod() { }
}
```

3. **非 final 类**：类不能是 `final`（CGLIB 限制）。方法也必须是可重写的。

## 编程式 vs 声明式

两种方法效果相同。根据使用场景选择：

### 使用编程式事务（`dataOperator.transaction()`）当：
- 需要对事务边界进行细粒度控制
- 事务跨越多个服务调用
- 在 `@Service` Bean 外工作
- 需要手动处理嵌套事务

### 使用声明式事务（`@Transactional`）当：
- 希望服务层代码更简洁易读
- 单个方法执行所有必须原子化的操作
- 想利用 AOP 处理横切关注点
- 构建包含多个事务方法的服务类

结合两者的例子：

```java
@Service
public class ComplexService {

    @Autowired
    private UltiToolsPlugin plugin;

    // 声明式用于简单的方法级事务
    @Transactional
    public void simpleOperation() {
        // 自动事务管理
    }

    // 编程式用于复杂的多步工作流
    public void complexWorkflow() {
        DataOperator<Entity> dataOp = plugin.getDataOperator(Entity.class);

        // 显式事务与细粒度控制
        dataOp.transaction(() -> {
            // 多个协调操作
            step1();
            step2();
            step3();
        });
    }
}
