::: warning 🚧 This page is under construction

The translation of this page is not finished yet.

:::

# 数据储存

UltiTools 封装了一套数据储存 API，它支持 MySQL 数据库与 JSON 文件储存，开发者只需为存储方式写一套代码，UltiTools将通过服主的配置判断使用那种存储方式。

你需要的仅仅只是一个实体类。CRUD 操作将由 UltiTools 自动完成。

::: warning 尽量不要嵌套对象
由于插件还处于开发状态，难免在处理复杂对象时出现问题，所以存储的对象尽量不要超过两层嵌套（尽量不要嵌套对象）。
:::

## 创建实体类

你只需要创建一个类，继承 `AbstractDataEntity` 类，并使用 `@Table` 和 `@Column` 注解来标记你的实体类。

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("some_table")
public class SomeEntity extends AbstractDataEntity {
    @Column(value = "something", type = "FLOAT")
    private double something;
}
```

其中，`@Table` 注解用于标记该类对应的数据表（若使用 MySQL 数据库），`@Column` 注解用于标记该类的字段对应的数据表的列。

`@Data`、`@Builder`、`@NoArgsConstructor`、`@AllArgsConstructor`、`@EqualsAndHashCode` 则为 Lombok 注解，用于自动生成 `getter`、`setter`、`builder`、`equals`、`hashCode` 方法。

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
DataOperator<SomeEntity> dataOperator = SomePlugin.getInstance().getDataOperator(SomeEntity.class);
```
DataOperator 的具体使用方法请参阅 Java Doc

::: warning 请即取即用

`DataOperator` 不是线程安全的，请在需要的时候获取 `DataOperator`，不要试图保存 `DataOperator` 对象。

:::


### WhereCondition

`WhereCondition` 用于指定查询条件。

```java
WhereCondition.builder().column("somecol").value(someval).build();
```

其中，`column` 属性用于指定查询的列，`value` 属性用于指定查询的值。

与 `DataOperator` 搭配使用的例子：

```java
DataOperator dataOperator = SomePlugin.getInstance().getDataOperator(SomeEntity.class);
List<Something> list = dataOperator.getAll(WhereCondition.builder().column("somecol").value(someval).build());
```
