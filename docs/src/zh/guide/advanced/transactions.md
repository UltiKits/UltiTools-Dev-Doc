# 事务

UltiTools-API 7.0.0 尚未发布。本页介绍 7.0 开发版。请参阅[更新说明](../release-notes/7.0.0)和[升级指南](./upgrading-to-7)。使用 6.x 时请参阅[归档指南](/zh/v6.4.0/guide/advanced/transactions.html)。

MySQL、SQLite 和 JSON 都支持 `DataOperator#transaction(...)` 与 `@Transactional`。事务覆盖同一线程上加入同一插件事务的操作，不覆盖调度到其他线程的工作、其他插件的存储或发送玩家消息等副作用。

下方示例以模块及其已登记的实体为前提。把 `@Table` 类打包到模块自己的 JAR 中，或用 `@UltiToolsModule(additionalEntities = {...})` 声明额外的合格实体。独立 Paper 插件在 `onEnable()` 中调用 `UltiToolsAPI.connect(this)`，再用 `UltiToolsAPI.getDataOperator(this, Entity.class)` 获取操作器。框架也扫描该插件自己 JAR 中的 `@Table` 类；额外的合格实体可用 `UltiToolsAPI.connect(this, Entity.class, ...)` 声明。两个入口都不能访问其他模块的数据。

如果请求者的作用域未登记该实体，而且框架不知道哪个模块拥有它，获取操作器会抛出 `DataAccessException`（`ULTI-3010`，`ENTITY_NOT_OWNED`）：`Entity <class> is not registered to '<plugin>' -- use the owning module's exposed service or the EventBus instead.` 已知所属模块时，原文为 `Entity <class> belongs to module '<owner>', not '<plugin>' -- use <owner>'s exposed service or the EventBus instead.`

## 基本用法

### 无返回值事务

使用 `transaction(Runnable)` 执行不需要返回值的操作：

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

回调向外抛出异常时，会回滚它开启的事务，或将它加入的事务标记为仅回滚。在回调内捕获普通操作异常并不等同于让异常向外传播。示例假设两个账户都存在且不是同一个账户；写入的原子性本身不能在所有后端防止并发余额更新被覆盖。

### 带返回值事务

需要返回结果时使用 `transaction(Callable<R>)`：

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
    player.sendMessage("新余额: " + newBalance);
} catch (Exception e) {
    player.sendMessage("事务失败: " + e.getMessage());
}
```

`Callable<R>` 重载声明 `throws Exception`。如果调用加入了已有事务，拿到结果不等于外层事务已经提交。

## 批量操作

`DataOperator` 接口提供了自动包装在事务中的批量方法：

### insertAll

原子性批量插入多个实体：

```java
DataOperator<HomeEntity> homeOperator = plugin.getDataOperator(HomeEntity.class);
List<HomeEntity> homes = new ArrayList<>();
homes.add(HomeEntity.builder().name("base").playerId(uuid).build());
homes.add(HomeEntity.builder().name("mine").playerId(uuid).build());
homes.add(HomeEntity.builder().name("farm").playerId(uuid).build());

homeOperator.insertAll(homes);
```

JSON 遇到已有 id 时不执行写入。原子性不等于每个输入都新增一行。

### updateAll

原子性批量更新多个实体：

```java
List<AccountEntity> accounts = dataOperator.getAll();
for (AccountEntity account : accounts) {
    account.setBalance(account.getBalance() * 1.05); // 5% 利息
}

