# 事务

::: info 自 v6.3.0 起在所有后端上都是原子的
事务支持自 UltiTools-API v6.2.0 起可用。三个存储后端自 v6.3.0 起都是原子的。
:::

到 v6.2.5 为止，`transaction(...)` 只在 JSON 后端上是原子的：MySQL 与 SQLite 执行代码块时没有挂
事务管理器，每次写入执行即提交。从 v6.3.0 起，三个存储后端都挂上了真正的事务管理器，下面的转账
写法在所有后端上都是原子的。

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
| **JSON** | 按事务暂存写入（自 v6.3.0 起）：写入留在事务内，提交时一起应用，回滚时丢弃，提交之前其他线程看不到 |

你不需要知道当前使用的是哪个后端——相同的事务 API 适用于所有存储类型。

::: tip 批量方法在所有后端上同样是原子的
`insertAll` 与 `updateAll` 现在用的是同一套事务机制，包括此前会绕过它的两个直接 JDBC 语句路径：
一次批量插入若第三行违反主键约束，在任何后端上都会保留零行，不只是 JSON。
:::

::: tip JSON 事务是暂存的、原子的、持久的（自 v6.3.0 起）
JSON 事务暂存自己的写入，在同一插件的所有表上原子提交，崩溃之后保持完整。其他线程只能看到已提交的数据。
:::

### JSON 事务行为

自 v6.3.0 起，JSON 事务内的写入先暂存给该事务，事务自己的读取能看到这些写入；其他线程只看到已提交的数据。提交一次性应用暂存的写入，回滚则丢弃它们，且不影响任何已提交的内容。模块作者可能注意到下面这些：

