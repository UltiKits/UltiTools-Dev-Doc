# 数据储存

7.0.0 尚未发布。本页描述自 v7.0.0 起的行为，参见[发布说明](../release-notes/7.0.0)和[升级指南](../advanced/upgrading-to-7)。使用 6.x 时请查阅 [v6.4.0 数据储存归档](/zh/v6.4.0/guide/essentials/data-storage.html)。

UltiTools 为 MySQL、SQLite 和 JSON 提供统一的实体读写接口。模块或外部插件定义并登记实体，再用 `DataOperator<T>` 显式读写；服主选择全服后端。

## 后端选择

在 UltiTools 的 `config.yml` 中将 `datasource.type` 设为 `sqlite`、`json` 或 `mysql`（区分大小写，不去除空格）。随包配置为 `sqlite`；若该键没有解析到值，则使用 `json`。选用 MySQL 时还需将 `mysql.enable` 设为 `true`，填写 `mysql.host`、`mysql.port`、`mysql.username`、`mysql.password` 和 `mysql.database`，并事先创建数据库。修改后重启服务器；切换后端不迁移既有数据。模块自身的配置与服务器的存储选择不同，参见[配置文件](./config-file)。

MySQL 连接池可选项也在 `mysql` 下：`connectionTimeout`（`30000`）、`keepaliveTime`（`60000`）、`maxLifetime`（`1800000`）以毫秒为单位，`maximumPoolSize` 为 `8`，`connectionTestQuery` 为 `select 1`。预处理语句缓存选项是 `cachePrepStmts`（`true`）、`prepStmtCacheSize`（`250`）与 `prepStmtCacheSqlLimit`（`2048`）；括号内为随包配置值。

| 后端 | 模块 | 外部插件 |
|---|---|---|
| SQLite | `plugins/UltiTools/sqliteDB/<模块名>.db` | 插件数据目录下的 `data.db` |
| JSON | `plugins/UltiTools/data/<模块名>/<表名>/<id>.json` | 插件数据目录下的 `data/<表名>/<id>.json` |
| MySQL | 共用 `mysql.database` 指定的数据库 | 同左，表名不自动添加插件前缀 |

若请求的后端不可用（例如 MySQL 未启用或连接池创建失败，或后端名称写错），框架改用 JSON。启动时的存储方式、后端降级和 MySQL 连接失败消息均按控制台语言显示。中文日志中的 `数据存储方式：<store>` 显示实际使用的后端；配置与实际不符时，服务器会记录以下 `SEVERE` 消息（尖括号为实际值的占位符）：

```text
数据存储降级：config.yml 里 datasource.type 配置为 '<configured>'，实际使用的是 '<actual>'。原因：<reason>
玩家数据将读写 '<store>' 存储；不同后端之间的数据并不互通，如果这不是你要的，请停服修正 config.yml 后重启
```

MySQL 连接池创建失败时还会记录 `Mysql数据库连接失败：<error>`。SQLite 默认等待写入锁最多 3000 毫秒，按单调时钟计时；读锁升级可能立即以 `SQLITE_BUSY` 失败。请缩短事务，不要由多个服务器共用或从外部修改运行中的 SQLite 文件。

## 创建实体类

### BaseDataEntity

创建一个继承 `BaseDataEntity<String>` 的类，并使用 `@Table` 和 `@Column` 注解来标记你的实体类。

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserData.java

`UserData` 示例用 Lombok 生成访问器、构造器、构建器以及 `equals` 和 `hashCode` 方法。下面是不依赖 Lombok 的完整实体，保存为 `PlayerNote.java`：

```java
package com.example.mymodule.data;

import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.Column;
import com.ultikits.ultitools.annotations.Table;

@Table("my_module_player_notes")
public class PlayerNote extends BaseDataEntity<String> {
    @Column("note_text")
    private String text;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}
```

