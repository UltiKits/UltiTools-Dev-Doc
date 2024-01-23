# Data Storage

UltiTools encapsulates a data storage API that supports MySQL database and JSON file storage. 
Data storage is transparent to developers, and UltiTools will determine which storage method 
to use based on the server owner's configuration.

All you need is an entity class. CRUD operations will be done automatically by UltiTools.

::: warning Try not to nest objects
Since the API is still under development, there may be problems when dealing with complex objects, so try not to nest objects.
:::

## Create entity class

All you need is to create a class that inherits the `AbstractDataEntity` class, and use the `@Table` and `@Column` annotations to mark your entity class.

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

`@Table` is used to mark the data set corresponding to the class, and `@Column` is used to mark the field corresponding to the field of the data set of the class.

`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@EqualsAndHashCode` are Lombok annotations, which are used to automatically generate `getter`, `setter`, `builder`, `equals`, `hashCode` methods.

### @Table

`@Table` annotation has a `value` attribute, which is used to specify the name of the data set corresponding to the class.

### @Column

`@Column` annotation has three attributes, `value` attribute is used to specify the column of the data set corresponding to the field, `type` attribute is used to specify the type of the column of the data set corresponding to the field.

The default value of the `type` attribute is `VARCHAR(255)`.

Available types can be found in [MySQL Data Types](https://www.w3schools.com/mysql/mysql_datatypes.asp).

## CRUD Operations

UltiTools encapsulates a semantic CRUD operation API. You only need to call the corresponding method to complete the addition, deletion, modification and query of the data.

### DataOperator

`DataOperator` is used for data operations.

In the main class that inherits `UltiToolsPlugin`, there is a `getDataOperator` method to get the data operator.

You need to get the instance of the module main class, and then call the `getDataOperator` method.

```java
DataOperator<SomeEntity> dataOperator = 
        SomePlugin.getInstance().getDataOperator(SomeEntity.class);
```

::: warning

`DataOperator` is not thread-safe. Please get `DataOperator` when you need it, and do not try to save `DataOperator` object.

:::


### WhereCondition

`WhereCondition` is used to specify the query condition.

```java
WhereCondition.builder().column("somecol").value(someval).build();
```

`column` is used to specify the column to be queried, and `value` is used to specify the value to be queried.

Example of using with `DataOperator`:

```java
DataOperator dataOperator = 
        SomePlugin.getInstance().getDataOperator(SomeEntity.class);
List<Something> list = dataOperator.getAll(
        WhereCondition.builder()
                .column("somecol")
                .value(someval)
                .build()
);
```
