# 数据储存

UltiTools 封装了一套数据储存 API，它支持 MySQL 数据库、SQLite 数据库（6.1.0起）与 JSON 文件储存。数据存储对于开发者来说是透明的，UltiTools将通过服主的配置判断使用哪种存储方式。

你需要的仅仅只是一个实体类。CRUD 操作将由 UltiTools 自动完成。

::: warning 尽量不要嵌套对象
由于插件还处于开发状态，难免在处理复杂对象时出现问题，所以存储的对象尽量不要超过两层嵌套（尽量不要嵌套对象）。
:::

::: warning SQLite 与 spark 后台分析器（自 v6.3.0 起）
在 Paper 上，spark 的后台分析器默认开启；使用 SQLite 存储时，它会把服务器线程上的数据库调用等待被锁定的数据库文件的时间从约 3 秒缩短到约 0.4 秒，因此只有当另一个线程或进程持有写锁超过这个时间时，调用才会失败（[#645](https://github.com/UltiKits/UltiTools-Reborn/issues/645)）。
MySQL 不受影响。
写入会长时间持有 SQLite 锁的服务器应改用 MySQL。
:::

## 创建实体类

### BaseDataEntity

创建一个继承 `BaseDataEntity<String>` 的类，并使用 `@Table` 和 `@Column` 注解来标记你的实体类。

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserData.java

其中，`@Table` 注解用于标记该类对应的数据表（若使用 MySQL 数据库），`@Column` 注解用于标记该类的字段对应的数据表的列。

`@Data`、`@Builder`、`@NoArgsConstructor`、`@AllArgsConstructor`、`@EqualsAndHashCode` 则为 Lombok 注解，用于自动生成 `getter`、`setter`、`builder`、`equals`、`hashCode` 方法。

::: warning 从 AbstractDataEntity 迁移
从 v6.2.0 开始，`DataOperator`、`Query` 和 `UltiToolsPlugin.getDataOperator()` 要求实体继承 `BaseDataEntity<String>` 而非 `AbstractDataEntity`。如果你的实体仍然继承 `AbstractDataEntity`，请改为 `BaseDataEntity<String>`。
:::

`BaseDataEntity<String>` 提供了插入/更新/删除/加载事件的生命周期钩子：

| 方法 | 说明 |
|------|------|
| `onCreate()` | 在实体首次持久化之前调用 |
| `onUpdate()` | 在实体更新之前调用 |
| `onDelete()` | 在实体删除之前调用 |
| `onLoad()` | 在从数据存储加载实体后调用 |
| `validate()` | 实体有效返回 `true` |
| `isNew()` | 实体无 ID 时返回 `true` |
| `copyWithoutId()` | 创建不含 ID 的实体副本，前提是实体类自行实现 `Cloneable` |

自 v6.3.0 起，数据操作器自行调用这些钩子，JSON、MySQL 与 SQLite 后端一致：

| 钩子 | 调用方 |
|------|--------|
| `onCreate()` | `insert` 与 `insertAll`，对每个实体，在写入其字段之前 |
| `onUpdate()` | `update(entity)`、`updateAll`、`updateCounted` 与 `updateIf`，对传入的实体，在写入其字段之前，无论随后是否写入了行 |
| `onDelete()` | `delById` 与查询 DSL 的 `delete()`，对已储存的实体，在删除之前；没有任何行具有该 id 时不调用 |
| `onLoad()` | `getById`、`getAll`、`page`、`getLike` 以及基于它们的查询 DSL 读取，对返回的每个实体调用一次 |

`update(column, value, id)`、`del(conditions)` 与 `exist(...)` 不读取实体，不调用任何钩子。v6.3.0 之前，操作器不调用这四个钩子中的任何一个。

### AuditableDataEntity <Badge type="tip" text="v6.2.0+" />

对于需要跟踪创建和修改的实体，可以使用 `AuditableDataEntity`：

<<< @/../examples/src/main/java/com/ultikits/docs/data/AuditEntry.java

`AuditableDataEntity<String>` 继承了 `BaseDataEntity<String>`，自动管理以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `createdAt` | `LocalDateTime` | 实体创建时间（在 `onCreate()` 中自动设置） |
| `updatedAt` | `LocalDateTime` | 上次修改时间（在 `onUpdate()` 中自动更新） |
| `createdBy` | `UUID` | 创建实体的用户 ID（从线程本地上下文获取） |
| `updatedBy` | `UUID` | 上次修改实体的用户 ID（从线程本地上下文获取） |

所有这四个字段都已预配置 `@Column` 注解，子类中无需声明。

自 v6.3.0 起，操作器通过这些钩子填写四个审计列：`insert` 设置 `created_at` 与 `updated_at`，设置了当前用户时再设置 `created_by` 与 `updated_by`；更新时设置 `updated_at`，设置了当前用户时再设置 `updated_by`，不改动 `created_at` 与 `created_by`。由 `BaseCommandExecutor` 为玩家处理的命令，在命令主体运行期间把该玩家设为当前用户，因此在其中进行的写入会记录该玩家。在其他地方，请按下文自行设置上下文。v6.3.0 之前，操作器不调用这些钩子，四列始终为 NULL。

#### 用户上下文管理

要跟踪执行操作的用户，需要在数据库操作前设置当前用户：

```java
import com.ultikits.ultitools.abstracts.data.AuditableDataEntity;

UUID currentUserId = player.getUniqueId();
AuditableDataEntity.setCurrentUser(currentUserId);

try {
    DataOperator<AuditEntry> op = plugin.getDataOperator(AuditEntry.class);
    AuditEntry entry = AuditEntry.builder()
        .action("login")
        .details("玩家从 192.168.1.1 登录")
        .build();
    op.insert(entry);  // createdBy 和 updatedBy 自动设置
} finally {
    AuditableDataEntity.clearCurrentUser();
}
```

::: warning 必须清除上下文
使用 try-finally 块确保调用 `clearCurrentUser()`，否则 ThreadLocal 上下文会持续存在于后续请求中，可能导致用户身份泄露。
:::

#### 工具方法

`AuditableDataEntity` 提供了便利的时间相关查询方法：

| 方法 | 返回值 | 说明 |
|------|-------|------|
| `getAge()` | `Duration` 或 `null` | 实体自创建以来经过的时间 |
| `getTimeSinceUpdate()` | `Duration` 或 `null` | 实体自上次修改以来经过的时间 |
| `wasModified()` | `boolean` | 实体是否在创建后被修改过 |

使用示例：

```java
AuditEntry entry = op.getById("some-id");
if (entry.wasModified()) {
    System.out.println("修改于 " + entry.getTimeSinceUpdate().getSeconds() + " 秒前");
}
```

::: info 空值安全
如果实体尚未持久化（缺少 `createdAt` 或 `updatedAt`），`getAge()` 和 `getTimeSinceUpdate()` 会返回 `null`。在调用返回的 `Duration` 上的方法前，务必检查 null。
:::

### @Table 注解

`@Table` 注解有一个 `value` 属性，用于指定该类对应的数据表或文件夹的名称。

### @Column 注解

`@Column` 注解有两个属性，`value` 属性用于指定该字段对应的数据表的列，`type` 属性用于指定该字段对应的数据表的列的类型。

type 属性的默认值为 `VARCHAR(255)`。

可用的类型可参见 [MySQL 数据类型](https://www.runoob.com/mysql/mysql-data-types.html)。

## CRUD 操作

UltiTools 封装了一套语义化的 CRUD 操作 API，你只需要调用相应的方法，即可完成对数据的增删改查。

### DataOperator

`DataOperator` 用于数据操作。

在继承了 `UltiToolsPlugin` 的主类中，有一个 `getDataOperator` 方法，用于获取数据操作器。

你需要获取插件主类的实例，然后调用 `getDataOperator` 方法。

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserDataService.java

::: warning 请即取即用
`DataOperator` 不是线程安全的，请在需要的时候获取 `DataOperator`，不要试图保存 `DataOperator` 对象。
:::

### 插入

```java
SomeEntity entity = SomeEntity.builder()
    .name("test")
    .something(42.0)
    .build();
dataOperator.insert(entity);
```

### 查询

使用 `WhereCondition`：

```java
List<SomeEntity> list = dataOperator.getAll(
    WhereCondition.builder()
        .column("name")
        .value("test")
        .build()
);
```

或按 ID 获取单个实体：

```java
SomeEntity entity = dataOperator.getById("some-id");
```

获取所有实体：

```java
List<SomeEntity> all = dataOperator.getAll();
```

分页查询：

```java
List<SomeEntity> page = dataOperator.page(1, 10); // 第 1 页，每页 10 条
```

::: warning page() 在 JSON 后端返回空列表
在 JSON 后端上，`page(int, int)` 转交 `getAll(WhereCondition...)`，零长度参数走的分支返回空列表，而同一次调用在 MySQL 或 SQLite 上会拼出普通的 `LIMIT ? OFFSET ?` 并返回该页数据，同一份模块代码换后端结果不同。
需要两端一致的分页时，改用 `getAll()` 取全量再用 `subList` 切片：`page(1, 10, WhereCondition.empty())` 不能替代，关系型操作器不过滤空条件，会拼出 `WHERE null = ?`。
让 `page` 与 `exist` 在空条件上与 `getAll` 对齐的修法跟踪于 [issue #193](https://github.com/UltiKits/UltiTools-Reborn/issues/193)。
:::

::: tip 查询 DSL
从 v6.2.0 开始，你可以使用[流式查询 DSL](/zh/guide/essentials/query-dsl) 来编写更可读的查询：

```java
SomeEntity entity = dataOperator.query()
    .where("name").eq("test")
    .first();
```
:::

### 更新

更新单个字段：

```java
dataOperator.update("name", "newName", entityId);
```

使用实体对象更新：

```java
try {
    entity.setName("newName");
    dataOperator.update(entity);
} catch (IllegalAccessException e) {
    // 处理异常或继续向上抛出
}
```

该重载声明了受检异常 `IllegalAccessException`，调用方需要声明或捕获它。

自 v6.3.0 起，读取返回的每个实体（`getById`、`getAll`、`page`、`getLike` 以及查询 DSL）都是副本，`insert` 存下的也是传入实体的副本。修改实体后，只有把它交给 `update(...)`，储存的数据才会改变，各个后端都是如此。v6.3.0 之前，JSON 后端返回的是它缓存在内存中的实例，因此在 JSON 后端上不调用 `update(...)` 的修改也会在下一次落盘时保存，而 MySQL 与 SQLite 从来不会保存这样的修改。

自 v6.3.0 起，`update(T)`、`update(column, value, id)`、`delById` 与 `updateAll` 在 id 为 `null` 时抛出 `DataAccessException`，因为没有任何一行能用它定位；`updateAll` 会在写入之前检查全部实体。UltiTools-API 6.2.0 在 SQLite 上写入的无 id 行，会在初始化数据表时补上 id：优先使用实体通过 `getId()` 给出的值，实体给不出时使用新的 UUID，前提是实体随后确实给出这个值。控制台输出一行，给出表名与行数；任何 id 都无法使其可定位的行保持原样，并在一条警告中计数。每次写入都把 `getId()` 存入 `id` 列，因此把 `getId()` 覆写到其他字段上的实体，可以用它给出的值定位。

自 v6.3.0 起，按一个没有任何行具有的 id 更新时，各个后端都不写入任何内容，输出一条给出表名与 id 的警告，并正常返回。需要知道更新是否写入时，调用 `updateCounted(entity)`：写入了一行时返回 `1`，没有任何行具有该 id 时返回 `0`：

```java
if (dataOperator.updateCounted(entity) == 0) {
    // 这一行已被其他写入方删除：没有写入任何内容。
}
```

框架之外的 `DataOperator` 实现如果没有覆写 `updateCounted`，按更新之前是否存在具有该 id 的行计数。

### 条件更新 <Badge type="tip" text="v6.3.0+" />

`updateIf(entity, expected...)` 只在储存的行仍然满足全部预期条件时写入实体，并返回是否写入。需要基于之前读到的值做更新、又不能覆盖其间其他写入方的修改时，使用它：

```java
Account read = dataOperator.getById(accountId);
double seen = read.getBalance();
read.setBalance(seen + amount);
boolean written = dataOperator.updateIf(read,
    WhereCondition.builder().column("balance").value(seen).build());
if (!written) {
    // 其他写入方先修改了这一行：重新读取，再做决定。
}
```

在 MySQL 与 SQLite 上，检查与写入是同一条 `UPDATE ... WHERE id = ? AND <条件>` 语句，因此对共用同一个数据库的多台服务器同样成立。在 JSON 后端上，检查与写入在数据操作器的锁内完成；JSON 储存只属于一台服务器。条件的含义与 `getAll(WhereCondition...)` 中相同。

没有任何一行同时具有该实体的 id 并满足全部条件时，`updateIf` 返回 `false`，不写入任何内容；id 为 `null`、条件为 `null`、条件使用了实体没有用 `@Column` 映射的列，或在默认 `EQUAL` 以外的比较下条件的值为 `null` 时，各个后端都抛出 `DataAccessException`。自 v6.3.0 起，默认比较下的 `null` 期望值表示 `IS NULL`（JSON：字段不存在或为 JSON null），因此对读取时仍未设置的列做比较后写入时，若其间另一个写入方已写入该列，本次写入不生效；这一含义只属于 `updateIf`（[#640](https://github.com/UltiKits/UltiTools-Reborn/issues/640)）。框架之外的 `DataOperator` 实现如果没有实现它，会抛出 `UnsupportedOperationException`。

### 删除

按 ID 删除：

```java
dataOperator.delById(entityId);
```

按条件删除：

```java
dataOperator.del(
    WhereCondition.builder()
        .column("name")
        .value("test")
        .build()
);
```

### WhereCondition

`WhereCondition` 用于指定查询条件。

```java
WhereCondition.builder().column("somecol").value(someval).build();
```

其中，`column` 属性用于指定查询的列，`value` 属性用于指定查询的值。

### 事务 <Badge type="tip" text="v6.2.0+" />

对于需要同时成功或同时失败的操作，请参阅[事务](/zh/guide/advanced/transactions)指南。

::: tip MySQL 与 SQLite 在一个 JDBC 事务中执行这段代码
自 v6.3.0 起，MySQL 与 SQLite 储存为其交出的每个操作器注入事务管理器（[#307](https://github.com/UltiKits/UltiTools-Reborn/issues/307)），因此 `transaction(...)` 在 JDBC 事务中执行，下面两条插入一起提交或一起回滚。
JSON 后端则恢复其条目的快照。
:::

```java
dataOperator.transaction(() -> {
    dataOperator.insert(entity1);
    dataOperator.insert(entity2);
    // 全部插入或全部不插入
});
```

自 v6.3.0 起，事务自身的失败路径再失败时不会隐式提交（[#634](https://github.com/UltiKits/UltiTools-Reborn/issues/634)）：回滚或提交失败时，连接被丢弃（HikariCP 连接池会将其剔除），而不是重新打开自动提交（那样会提交该事务），因此事务中的内容不会被保存，调用方仍收到原来的异常。`transaction(...)` 中抛出的 `Error` 会使事务回滚（JSON 则恢复快照），并原样抛出同一个实例。