- 其他线程在同一瞬间看到一次提交对该插件所有表的改动：一次读取要么看到该提交的全部改动，要么一个也看不到。覆盖同一插件多张表的事务作为一个整体提交，崩溃之后仍然全有或全无。
- 事务内对某张表的第一次写入会锁住该表，其他写入者要等到事务结束。事务外的普通写入同样要等这把锁。默认隔离级别下的读取从不等待表锁。
- 写入遇到被锁的表，最多等待 5 秒，或者等到事务的 `timeout` 截止时间（如果更早），然后抛出 `DataAccessException`，消息以 `JSON write failed with a lock-wait timeout` 开头。若这次等待会形成环（两个事务互相等待），闭环的那次调用立即失败，消息以 `JSON write failed with a deadlock` 开头。框架不会重试这两种失败。
- 这两种失败都会在抛出异常之前把所在事务标记为仅回滚，因此在事务内捕获该异常并不能挽救事务：最外层提交会回滚该事务写入的全部内容，并抛出 `UnexpectedRollbackException`。该事务持有的表锁保留到它结束为止。
- 默认隔离级别下，两个事务可以读到同一个值，后者再按读到的旧值算出新值写入：这种丢失更新不会被阻止。凭读到的值计算写入的代码应使用 `DataOperator#updateIf`（检查与写入在表锁下一起完成），或 `@Transactional(isolation = Isolation.REPEATABLE_READ)` / `Isolation.SERIALIZABLE`，它们在第一次读取时就锁表。
- `REQUIRES_NEW` 与 `NOT_SUPPORTED` 独立于外层事务提交。与 SQLite、MySQL 的一个差别：这类方法与被它挂起的调用方在同一线程上运行，而表锁归线程所有，所以它不会等待调用方持有的锁；若它写入调用方已暂存的同一个键，最终保留的是外层事务稍后提交的值。
- 改动了数据的提交会在返回前写入并强制落盘一条日志记录，即在提交线程（常常是服务器主线程）上等待磁盘。什么都没改的事务不写任何东西，也不强制任何落盘。
- 持久性：“`commit` 返回即持久”在 Linux 上完全成立。在 Windows 和 macOS 上，它能抵御服务器崩溃，但断电或操作系统崩溃可能丢失最近的几次完整提交。丢失的提交是整笔丢失，不会只丢一半。
- 因真实 I/O 错误而无法强制落盘的目录会以 `WARNING` 记录（`Could not force the directory <目录> to disk ...`）。此时完成的提交已经提交，能抵御服务器崩溃，要等下一次刷新完成后才能抵御断电。
- 启动时若发现已提交的日志记录损坏，该插件的 JSON 数据保持关闭：数据操作会失败，错误信息指明该文件，直到服主把该文件移出日志文件夹。框架不会删除、跳过或应用损坏的记录，其他插件不受影响。服主可以在[JSON 存储的运维](/zh/guide/essentials/data-storage#json-存储的运维)中查看详情。

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/EconomyService.java

::: tip 单实体操作不需要事务
对于简单的单实体操作，你不需要事务。事务在需要确保多个操作同时成功或同时失败时最为有用。
:::

## 声明式事务 <Badge type="tip" text="自 v6.3.0 起已接线" />

::: warning v6.3.0 首次接线
到 v6.2.5 为止，`@Transactional` 从未被读取：没有拦截器运行，带注解方法与不带注解方法表现完全
相同。v6.3.0 起端到端接线，并在加载期拒绝无法支持的 bean。
:::

到 v6.2.5 为止，创建代理的 `aop` 包在自身之外没有任何引用：没有 bean 后置处理器被注册，
`TransactionInterceptor` 从不被实例化，因此带注解的方法与不带注解的方法执行路径完全相同，不提交、
不回滚，也不打日志。在 v6.2.5 上，请改用本页前面的编程式写法，或者直接移除该注解。

从 v6.3.0 起，`@Transactional` 已经在全部三个存储后端上端到端接线：SQLite 与 MySQL 通过每个插件
一个的 `JdbcTransactionManager`，JSON 通过每个插件一个、暂存写入的 `JsonTransactionManager`（见 [JSON 事务行为](#json-事务行为)）。如果框架无法为某个
声明了 `@Transactional` 的 bean 提供事务管理器，包括仅仅继承或扩展了带该注解的类，这个 bean 会在
加载期直接被拒绝，而不是静默地不受事务保护地运行。

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

::: warning `NESTED` 被移除，不是未实现
`Propagation.NESTED` 自 v6.3.0 起已不存在，引用它会编译失败。`REQUIRES_NEW` 与 `NOT_SUPPORTED`
现在会在每个后端上真正挂起当前活动事务。
:::

到 v6.2.5 为止拦截器根本不会运行，所以这张表描述的是设计意图，不是实际观察到的行为。

`NESTED` 被砍掉是因为可控性，不是不可实现。它完全可以映射到 `Connection.setSavepoint()`，但保存点
的实际行为取决于服务器所装 Paper 构建自带的 `sqlite-jdbc` 版本，这不是本项目能钉住或能跨版本
测试的东西。

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

::: warning 失败的加入方方法会回滚整个事务（自 v6.3.0 起）
在 SQLite、MySQL 与 JSON 上一致：加入活动事务的 `@Transactional` 方法（`REQUIRED`，或在事务中调用的 `SUPPORTS`、`MANDATORY`）抛出其 `rollbackFor`/`noRollbackFor` 规则认可的异常时，即使调用方捕获了该异常，整个事务也被标记为仅回滚。
最外层提交随后回滚该事务的全部写入，并抛出 `UnexpectedRollbackException`。
:::

规则不认可的异常不会使事务无法提交。外层方法未捕获的加入方失败会使事务回滚，调用方收到原来的异常。调用方需要承受其失败的工作，应放进 `REQUIRES_NEW` 方法，它单独提交或回滚。

嵌套的 `DataOperator#transaction(...)` 遵循同一规则。自 v6.3.0 起，在 SQLite、MySQL 与 JSON 上一致：嵌套调用的回调失败时，整个事务被标记为仅回滚，并不结束；外层之后的写入仍留在事务内，外层提交回滚全部内容并抛出 `UnexpectedRollbackException`。6.3.0 之前在 SQLite 与 MySQL 上，内层失败会立即结束事务，外层之后的写入在没有事务的情况下执行。需要承受某项工作的失败时，让内层失败向外传播，或者把这项工作放进 `REQUIRES_NEW` 方法。

### 隔离级别

`isolation` 属性控制事务的隔离级别：

| 级别 | 防止问题 | 数据库支持 |
|------|----------|-----------|
| `DEFAULT` | 使用数据库默认 | 所有数据库 |
| `READ_UNCOMMITTED` | 无（允许脏读） | 大多数数据库 |
| `READ_COMMITTED` | 脏读 | 大多数数据库 |
| `REPEATABLE_READ` | 脏读、不可重复读 | 大多数数据库 |
| `SERIALIZABLE` | 所有问题 | 所有数据库 |

在 JSON 后端上，自 v6.3.0 起，`REPEATABLE_READ` 与 `SERIALIZABLE` 在事务第一次读取某张表时就锁住该表，得到表粒度的可重复读；其他级别在第一次写入时锁表，`READ_UNCOMMITTED` 按 `READ_COMMITTED` 处理。

隔离级别越高，一致性保证越强，但性能影响越大。仅在需要严格隔离时使用 `SERIALIZABLE`：

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public void criticalTransfer(String from, String to, double amount) {
    // 确保与并发事务完全隔离
}
```

### 自定义回滚规则

::: tip `rollbackFor` 是叠加，不是替换
自 v6.3.0 起，`rollbackFor` 叠加在默认的 `RuntimeException`/`Error` 回滚规则之上，不是替换它。
:::

一个既不匹配 `rollbackFor` 也不匹配 `noRollbackFor` 的异常，仍然会落到默认规则，所以
`@Transactional(rollbackFor = BusinessException.class)` 在一个无关的 `NullPointerException` 上
仍然会回滚。到 v6.2.5 为止，非空的 `rollbackFor` 会把默认规则整个替换掉，所以只列一个自定义
类型就会静默停掉所有未列出异常的回滚；这个行为从 v6.3.0 起已经不存在。

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

在 JSON 后端上，自 v6.3.0 起，`readOnly = true` 会拒绝写入。这种拒绝不会把事务标记为仅回滚：捕获它后事务仍可提交，与 SQLite、MySQL 上一条失败的语句相同。

### 超时配置

::: tip JDBC 上按语句设限，JSON 上检查截止时间
在 SQLite 与 MySQL 上，`timeout` 把 `setQueryTimeout` 施加在事务内每一条语句上，针对一个共享的、不断缩小的预算。在 JSON 上，每个数据操作都先检查截止时间。在所有后端上它都不会打断方法内的非数据库工作。
:::

`timeout` 是作为 JDBC `setQueryTimeout` 施加在事务内发出的每一条语句上的，针对的是一个从事务开始
时算起的共享截止时间。每条语句在准备时拿到的是这个预算里剩余的时间，向下取整到不小于 1 秒，让
一个已经耗尽的预算依然快速失败。这不是对方法体整体的限制：方法内的非数据库工作（一次慢计算、
一次对外网络调用）不会被打断，因为纯 JDBC 没有取消已经在途工作的机制。

在 SQLite 与 MySQL 上按上述方式强制执行。在 JSON 后端上没有语句可设限，所以自 v6.3.0 起改为检查截止时间。事务内的每个数据操作都先检查它；截止时间过后开始的操作抛出 `DataAccessException`，消息以 `JSON transaction timeout` 开头。等待表锁也会在截止时间到达时结束（如果比 5 秒更早）。该失败在抛出之前把事务标记为仅回滚（与 Spring 在事务截止时间已过时的做法相同），因此捕获它并不能挽救事务：最外层提交会回滚并抛出 `UnexpectedRollbackException`。

两类后端在这里有差别。在 SQLite 与 MySQL 上，截止时间之后发出的语句仍会执行，查询超时为 1 秒，并且不会标记事务为仅回滚。

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