将 `PlayerNote` 随所属模块打包。模块启用时，UltiTools 扫描该 JAR 中带 `@Table` 的类，将实体[登记到模块的数据作用域](#entity-registration)；这不是 IoC Bean 注册，也不受 `scanBasePackages` 限制。参见[实体扫描源码](https://github.com/UltiKits/UltiTools-Reborn/blob/1953187e750e736e46ed09f980bd4d2e8e4b54d7/src/main/java/com/ultikits/ultitools/manager/PluginManager.java#L2208-L2221)。

`BaseDataEntity<String>` 自带 `@Column("id")` 字段。`insert` 遇到空 ID 时，在 `onCreate()` 之前用 `setId` 填入 UUID 字符串；SQL 的 `id` 是主键，写入时从 `getId()` 取值，JSON 用 `getId()` 定位记录并命名文件。不要重新声明 `id` 字段；如果覆写其访问器，确保写入和读取使用同一个 ID。

| 方法 | 说明 |
|------|------|
| `onCreate()` | 在实体首次持久化之前调用 |
| `onUpdate()` | 在实体更新之前调用 |
| `onDelete()` | 在实体删除之前调用 |
| `onLoad()` | 在从数据存储加载实体后调用 |
| `validate()` | 默认返回 `true`；内置操作器不会自动调用这个实体校验钩子。 |
| `isNew()` | 实体无 ID 时返回 `true` |
| `copyWithoutId()` | 浅复制实体并清空副本的 ID；具体实体类须实现 `Cloneable`。 |

内置操作器在以下路径调用钩子：

| 钩子 | 调用方 |
|------|--------|
| `onCreate()` | `insert` 与 `insertAll`，对每个实体，在写入其字段之前 |
| `onUpdate()` | `update(entity)`、`updateAll`、`updateCounted` 与 `updateIf`，对传入的实体，在写入其字段之前，无论随后是否写入了行 |
| `onDelete()` | `delById` 与查询 DSL 的 `delete()`，对已储存的实体，在删除之前；没有任何行具有该 id 时不调用 |
| `onLoad()` | `getById`、`getAll`、`page`、`getLike`；对这些读取返回的每个实体调用。查询 DSL 可在加载后继续过滤或截取。 |

`update(column, value, id)`、`del(conditions)` 与 `exist(...)` 不调用实体生命周期钩子。

### AuditableDataEntity

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

插入设置 `created_at` 与 `updated_at`；若当前线程设置了用户，还会写入 `created_by` 与 `updated_by`。按实体更新时，更新 `updated_at`，有当前用户时也更新 `updated_by`，不改动创建时间和创建者。UltiTools 的注解命令会在执行玩家命令的线程上设置其 UUID，并在结束后恢复先前的值。其他入口（如监听器或调度任务）可按下文自行设置。

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
        .details("Player signed in")
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
if (entry != null && entry.wasModified()) {
    System.out.println("修改于 " + entry.getTimeSinceUpdate().getSeconds() + " 秒前");
}
```

::: info 空值安全
如果实体尚未持久化（缺少 `createdAt` 或 `updatedAt`），`getAge()` 和 `getTimeSinceUpdate()` 会返回 `null`。在调用返回的 `Duration` 上的方法前，务必检查 null。
:::

### @Table 注解

`@Table.value` 是 MySQL 或 SQLite 表名，也是 JSON 中实体所在的目录名。使用稳定、简单的名字（例如 `my_module_user_data`），不要使用 SQL 保留字或路径分隔符。MySQL 的表在同一个数据库里，因此不同插件不要使用同一个表名。

### @Column 注解

`@Column.value` 指定列名，可与 Java 字段名不同；查询时请使用映射列名。`@Column.type` 默认是 `VARCHAR(255)`，用于 SQL 建表，在 JSON 后端不控制字段类型。SQL 后端映射标注过的字段（包括继承字段），把非简单值写成 JSON 文本，不支持按内部字段查询。JSON 文件则由 Gson 序列化，以 Java 字段名为键；操作器把映射列名转回字段名，普通条件也能查询嵌套路径。为了跨后端可用，查询字段应使用简单类型与映射列名。

在 SQLite 中，默认的 `VARCHAR(255)` 列具有 TEXT 亲和性，因此 `int`、`long` 等数值字段会按文本储存，除非显式声明数值列类型。如果需要在 UltiTools 之外查询数据，请为新列声明数值类型。对已有的默认类型列手写 SQL 时，按数值比较或排序须用 `CAST` 转成数值，否则可能按文本顺序处理。SQLite 操作器仅在受支持的数值字段使用 `WhereCondition` 的 `GREATER` 或 `LESS` 时，才按 Java 字段类型添加数值 `CAST`；`EQUAL` 不做这项转换。查询 DSL 则在内存中对 Java 值执行 `gt`、`lt`、`gte`、`lte` 和 `orderBy`，`count()` 返回结果列表的大小。

## CRUD 操作

UltiTools 封装了一套语义化的 CRUD 操作 API，你只需要调用相应的方法，即可完成对数据的增删改查。

### DataOperator

模块调用已加载的 `UltiToolsPlugin` 实例的 `getDataOperator(Class<T>)`。以下示例使用随模块打包的 `UserData`：

<<< @/../examples/src/main/java/com/ultikits/docs/data/UserDataService.java

下面是 `PlayerNote` 的完整调用端，保存为同一包下的 `PlayerNoteStore.java`：

```java
package com.example.mymodule.data;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.interfaces.DataOperator;

public class PlayerNoteStore {
    private final DataOperator<PlayerNote> notes;

    public PlayerNoteStore(UltiToolsPlugin plugin) {
        this.notes = plugin.getDataOperator(PlayerNote.class);
    }

    public String addNote(String text) {
        PlayerNote note = new PlayerNote();
        note.setText(text);
        notes.insert(note);
        return note.getId();
    }

    public PlayerNote findNote(String id) {
        return notes.getById(id);
    }
}
```

请在框架为所属模块分配数据作用域后，从模块中调用 `new PlayerNoteStore(this)`，不要在模块构造函数中调用。把 `addNote` 返回的 ID 传给 `findNote`；找不到该 ID 的记录时返回 `null`。请在所属插件的生命周期内使用操作器，不要把旧模块实例的操作器交给替换后的实例。参见 [`UltiToolsPlugin#getDataOperator` 源码](https://github.com/UltiKits/UltiTools-Reborn/blob/1953187e750e736e46ed09f980bd4d2e8e4b54d7/src/main/java/com/ultikits/ultitools/abstracts/UltiToolsPlugin.java#L583-L598)。

### 实体登记 {#entity-registration}

- 模块启用时，框架会自动登记模块自身 JAR 中能加载且标有 `@Table` 的类。如果本模块的实体放在另一个库 JAR 中，可通过模块主类的 `@UltiToolsModule(additionalEntities = {UserData.class})` 补充登记；内置扫描仍然执行。
- 普通 Paper 插件在 `JavaPlugin.onEnable()` 中调用 `UltiToolsAPI.connect(this)`。框架自动扫描该插件自己的 JAR；若有放在库 JAR 中的自有实体，改用 `UltiToolsAPI.connect(this, UserData.class)`。连接后调用静态方法 `UltiToolsAPI.getDataOperator(this, UserData.class)`，不需要构造 `UltiToolsPlugin`。插件禁用时调用 `UltiToolsAPI.disconnect(this)`。详见[外部插件 API](../advanced/external-plugin-api)。
- 如果任一种补充登记方式指定了属于另一个已知插件的实体，登记会抛出带有 `ENTITY_NOT_OWNED`（`ULTI-3010`）的 `PluginModuleException`。模块因此加载失败；`UltiToolsAPI.connect` 则抛出以该异常为原因的 `IllegalStateException`。这是查询操作器之前的登记错误。跨插件访问请使用对方公开的服务或 `EventBus`，不要直接取其操作器。

当请求方已有作用域，但请求的实体类不在该作用域内，操作器入口抛出带 `ENTITY_NOT_OWNED`（`ULTI-3010`）的 `DataAccessException`。如果没有查到归属模块，`getMessage()` 的原文如下；如果查到了，则是第二种（占位符替换为实际值）：

```text
Entity <fully-qualified class name> is not registered to '<requesting plugin>' -- use the owning module's exposed service or the EventBus instead.
Entity <fully-qualified class name> belongs to module '<owner>', not '<requesting plugin>' -- use <owner>'s exposed service or the EventBus instead.
```

先确认实体类能加载、带 `@Table`，并随调用方打包或已补充登记。未加载模块的实例缺少作用域时也会用 `ULTI-3010` 拒绝，但不是上面这两种消息；从未连接的外部插件则收到 `IllegalStateException`：`Plugin <plugin name> is not connected to UltiTools`。错误码与格式化消息见[异常处理](../advanced/exception-handling)。

### 插入

```java
UserData entity = UserData.builder()
    .playerName("test")
    .balance(42.0)
    .build();
dataOperator.insert(entity);
```

`insert` 不是按 ID 覆盖：已有相同 ID 时，SQL 插入失败，JSON 保留已有记录。请用 `update` 修改既有记录。

### 查询

使用 `WhereCondition`：

```java
List<UserData> list = dataOperator.getAll(
    WhereCondition.builder()
        .column("player_name")
        .value("test")
        .build()
);
```

或按 ID 获取单个实体：

```java
UserData entity = dataOperator.getById("some-id");
```

获取所有实体：

```java
List<UserData> all = dataOperator.getAll();
```

分页查询：

```java
List<UserData> page = dataOperator.page(1, 10); // 第 1 页，每页 10 条
```

::: warning JSON 无条件分页
JSON 的 `page(int, int)` 返回空列表，而 MySQL 和 SQLite 会用 `LIMIT ? OFFSET ?` 查询。需要跨后端分页时，请提供实际条件，或使用 `getAll()` 再切片；不要用 `WhereCondition.empty()` 代替无条件分页，因为 SQL 后端的 `page` 会拒绝它。
:::

::: tip 查询 DSL
使用[流式查询 DSL](./query-dsl)可串接查询条件：

```java
UserData entity = dataOperator.query()
    .where("player_name").eq("test")
    .first();
```
:::

### 更新

更新单个字段：

```java
dataOperator.update("player_name", "newName", entityId);
```

使用实体对象更新：

```java
try {
    entity.setPlayerName("newName");
    dataOperator.update(entity);
} catch (IllegalAccessException e) {
    // 处理异常或继续向上抛出
}
```

该重载声明了受检异常 `IllegalAccessException`，调用方需要声明或捕获它。

读取返回的实体与已储存的数据彼此独立，插入后继续修改原对象也不会改变储存内容。修改字段后必须显式写回。

`update(T)`、`update(column, value, id)`、`delById` 与 `updateAll` 拒绝 `null` ID，抛出 `DataAccessException`；`updateAll` 在写入之前检查全部实体。

按不存在的 ID 更新不会插入新记录。SQL 记录 `Update of table '<table>' matched no row with id '<id>'; nothing was written.`，JSON 将 `row` 换为 `entry`。调用 `updateCounted(entity)` 获取更新数：

```java
if (dataOperator.updateCounted(entity) == 0) {
    // 这一行已被其他写入方删除：没有写入任何内容。
}
```

框架之外的 `DataOperator` 实现如果没有覆写 `updateCounted`，按更新之前是否存在具有该 id 的行计数。

### 条件更新

`updateIf(entity, expected...)` 只在已储存的记录满足全部预期条件时写入，并返回是否写入。它会写回整份映射实体，不只写入条件中的字段。下面示例假定账户除了 ID 只映射 `balance`；若还映射其他可变列，也应检查这些列的旧值，避免用旧快照覆盖并发修改。

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

在 MySQL 与 SQLite 上，检查与写入是同一条 `UPDATE ... WHERE id = ? AND <条件>` 语句。共用 MySQL 数据库的服务器也能使用这个原子检查；不要共用运行中的 SQLite 文件。在 JSON 后端上，检查与写入在表锁下一起完成；JSON 储存只属于一台服务器。条件的含义与 `getAll(WhereCondition...)` 中相同。

没有任何一行同时具有该实体的 id 并满足全部条件时，`updateIf` 返回 `false`，不写入任何内容；id 为 `null`、条件为 `null`、条件使用了实体没有用 `@Column` 映射的列，或在默认 `EQUAL` 以外的比较下条件的值为 `null` 时，各个后端都抛出 `DataAccessException`。默认比较下的 `null` 期望值表示 `IS NULL`（JSON：字段不存在或为 JSON null），因此对读取时仍未设置的列做比较后写入时，若其间另一个写入方已写入该列，本次写入不生效；这一含义只属于 `updateIf`（[#640](https://github.com/UltiKits/UltiTools-Reborn/issues/640)）。框架之外的 `DataOperator` 实现如果没有实现它，会抛出 `UnsupportedOperationException`。

MySQL 默认文本列和 JSON 的数值 `EQUAL` 可能同时匹配超出 ±9,007,199,254,740,992（2^53）的相邻整数，因此 `updateIf` 的前提也可能匹配不同于先前读到的值。不要把这类数字用作要求精确匹配的比较后写入（CAS）标记。MySQL 需要精确整数相等时声明 `type = "BIGINT"`；JSON 的条件求值映射已把数字转换为 `double`，声明数值列类型不能恢复精确匹配。

### 删除

按 ID 删除：

```java
dataOperator.delById(entityId);
```

按条件删除：

```java
dataOperator.del(
    WhereCondition.builder()
        .column("player_name")
        .value("test")
        .build()
);
```

### WhereCondition

`WhereCondition` 用于指定查询条件。

```java
WhereCondition.builder().column("somecol").value(someval).build();
```

`column` 是映射列名，`value` 是用于比较的值。`comparison` 的默认值是 `Comparison.EQUAL`；多个条件之间取逻辑与。

#### 比较方式

`EQUAL` 匹配相等的值，`GREATER` 和 `LESS` 为严格大于和小于。

- `INCLUDE`、`STARTSWITH` 和 `ENDSWITH` 在所有后端都把值作为文本字面匹配：`%`、`_`、`!` 和 `\` 都是普通字符，不是通配符或转义符。`Query#like` 见[查询 DSL](./query-dsl)。
- [`getLike`](#getlike) 是独立的方法，匹配模式和参数检查与上述比较不同。
- 上述三种 `WhereCondition` 字面比较对字母大小写和重音的处理取决于后端：SQLite 只忽略 ASCII 字母的大小写；MySQL 按框架建表时使用的 `utf8mb3_general_ci` 排序规则比较，同时忽略大小写和重音（`é` 能匹配 `e`）；JSON 精确比较。
- `GREATER` 和 `LESS` 用于 `byte`、`short`、`int`、`long`、`float` 或 `double` 字段（或其包装类型）时，在 SQLite 和 JSON 上按该字段类型的数值比较。请以该类型的数字传值（`10`，而不是 `"10"`）：在 MySQL 上字符串值按文本比较，于是 `"10"` 排在 `"2"` 之前。在 SQLite 上，列保持默认 `VARCHAR(255)` 类型时同样按类型比较，整数保持 64 位精度，所存的值按读回时的值比较：`0.1f` 这样的 `float` 既不大于也不小于 `0.1f`。这种按读回值的比较只适用于有限数字的值；超出 `double` 范围的数字以及任何文本都按绑定时的值比较。无穷大或 NaN 值会被拒绝（见下文“null 与非有限条件值”）。
- 在 MySQL 上，留在默认文本列中的数值字段按双精度比较，在 ±9,007,199,254,740,992（2^53）以内精确，超出则只是近似。需要精确结果时，请为该列声明数值 `type`，例如 `BIGINT`。在 JSON 上按 `double` 比较，超出 2^53 时同样是近似的。
- 已知限制：在 SQLite 上，默认列中的 `double` 只保存 15 位有效数字，因此 `1/3.0` 读回和比较都按 `0.333333333333333`；要保留全部数字，请声明 `type = "DOUBLE"`。手工写入数值字段列的非数字文本，在 SQLite 上按其开头的数字比较（`'abc'` 为 0，`'12abc'` 为 12），JSON 则按文本比较。在 SQLite 上，与所存 `float` 前 15 位有效数字相同、之后才不同的任何数值（例如 10^15 及以上的整数如 `(1L << 53) + 1`，或有 16 位及以上有效数字的小数）会被视为与它相等，默认列和 `REAL` 列都如此；对 `float` 字段请传 `float` 值。

#### null 与非有限条件值

`getAll`、`exist`、`page`、`del` 与 `updateIf` 在 SQLite、MySQL 和 JSON 上一致地拒绝值为 `null`（任何比较方式）或为无穷大、NaN 的 `Double`/`Float` 的条件：在读取、删除或写入之前抛出带 `DATA_ENTITY_INVALID`（`ULTI-3007`） 的 `DataAccessException`。唯一例外是 `updateIf` 中 `EQUAL` 下的 `null` 值，它表示 `IS NULL`。`del(WhereCondition.empty())` 在所有后端同样被拒绝（[#815](https://github.com/UltiKits/UltiTools-Reborn/issues/815)、[#696](https://github.com/UltiKits/UltiTools-Reborn/issues/696)）。构造条件前请判空或用 `Double.isFinite` 检查。

#### getLike {#getlike}

`getLike(column, value, likeType)` 使用 `DataOperator.LikeType.START` 匹配前缀、`END` 匹配后缀、`CONTAINS` 匹配子串。内置后端对同一组参数的处理不同：

| 后端 | 匹配模式与规则 |
|---|---|
| MySQL | SQL `LIKE` 分别使用 `value%`、`%value`、`%value%`。`value` 中的 `%` 匹配零个或多个字符，`_` 匹配一个字符。框架不添加 `ESCAPE` 子句，也不转义传入的值；MySQL 按其转义规则（默认用反斜杠转义）和排序规则匹配。 |
| SQLite | SQL 模式和通配符与 MySQL 相同。没有 `ESCAPE` 子句时，反斜杠是普通字符。SQLite 默认的 `LIKE` 只忽略 ASCII 字母的大小写，区分非 ASCII 字母的大小写。 |
| JSON | 分别使用 Java 的 `startsWith`、`endsWith`、`contains`，区分大小写；`%`、`_` 和反斜杠都是普通字符。操作器会解析映射列名，或读取传入的 Java 字段路径（嵌套路径以点分隔），用 `toString()` 将非空值转为文本，跳过缺失或值为 `null` 的字段。 |

在 MySQL 和 SQLite 上，匹配模式通过 JDBC 参数绑定，但 `column` 原样进入 SQL，不像 `WhereCondition` 那样检查它是否在实体的 `@Column` 映射中。只传入代码中固定的列名，或从固定的允许列表中选择列名；不要把用户输入直接作为 `column`。若数据库拒绝未知列名，会抛出带 `DATA_OPERATION_FAILED`（`ULTI-3008`）的 `DataAccessException`，其 `getMessage()` 原文为 `Failed to query with LIKE`。`column` 为 `null` 不会被拒绝，而是成了 SQL 的 `NULL` 操作数，不匹配任何记录。JSON 同样不检查列名是否在映射中，找不到路径或路径为 `null`、空字符串时无匹配结果。

不要给 `value` 或 `likeType` 传入 `null`。SQL 后端会把 `null` 值拼成文本 `null`（例如 `CONTAINS` 得到 `%null%`），而不是查找 SQL `NULL`；若 `likeType` 为 `null`，则在执行 SQL 前抛出 `NullPointerException`。在 JSON 上，只有遇到指定路径上有非 `null` 值的记录时，`value` 或 `likeType` 为 `null` 才会抛出 `NullPointerException`；否则返回空列表。空字符串不会被拒绝：在 SQL 上会生成匹配任意非 `NULL` 值的模式，在 JSON 上匹配指定路径下所有非 `null` 的值。

需要在各后端按字面匹配前缀、后缀或子串时，请改用 `WhereCondition` 的 `STARTSWITH`、`ENDSWITH` 或 `INCLUDE`；大小写与重音处理仍取决于后端。参见 [SQL 共用实现](https://github.com/UltiKits/UltiTools-Reborn/blob/1953187e750e736e46ed09f980bd4d2e8e4b54d7/src/main/java/com/ultikits/ultitools/interfaces/impl/data/AbstractRelationalDataOperator.java#L842-L863)和 [JSON 实现](https://github.com/UltiKits/UltiTools-Reborn/blob/1953187e750e736e46ed09f980bd4d2e8e4b54d7/src/main/java/com/ultikits/ultitools/interfaces/impl/data/json/SimpleJsonDataOperator.java#L635-L670)。

### 事务

对于需要同时成功或同时失败的操作，请参阅[事务](/zh/guide/advanced/transactions)指南。

::: tip MySQL 与 SQLite 在一个 JDBC 事务中执行这段代码
MySQL 与 SQLite 在一个 JDBC 事务中执行回调。
JSON 暂存回调中的写入，并作为一次事务提交。
:::

```java
dataOperator.transaction(() -> {
    dataOperator.insert(entity1);
    dataOperator.insert(entity2);
    // 全部插入或全部不插入
});
```

在 JSON 后端上，由 `transaction(...)` 开启的事务在第一次读取或写入某张表时就锁住它，所以其中的“先读后写”不会丢失更新；其中的读取可能为等待持有该表的另一个事务而停顿，最多 5 秒。在默认隔离级别的 `@Transactional` 方法中，“先读后写”则改用 `updateIf` 或 `isolation = REPEATABLE_READ`，见[JSON 事务行为](/zh/guide/advanced/transactions#json-事务行为)。

事务自身的失败路径再失败时不会隐式提交（[#634](https://github.com/UltiKits/UltiTools-Reborn/issues/634)）：回滚或提交失败时，连接被丢弃（HikariCP 连接池会将其剔除），而不是重新打开自动提交（那样会提交该事务），框架也不会重试提交。之后保存了什么，取决于失败发生在哪里：

- 操作失败且回滚成功时，未保存任何写入。
- SQLite 或 MySQL 的回滚失败时（包括外层提交为仅回滚的事务执行的真正回滚），框架不发出提交。
- 提交因事务已被标记为仅回滚而抛出 `UnexpectedRollbackException` 时，事务已回滚，其写入均未保存，所有后端都是如此。
- SQLite 或 MySQL 的提交本身失败（`DataAccessException`，`TRANSACTION_FAILED`）时，结果未知：数据库可能在确认丢失之前已经应用了该提交（例如 MySQL 连接断开），丢弃连接无法撤销它。不能重复写入的代码（例如支付、奖励）在重试前应先重新读取数据，或使用 `updateIf`。
- 在 JSON 上，失败的提交不会提交任何内容。

调用方收到原来的异常；事务被标记为仅回滚时收到 `UnexpectedRollbackException`。`transaction(...)` 中抛出的 `Error` 会使事务回滚（JSON 引擎丢弃暂存的写入），并原样抛出同一个实例。

## JSON 存储的取舍

- Windows 和 macOS 上的持久性覆盖服务器进程崩溃，不保证断电或操作系统崩溃后最后几次完整提交不丢失。请按需要的保证选择存储与备份，不要把 Linux 行为推广为跨平台断电保证。
- 有改动的提交在提交线程上同步强制刷新日志，该线程常是服务器主线程。世界保存等磁盘争用可能增加 tick 延迟；频繁事务选择 JSON 时应计入这一成本。
- Windows 的移动重试不包括删除：文件被占用会使本次刷新失败，下次刷新再尝试。应查看失败并解除外部占用，不要认为 150 毫秒移动重试覆盖所有文件操作。
- 直接构造的操作器各有独立的存储身份及相邻的 `<表目录>.ultitools-journal`；共同的父目录不会把分别构造的操作器组成一个事务。需要协调同一插件的多张表时，使用框架管理的操作器。
- 同线程的 `REQUIRES_NEW` 和 `NOT_SUPPORTED` 工作不会等待被挂起调用方持有的线程级表锁。两者写同一键时，外层提交可能替换内层结果；不要把挂起理解为对该键独立加锁。
- JDBC 与 JSON 的超时不同：JDBC 预算耗尽后仍允许语句以一秒查询超时执行；JSON 拒绝期限后的操作，并标记仅回滚。等待锁的 JSON 读取也使用 `JSON write failed ...` 错误前缀。应处理失败和回滚状态，不要根据 “write” 一词认定调用就是写入。见[超时配置](/zh/guide/advanced/transactions#超时配置)。
- JSON 保留原始 `<id>.json` 名称，没有版本化的可移植编码或自动迁移。Windows 禁用的字符在 Linux 上可能有效。迁移前请检查已有 ID，而不是删除记录来绕过限制。
- 只有大小写不同的 id 在不区分大小写的文件系统上会冲突。设备名检查不在所有平台上一律禁止 `COM0` 或 `LPT0`，也不保证所有 Windows 工具或提供者均支持它们。优先使用 UUID id；不要以为字符检查能让任意名称跨平台可用。

## JSON 存储的运维

每个插件的 JSON 表旁边都有一个隐藏的 `.ultitools-journal` 文件夹。已提交的事务在 `commit` 返回前写入日志并强制落盘；恢复时重放到表文件。模块的日志位于 `plugins/UltiTools/data/<模块名>/.ultitools-journal`；外部插件的日志位于其数据目录下的 `data/.ultitools-journal`。详见[JSON 事务行为](../advanced/transactions#json-事务行为)。

自 v7.0.0 起，JSON 使用异步调度按墙钟时间周期落盘。`datasource.flushRate` 的单位为秒：正数设置周期，缺省或 `0` 时使用 `10` 秒，负数禁用周期落盘。正常停服仍尝试最后一次落盘；修改该值后需重启。

- 一个数据文件夹只运行一个服务器进程：两个服务器绝不能同时使用同一个 `plugins` 数据文件夹。
- 备份时把 `.ultitools-journal` 文件夹与各表文件夹一起备份，或者在服务器停止时备份。`cp dir/*` 这类复制会跳过以点开头的文件夹。
- 永远不要删除 `.ultitools-journal`，崩溃之后也不要：里面保存着尚未写入表文件的提交。
- 崩溃之后，手工编辑任何 JSON 数据文件之前先启动一次服务器：启动会重放日志，并会覆盖你的编辑。
- 断电后发现最新的日志记录损坏，通常说明磁盘或其控制器没有遵守刷盘请求。该插件的 JSON 数据会保持关闭，直到你把指明的文件移出日志文件夹并重启服务器。在加载时就获取数据操作器的模块会在那次启动时被拒绝加载；只有在加载完成之后才首次请求数据的插件，会在下一次请求时恢复，无需重启。
- 某个实体文件持续无法移动（例如被其他程序一直锁着）会使该插件的每次刷新都无法清空日志：记录不断累积，启动恢复变慢，每次失败的刷新都会出现在服务器日志里。
- 在 Windows 上，被其他程序（杀毒软件、索引器、备份工具）短暂占用的日志文件移动，最多重试 150 毫秒，之后提交失败。
- id 中含 `<`、`>`、`:`、`"`、`|`、`?` 或 `*` 的 JSON 数据文件夹无法从 Linux 复制到 Windows：Windows 无法创建这些文件。id 只有大小写不同的数据也无法迁移到 Windows 或默认设置的 macOS 卷：文件会互相冲突。若含这类 id 的日志记录到了 Windows 服务器上，启动时该插件的 JSON 数据会保持关闭，错误信息指明该记录：请在写下它的 Linux 服务器上应用它，或把它移出日志文件夹并放弃其中的改动。
- 新 id 在创建时检查，已有文件绝不会被改名，见 [JSON 实体 id](/zh/guide/advanced/transactions#json-实体-id)。普通 UUID 字符串是可移植的 id；小写字母、数字、`-` 和 `_` 仅在该 id 不是 Windows 设备名（`con`、`nul`、`aux`、`prn`、`com1`–`com9`、`lpt1`–`lpt9`）时才安全。不要用玩家名作为实体 id（`Con` 和 `Nul` 都是合法的玩家名）。这些规则会拒绝的已有 id 仍可读取、`update` 和删除，但删除后再插入会被拒绝：请用 `update` 替换。

## 物品存档

自 v7.0.0 起，`ItemStackUtils` 将 Paper 物品字节编码为 Base64 后写入；读取仍接受 6.x 工具写出的旧 Bukkit 对象流，也接受换行的 Base64。6.x 读不了 7.0 新写出的格式。保留五个公开方法：`serializeItems`、`deserializeItems`、`serializeItem`、`deserializeItem` 和 `isValidSerialized`。数组读取保留空槽为 `null`；单物品读取返回 `null` 可能是空槽，也可能是读取失败。只读取可信的服务器数据。转换失败时以 `SEVERE` 记录 `Failed to serialize ItemStack array` 或 `Failed to deserialize ItemStack array` 并返回 `null`。升级前备份物品和背包存档，不要在读取失败后用空背包覆盖原数据。详见[物品构造和存储](../advanced/upgrading-to-7#item-migration)。
