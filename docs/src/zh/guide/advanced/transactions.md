# 事务

::: info 自 v6.2.0 起提供，自 v6.3.0 起在所有后端上都是原子的
事务支持自 UltiTools-API v6.2.0 起可用。到 v6.2.5 为止，`transaction(...)` 只在 JSON 后端上是原子的
——MySQL 与 SQLite 执行代码块时没有挂事务管理器，每次写入执行即提交。从 v6.3.0 起，三个存储后端
都挂上了真正的事务管理器，下面的转账写法在所有后端上都是原子的。
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

::: tip 批量方法在所有后端上同样是原子的
`insertAll` 与 `updateAll` 现在用的是同一套事务机制，包括此前会绕过它的两个直接 JDBC 语句路径：
一次批量插入若第三行违反主键约束，在任何后端上都会保留零行，不只是 JSON。
:::

::: warning JSON 的回滚恢复的是整个操作器的缓存，不是逐个实体
JSON 后端的回滚是基于快照的：事务内第一次触碰某个操作器时，会深拷贝它的整个内存缓存，失败时从
这份快照整体恢复。这是整体缓存粒度，不是逐实体撤销。这一点尤其影响 `Propagation.REQUIRES_NEW`/
`NOT_SUPPORTED`（见下文）：内层作用域相对外层的独立性，只有当两者触碰的是**不同的**
`DataOperator` 实例时才能被观察到。如果两者写的是**同一个**操作器，外层作用域最终的回滚会把
内层作用域已经提交的写入也一并丢弃。
:::

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/EconomyService.java

::: tip
对于简单的单实体操作，你不需要事务。事务在需要确保多个操作同时成功或同时失败时最为有用。
:::

## 声明式事务 <Badge type="tip" text="自 v6.3.0 起已接线" />

::: warning 到 v6.2.5 为止，没有任何代码读取 @Transactional
到 v6.2.5 为止，创建代理的 `aop` 包在自身之外没有任何引用：没有 bean 后置处理器被注册，
`TransactionInterceptor` 从不被实例化，因此带注解的方法与不带注解的方法执行路径完全相同——不提交、
不回滚，也不打日志。在 v6.2.5 上，请改用本页前面的编程式写法，或者直接移除该注解。
从 v6.3.0 起，`@Transactional` 已经在全部三个存储后端上端到端接线（SQLite/MySQL 通过每个插件一个的
`JdbcTransactionManager`；JSON 通过基于快照的 `JsonTransactionManager`），并且如果框架无法为某个
声明了 `@Transactional` 的 bean 提供事务管理器——包括仅仅继承或扩展了带该注解的类——这个 bean 会在
加载期直接被拒绝，而不是静默地不受事务保护地运行。
:::

`@Transactional` 注解提供了声明式事务管理，可以在服务方法上使用。相比编程式事务，这种方式代码更简洁，并且与 IoC 容器深度集成。

### 前置条件

`@Transactional` 注解仅适用于 `@Service` Bean 中的方法，因为事务是通过生成的子类代理实现的
（自 v6.3.0 起是 ByteBuddy；更早的 CGLIB 引擎是同样的子类代理形态）：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PaymentService.java

### 基本用法

直接在服务方法上添加 `@Transactional` 注解：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AccountService.java

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

::: warning `NESTED` 自 v6.3.0 起已被移除
到 v6.2.5 为止拦截器根本不会运行，所以这张表描述的是设计意图，不是实际观察到的行为。从 v6.3.0
起，`REQUIRES_NEW` 与 `NOT_SUPPORTED` 在每个后端上都会真正挂起当前活动事务，而 `NESTED` 已经从
`Propagation` 枚举里彻底移除——不只是没有实现，这个常量已经不存在了，所以针对 v6.3.0 引用
`Propagation.NESTED` 会编译失败。它被砍掉是因为可控性，不是不可实现：`NESTED` 完全可以映射到
`Connection.setSavepoint()`，但保存点的实际行为取决于服务器所装 Paper 构建自带的 `sqlite-jdbc`
版本，这不是本项目能钉住或能跨版本测试的东西。
:::

`propagation` 属性控制方法在现有事务中的行为。截至 v6.3.0，一共有六个取值，恰好对应
Jakarta Transactions 2.0 的 `TxType` 集合：

