# 数据储存

UltiTools 封装了一套数据储存 API，它支持 MySQL 数据库、SQLite 数据库（6.1.0起）与 JSON 文件储存。数据存储对于开发者来说是透明的，UltiTools将通过服主的配置判断使用哪种存储方式。

你需要的仅仅只是一个实体类。CRUD 操作将由 UltiTools 自动完成。

::: warning 尽量不要嵌套对象
由于插件还处于开发状态，难免在处理复杂对象时出现问题，所以存储的对象尽量不要超过两层嵌套（尽量不要嵌套对象）。
:::

## 创建实体类

### AbstractDataEntity

你只需要创建一个类，继承 `AbstractDataEntity` 类，并使用 `@Table` 和 `@Column` 注解来标记你的实体类。

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("some_table")
public class SomeEntity extends AbstractDataEntity {
    @Column("name")
    private String name;
    @Column(value = "something", type = "FLOAT")
    private double something;
}
```

其中，`@Table` 注解用于标记该类对应的数据表（若使用 MySQL 数据库），`@Column` 注解用于标记该类的字段对应的数据表的列。

`@Data`、`@Builder`、`@NoArgsConstructor`、`@AllArgsConstructor`、`@EqualsAndHashCode` 则为 Lombok 注解，用于自动生成 `getter`、`setter`、`builder`、`equals`、`hashCode` 方法。

### BaseDataEntity <Badge type="tip" text="v6.2.0+" />

从 v6.2.0 开始，你还可以使用 `BaseDataEntity`，它提供了类型安全的泛型 ID 和生命周期钩子：

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("some_table")
public class SomeEntity extends BaseDataEntity<Integer> {
    @Column("name")
    private String name;
    @Column(value = "something", type = "FLOAT")
    private double something;

    @Override
    public void onCreate() {
        // 首次插入前调用
    }

    @Override
    public boolean validate() {
        return name != null && !name.isEmpty();
    }
}
```

`BaseDataEntity<ID>` 继承了 `AbstractDataEntity`，额外提供：

| 方法 | 说明 |
|------|------|
| `onCreate()` | 在实体首次持久化之前调用 |
| `onUpdate()` | 在实体更新之前调用 |
| `onDelete()` | 在实体删除之前调用 |
| `onLoad()` | 在从数据存储加载实体后调用 |
| `validate()` | 实体有效返回 `true` |
| `isNew()` | 实体无 ID 时返回 `true` |
| `copyWithoutId()` | 创建不含 ID 的实体副本 |

### AuditableDataEntity <Badge type="tip" text="v6.2.0+" />

对于需要跟踪创建和修改的实体，可以使用 `AuditableDataEntity`：

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("audit_log")
public class AuditEntry extends AuditableDataEntity<Integer> {
    @Column("action")
    private String action;
    @Column("details")
    private String details;
}
```

`AuditableDataEntity<ID>` 继承了 `BaseDataEntity<ID>`，自动管理以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `createdAt` | `LocalDateTime` | 实体创建时间（在 `onCreate()` 中自动设置） |
| `updatedAt` | `LocalDateTime` | 上次修改时间（在 `onUpdate()` 中自动更新） |
| `createdBy` | `UUID` | 创建实体的用户 ID（从线程本地上下文获取） |
| `updatedBy` | `UUID` | 上次修改实体的用户 ID（从线程本地上下文获取） |

所有这四个字段都已预配置 `@Column` 注解，子类中无需声明。

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
AuditEntry entry = op.getById(1);
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

`@Column` 注解有三个属性，`value` 属性用于指定该字段对应的数据表的列，`type` 属性用于指定该字段对应的数据表的列的类型。

type 属性的默认值为 `VARCHAR(255)`。

可用的类型可参见 [MySQL 数据类型](https://www.runoob.com/mysql/mysql-data-types.html)。

## CRUD 操作

UltiTools 封装了一套语义化的 CRUD 操作 API，你只需要调用相应的方法，即可完成对数据的增删改查。

### DataOperator

`DataOperator` 用于数据操作。

在继承了 `UltiToolsPlugin` 的主类中，有一个 `getDataOperator` 方法，用于获取数据操作器。

你需要获取插件主类的实例，然后调用 `getDataOperator` 方法。

```java
DataOperator<SomeEntity> dataOperator =
        SomePlugin.getInstance().getDataOperator(SomeEntity.class);
```

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
SomeEntity entity = dataOperator.getById(1);
```

获取所有实体：

```java
List<SomeEntity> all = dataOperator.getAll();
```

分页查询：

```java
List<SomeEntity> page = dataOperator.page(1, 10); // 第 1 页，每页 10 条
```

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
entity.setName("newName");
dataOperator.update(entity);
```

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

```java
dataOperator.transaction(() -> {
    dataOperator.insert(entity1);
    dataOperator.insert(entity2);
    // 全部插入或全部不插入
});
```