dataOperator.updateAll(accounts); // 全部更新或全部不更新
```

`updateAll(List<T>)` 声明 `throws IllegalAccessException`。除非调用方已有活动事务，否则上面的读取发生在批量事务之前。

## 工作原理

| 后端 | 机制 |
|------|------|
| MySQL / SQLite | 在当前线程的事务上绑定一条关闭自动提交的 JDBC 连接。批量语句也使用该事务。 |
| JSON | 写入暂存到提交时。回滚丢弃暂存写入，不改动已提交的数据。 |

JDBC 提交可能抛出 `DataAccessException`（`ULTI-3006`，`TRANSACTION_FAILED`），消息为 `Failed to commit transaction`。连接会被丢弃，但数据库可能已经提交。执行不能重复的操作时，先重读数据或核对已记录的操作 id，再决定是否重试。回滚本身失败时，服务器会记录失败，不能据此认为写入已经撤销。

### JSON 事务行为

JSON 事务能读到自己暂存的写入，其他线程只看到已提交的数据。一次提交会同时发布该插件各张表的改动，但两次独立读取仍可能分别发生在提交前后。

- 第一次写入时锁表，其他写入者要等到事务结束。通过 `DataOperator#transaction(...)` 的任一重载开启事务时，第一次读表也会加锁。加入已有事务的调用沿用该事务的隔离级别。
- 默认 `@Transactional` 的读取不等待表锁。两个调用方可能读到同一个值，然后相互覆盖更新。可用 `updateIf` 检查期望值并处理返回结果，或选用 `REPEATABLE_READ` 或 `SERIALIZABLE`，在首次读表时加锁。
- 写入（包括事务外写入）或需要加锁的读取最多等表锁五秒，事务截止时间更早时则等到该时间。超时抛出 `DataAccessException`，消息以 `JSON write failed with a lock-wait timeout` 开头，读取也是如此。如果等待会形成环，调用立即失败，消息以 `JSON write failed with a deadlock` 开头。框架不会重试。事务内等待锁失败时，该事务会标记为仅回滚，已取得的锁保留到事务结束。
- 在 JSON 上，`REQUIRES_NEW` 与 `NOT_SUPPORTED` 不等待同一线程上被挂起的调用方所持有的锁。如果它们写入外层事务已暂存的同一个键，外层稍后提交时可能覆盖内层写入。独立的 JDBC 事务仍可能与被挂起的调用方争用锁。

有暂存改动的提交先在 `.ultitools-journal` 中写入记录并强制落盘，再以原子重命名将其标为已提交，最后发布内存中的改动。下次打开数据时先重放已提交的记录。检查点会写入表文件并清理已覆盖的记录。空事务提交不写记录。磁盘 I/O 在提交线程上执行，主线程上的事务应尽量短。

在 Linux 上，如果存储设备遵守刷新请求，完成的提交能抵御断电。Windows 和 macOS 能抵御服务器进程崩溃，但断电或操作系统崩溃可能使最近的提交整笔丢失。若记录已提交但强制目录落盘时发生 I/O 错误，服务器会记录以 `Could not force the directory <directory> to disk` 开头的 `WARNING`；在一次检查点成功完成前，不能保证该提交能抵御断电。