| 模式 | 行为 |
|------|------|
| `REQUIRED`（默认） | 加入当前事务，若无事务则创建新事务 |
| `REQUIRES_NEW` | 总是创建新事务，挂起现有事务 |
| `SUPPORTS` | 加入现有事务，若无事务则非事务执行 |
| `NOT_SUPPORTED` | 总是非事务执行，挂起现有事务 |
| `MANDATORY` | 要求存在事务，不存在则抛异常 |
| `NEVER` | 禁止在事务内执行，若存在事务则抛异常 |

使用 `REQUIRES_NEW` 的例子：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AuditService.java

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

::: tip 自 v6.3.0 起，rollbackFor 是叠加语义
默认情况下，`@Transactional` 在 `RuntimeException` 或 `Error` 时回滚。`rollbackFor` 是对这条默认
规则的**叠加**，不是替换——一个既不匹配 `rollbackFor` 也不匹配 `noRollbackFor` 的异常，仍然会落到
默认规则，所以 `@Transactional(rollbackFor = BusinessException.class)` 在一个无关的
`NullPointerException` 上仍然会回滚。到 v6.2.5 为止，非空的 `rollbackFor` 会把默认规则整个替换
掉，所以只列一个自定义类型就会静默停掉所有未列出异常的回滚——这个行为从 v6.3.0 起已经不存在。
:::

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

当一个异常**同时**匹配 `rollbackFor` 与 `noRollbackFor` 时，胜出的是继承深度更浅的那条规则所列的
类；深度恰好相同——包括同一个类同时出现在两个数组里——时回滚胜出：

```java
class OrderException extends RuntimeException { }
class ValidationException extends OrderException { }

@Transactional(rollbackFor = ValidationException.class, noRollbackFor = OrderException.class)
public void processOrder(Order order) throws ValidationException {
    if (!order.hasShippingAddress()) {
        throw new ValidationException("missing shipping address"); // 回滚：
        // ValidationException 对 rollbackFor 是深度 0（精确）匹配，对 noRollbackFor 是
        // 深度 1 匹配（往上一层到 OrderException）——更浅的匹配胜出。
    }
}
```

### 只读事务

在只读查询方法上标记 `readOnly = true`，允许数据库应用优化：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PlayerRepository.java

### 超时配置

::: tip 自 v6.3.0 起：按语句设限，不是方法整体的墙钟限制
`timeout` 是作为 JDBC `setQueryTimeout` 施加在事务内发出的每一条语句上的，针对的是一个从事务开始
时算起的共享截止时间。每条语句在准备时拿到的是这个预算里**剩余**的时间，向下取整到不小于 1 秒，
让一个已经耗尽的预算依然快速失败。这**不是**对方法体整体的限制：方法内的非数据库工作（一次慢
计算、一次对外网络调用）不会被打断，因为纯 JDBC 没有取消已经在途工作的机制。在 SQLite 与 MySQL
上按上述方式强制执行。在 JSON 后端上，正数的 `timeout` 会让事务直接失败——`JsonTransactionManager`
没有语句可设限，它的回滚是缓存快照恢复，不是 JDBC 操作。
:::

为长时间运行的事务设置超时（秒）：

```java
@Transactional(timeout = 30)
public void bulkProcessing() {
    // 该事务开启期间发出的每条语句，都会拿到 30 秒预算里在语句准备时刻剩余的那部分作为超时。
    List<DataEntity> all = getDataOperator().getAll();
    for (DataEntity entity : all) {
        processEntity(entity);
    }
}
```

默认值 `-1` 表示无超时限制——拦截器在任何后端上都不会为它调用 `setTimeout`。

### 重要限制

1. **方法资格**：`private`、`static`、`final` 方法不能声明事务——它们的调用方式各自绕开了代理能
   拦截的路径。声明在与 bean 类不同包里的 package-private 方法同样不合格。`protected` 方法与
   同包 package-private 方法合格。

2. **自调用会被拦截，不会绕过代理**：与基于委托的代理框架不同，本框架生成的代理是 bean 自身的
   **子类**，不是包裹它的另一个对象——所以同一个类里另一个方法调用 `this.transactionalMethod()`
   会虚派发到代理的覆写版本，同样**会被拦截**，和从类外部发起的调用完全一样。同类内的自调用不
   需要把服务注入自己或通过容器调用来获得事务行为。

3. **非 final 类**：类不能是 `final`（子类代理的限制）。方法也必须是可重写的。

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

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/ComplexService.java