备份表文件时一并备份日志目录，不要通过删除日志目录来消除告警。模块的日志目录为 `plugins/UltiTools/data/<module name>/.ultitools-journal`，已接入的独立插件为 `<plugin data folder>/data/.ultitools-journal`。已提交的记录损坏时，受影响插件的 JSON 数据保持关闭，错误会指明记录，恢复不会跳过它。只有能接受丢失该记录的改动时，才将其移出日志目录。如果模块因打开数据失败而未能加载，移出记录后请重启。参见 [JSON 存储的运维](/zh/guide/essentials/data-storage#json-存储的运维)。

同一插件的一个 `@Table` 值只用于一个实体类。映射到同一张表的两个类可能使用不同的缓存和锁，上述保证不涵盖通过两个类访问数据的情况。

### JSON 实体 id

每个 JSON 实体存为 `<id>.json`。`insert` 创建新 id 时，若该 id 符合下列任一情况，就抛出指明该 id 的 `DataAccessException`（`DATA_ENTITY_INVALID`）予以拒绝，事务内外、所有操作系统上都一样：

- 为空串，或含 `/`、`\`、NUL 或其他控制字符（U+0000 至 U+001F、U+007F）；
- 是 `.` 或 `..`，或以点或空格结尾；
- 是 Windows 设备名（`CON`、`PRN`、`AUX`、`NUL`、`COM1` 至 `COM9`、`LPT1` 至 `LPT9`，以及 `COM` 或 `LPT` 后跟上标 `¹`、`²` 或 `³`，不分大小写），无论带不带扩展名：`con.txt` 也会被拒绝，因为检查的是第一个点之前的部分；
- 使文件名 `<id>.json` 的 UTF-8 长度超过 255 字节；
- 指向服务器自身文件系统无法命名的文件，或其路径规则会把它解读为表文件夹中 `<id>.json` 以外的文件。在 Windows 上即含 `<`、`>`、`:`、`"`、`|`、`?` 或 `*` 的 id，包括以一个字母加冒号开头的 id（如 `c:foo` 或 `p:<uuid>`）：Windows 会把它当作盘符前缀，文件会变成另一个 id 的文件或落到数据文件夹之外。Linux 文件系统通常接受这些字符。

除最后一条由文件系统自己决定外，其余规则在所有操作系统上都一样。被拒绝的插入不会把事务标记为只能回滚。插入已有 id 不会替换已存条目，也不会触发新文件名检查。已有文件不会因该检查改名或重写，仍可按该 id 读取、更新和删除。删除一个这些规则会拒绝的已有 id 后再插入它（在同一个事务中也一样）算作创建新 id，会被拒绝：要替换这样的条目，请用 `update`。刷新若遇到文件系统无法命名的 id，会以指明表和 id 的错误失败，且不写入任何东西。启动恢复若在日志记录中遇到这样的 id（例如从 Linux 复制到 Windows 的记录），会以指明该记录、表和 id 的错误拒绝打开该插件的 JSON 数据，不改动任何文件，处理方式与损坏的记录相同。

建议使用小写 UUID 字符串。不要仅用字母大小写区分 id：在不区分大小写的文件系统上，它们可能指向同一个文件。

## 完整示例

此服务用 `Callable` 将 `update` 的受检异常交给调用方处理。这里只演示如何把写入放在同一事务中，不是完整的并发余额管理方案。

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

## 声明式事务 <Badge type="tip" text="自 v6.3.0 起已接线" />

在容器创建的 Bean 上使用 `@Transactional`。两种写法使用插件数据作用域的同一个管理器：MySQL 和 SQLite 使用 `JdbcTransactionManager`，JSON 使用 `JsonTransactionManager`。事务注解适用于正常启用和运行阶段，不适用于早期引导钩子。如果存储无法提供事务管理器，容器会拒绝需要该注解的 Bean，而不会让它在无事务的情况下运行。

### 前置条件

让容器创建 Bean，例如扫描带 `@Service` 或 `@Component` 的类。容器会在注入依赖之前实例化 Byte Buddy 生成的子类。请调用托管实例，而不是自行 `new`；登记已经构造好的实例不会把它变成事务代理。

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PaymentService.java

### 基本用法

直接在服务方法上添加 `@Transactional` 注解：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AccountService.java

新开启的事务在方法正常返回时尝试提交，异常按[回滚规则](#自定义回滚规则)处理。示例假设两个账户都存在且不是同一个账户。JSON 默认隔离级别下，并发读后写需要条件更新或读表加锁。

### 注解属性

`@Transactional` 注解接受多个配置选项：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `propagation` | `Propagation` | `REQUIRED` | 事务传播行为 |
| `isolation` | `Isolation` | `DEFAULT` | 隔离级别 |
| `timeout` | `int` | `-1` | 超时时间（秒），仅正值设置截止时间 |
| `readOnly` | `boolean` | `false` | 请求 JDBC 只读模式；在 JSON 上拒绝写入 |
| `rollbackFor` | `Class<? extends Throwable>[]` | `{}` | 触发回滚的异常类型 |
| `noRollbackFor` | `Class<? extends Throwable>[]` | `{}` | 不触发回滚的异常类型 |

`@Transactional` 可标注方法或类。对已选中拦截的方法，依次查找方法本身的注解、声明该方法的类或其父类链上的类级注解、被覆写的父类方法上的注解。各处设置不会合并。仅在子类上加类级注解，不会让它覆盖从父类继承且未覆写的方法。

### 传播行为

下列六种模式作用于当前线程和插件。没有 `NESTED` 模式，嵌套调用不是保存点。

| 模式 | 行为 |
|------|------|
| `REQUIRED`（默认） | 加入当前事务，若无事务则创建新事务 |
| `REQUIRES_NEW` | 总是创建新事务，挂起现有事务 |
| `SUPPORTS` | 加入现有事务，若无事务则非事务执行 |
| `NOT_SUPPORTED` | 总是非事务执行，挂起现有事务 |
| `MANDATORY` | 要求存在事务，不存在则抛出 `IllegalStateException` |
| `NEVER` | 禁止在事务内执行，若存在事务则抛出 `IllegalStateException` |

使用 `REQUIRES_NEW` 的例子：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/AuditService.java

加入方沿用外层的 `isolation`、`readOnly` 和 `timeout`，但仍使用自己的回滚规则。异常命中这些规则，或嵌套的编程式回调向外抛出异常时，即使调用方捕获异常，事务也会标记为仅回滚。事务不会立即结束，后续写入仍属于它。最外层尝试提交时会回滚并抛出 `UnexpectedRollbackException`。

同一方法还用了 `@ExceptionCatch` 时，事务拦截器在外层。如果内层把异常转换成正常返回，外层便不会按该异常触发回滚；但事务已有的仅回滚标记仍然有效。

如果加入方的异常继续传出外层注解方法，仍按外层方法的规则处理。回滚一般会继续抛出原异常。如果外层反而尝试提交已标记的事务，则优先抛出 `UnexpectedRollbackException`，原异常附为其 suppressed exception。需要独立提交或回滚时可用 `REQUIRES_NEW`，但仍需考虑后端的锁行为。

### 隔离级别

JDBC 会把非默认隔离级别传给 `Connection.setTransactionIsolation`；`DEFAULT` 保持连接的隔离级别不变。依赖某个隔离级别前，请确认驱动的支持情况和实际行为。

| 级别 | JSON 行为 |
|------|-----------|
| `DEFAULT`、`READ_UNCOMMITTED`、`READ_COMMITTED` | 读取看见已提交的数据及本事务暂存的改动。第一次写入时锁表。 |
| `REPEATABLE_READ`、`SERIALIZABLE` | 首次读写时锁表，直到事务结束。两者采用相同的表锁行为，不等于数据库范围的 SQL 可串行化。 |

新开启的编程式 JSON 事务从首次读取起加锁。加入已有事务不会改变其隔离级别。

### 自定义回滚规则

默认情况下，`@Transactional` 遇到 `RuntimeException` 或 `Error` 时回滚，遇到受检异常则不回滚。`rollbackFor` 增加规则，不改变未匹配异常的默认处理。可用它将受检异常纳入规则：

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
        throw new WarningException("非关键问题");
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

`readOnly = true` 会在 JDBC 新事务中调用 `Connection.setReadOnly(true)`。这是给驱动的提示，不是跨后端的写入保护。设置失败时，管理器记录 `Failed to set read-only mode`。

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/PlayerRepository.java

JSON 拒绝写入时抛出 `DataAccessException`：`Write to JSON table '<table>' rejected: the transaction is read-only.` 这次拒绝本身不把事务标记为仅回滚。如果异常传出注解方法或编程式回调，仍按该作用域的规则处理。

### 超时配置

只有正值 `timeout` 才为新事务设置截止时间，例如 `@Transactional(timeout = 30)`。默认值是 `-1`。加入已有事务不会重置时间预算。两种后端都不会打断 Java 代码、网络调用或其他非数据库工作。

- JDBC 给框架操作器发出的语句设置 `setQueryTimeout`，包括批量操作直接发出的语句。语句准备时按剩余整秒数设限，最少一秒。截止时间已过时，语句仍可带一秒的查询超时运行；时间耗尽本身不会将事务标记为仅回滚。
- JSON 数据操作会检查截止时间，表锁等待也受其限制。因截止时间拒绝操作时，抛出消息以 `JSON transaction timeout` 开头的 `DataAccessException`，并标记事务为仅回滚。表锁等待失败用的是上面的锁等待提示。仅到达截止时间不会自动拒绝提交。

### 重要限制

1. `private`、`static`、`final` 方法，以及在 Bean 所在包以外声明的包级可见方法不能被拦截。有事务管理器时，直接标注不合格的方法会被忽略并记录警告，格式为 `AOP annotation ignored on <bean>: <problem> The annotation has no effect; the module still loads.` 类级注解同样跳过不合格的方法。可以覆写的 `protected` 或同包包级可见方法可以拦截。
2. 在托管子类上，调用合格的 `this.transactionalMethod()` 时，虚方法分派会到达生成的覆写方法，无需自注入。直接调用 `super` 或调用自行 `new` 出来的对象不会进入该覆写方法。
3. 若至少有一个方法原本可以被拦截，Java `final` 或 `sealed` Bean 会创建失败。若没有方法可以被拦截，这类限制只会触发警告。无法使用子类代理时，请用已登记实体的操作器开启编程式事务。

## 编程式 vs 声明式

两种写法都可以原子地组织写入，但回滚规则和 JSON 默认读锁行为不同。

### 使用编程式事务（`dataOperator.transaction()`）当：

- 需要对事务边界进行细粒度控制
- 事务跨越多个服务调用
- 在容器创建的 Bean 之外工作
- 希望受检异常传出回调时触发回滚，而不必声明注解规则

### 使用声明式事务（`@Transactional`）当：
- 希望服务层代码更简洁易读
- 单个方法执行所有必须原子化的操作
- 想利用 AOP 处理横切关注点
- 构建包含多个事务方法的服务类

结合两者的例子：

<<< @/../examples/src/main/java/com/ultikits/docs/transactions/ComplexService.java
