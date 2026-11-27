# 异常处理

7.0.0 尚未发布。本指南介绍 7.0 预览版的行为，另见[更新说明](../release-notes/7.0.0)和[从 6.x 升级到 7.0](./upgrading-to-7)。

当受管 Bean 的方法遇到预期故障后可以返回合适的后备值时，可以使用 `@ExceptionCatch`。框架通过 Bean 的代理拦截调用。注解不会改变 Java 对受检异常的要求。

## 基本用法

在受管 Bean（如 `@Service`）的可覆盖实例方法上添加 `@ExceptionCatch`：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/FileService.java

默认情况下，拦截器捕获 `Exception` 及其子类，不捕获 `Error`。它以 `WARNING` 级别记录捕获的异常，在错误收集器可用时将异常提交给收集器，再按声明的返回类型返回默认值。本例返回 `null`。

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `Class<? extends Throwable>[]` | `{Exception.class}` | 要捕获的异常类型。子类会自动被包含。 |
| `silent` | `boolean` | `false` | 抑制捕获异常时的警告，不影响错误上报或处理器诊断。 |
| `handler` | `String` | `""` | 自定义异常处理器 Bean 的名称。该 Bean 必须实现 `ExceptionHandler` 接口。 |
| `defaultValue` | `String` | `""` | 未调用自定义处理器时使用的后备值表达式。 |

## 捕获特定异常

指定应该被捕获的异常类型：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/DataService.java

辅助方法是占位实现。接入实际的文件或数据库操作时，按 Java 的要求声明受检异常。匹配依据是抛出的异常本身，而不是它的原因：包装了 `IOException` 的非受检异常不匹配 `IOException.class`。

::: tip 异常继承关系
当指定异常类型时，框架也会捕获其子类。例如，`@ExceptionCatch(IOException.class)` 会捕获 `FileNotFoundException`、`EOFException` 等 IOException 的子类。
:::

## 静默模式

对于已预期的或非关键异常，禁用日志记录：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/ConfigService.java

`silent = true` 只抑制拦截器的 `WARNING` 消息 `Exception caught in <Bean>.<method>(): <message>` 及该条日志附带的异常。错误上报、处理器查找警告和处理器自身的日志不受影响。示例中的第一个方法仍不捕获 `Error`。

何时使用 `silent = true`：
- 非关键操作（如可选备份）
- 后备逻辑（如文件未找到时使用默认值）
- 异常是预期的操作

## 错误上报

启用错误上报后，收集器按具体 Bean 类所在的 JAR 识别已加载模块，即使 Bean 是代理实例或方法来自父类。没有唯一匹配时，报告不带模块归属。收集器按错误指纹和模块标识去重、采样，并按网关限制截断报告文本。详见[面板集成](./panel-integration)。

在数据操作中，`DataAccessException` 和 `UnexpectedRollbackException` 都继承 `UltiToolsException`，后者继承 `RuntimeException`。这两种异常都不是 `SQLException` 的子类，`UnexpectedRollbackException` 也不是 `DataAccessException` 的子类。请用 `getErrorCode()` 区分框架错误，不要解析消息。`getFormattedMessage()` 返回 `[ULTI-xxxx] <message>`，`getMessage()` 不会加上错误码前缀。

- `ULTI-3010`（`ENTITY_NOT_OWNED`）：请求的实体未登记到调用模块或外部插件，或模块、已接入的外部插件没有数据作用域。尚未接入的外部插件会收到 `IllegalStateException`。登记方法和拒绝消息见[数据储存](../essentials/data-storage)。这是配置或归属问题，不表示查不到某一行。
- `ULTI-3009`（`TRANSACTION_ROLLBACK_ONLY`）：最外层提交时发现事务已被标记为只能回滚，因此执行回滚。异常原文为 `Transaction was marked rollback-only by <origin>; the outer commit() performed a real rollback instead of committing.`，另见[事务](./transactions)。

## 默认返回值

控制异常被捕获时返回的值：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MoneyService.java

省略 `defaultValue` 或将其设为 `""` 时，引用类型（包括包装类型、字符串和集合）返回 `null`，`boolean` 返回 `false`，`char` 返回 `\0`，数值原始类型返回零。`void` 方法没有返回值。示例中的 `int` 和 `boolean` 表达式显式指定了与类型默认值相同的结果；`"empty"` 则让 `List` 返回空列表而不是 `null`。

| 表达式 | 结果 |
|---|---|
| `"null"`、`"true"`、`"false"` | 对应的空值或布尔值，只能用于相容的返回类型。 |
| 数字字面量 | 为 `int`、`long`、`float`、`double` 及其包装类型解析。解析失败或数值类型不受支持时，使用类型默认值。 |
| `"empty"` | 可用于 `String`、数组、`List`、`Set`、`Map`、`Collection` 或 `Optional`。集合由拦截器提供 `ArrayList`、`HashSet` 或 `HashMap`，不要假定它能返回 `LinkedList` 等特定实现类型。 |
| `String` 方法上的其他文本 | 原样返回，例如 `"0"` 返回字符串 `"0"`。 |

::: warning defaultValue 类型匹配
框架先去除首尾空白并忽略大小写匹配保留字 `null`、`true`、`false`、`empty`，再处理数字或字符串。例如 `"false"` 会得到布尔值，而不是字符串 `"false"`。数值解析使用原始字符串：`int` 和 `long` 不接受首尾空格，遇到时使用类型默认值；`float` 和 `double` 接受首尾空白。
:::

## 自定义异常处理器

通过创建 `ExceptionHandler` Bean 来实现自定义异常处理逻辑：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/LoggingExceptionHandler.java

注册并通过名称引用处理器：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MyService.java

拦截器从该 Bean 的容器按名称查找 `loggingExceptionHandler`。仅注册处理器 Bean 不会将其设为全局处理器。如果按名称查找时抛出异常，或查到的值未实现 `ExceptionHandler`，拦截器会发出警告，并使用 `defaultValue` 或类型默认值。成功调用处理器时，以其返回值为准，即使返回值是 `null`；该值必须与方法的返回类型相容。处理器抛出的异常会继续传播，不会改用后备值，包括受检异常或处理器自身故障。

::: tip 处理器接口
`handleException(Throwable, Object, Method, Object[])` 返回 `Object`，并声明 `throws Throwable`。
`supports(Class<? extends Throwable>)` 默认返回 `true`，`getOrder()` 默认返回 `0`；按名称指定处理器时不调用这两个方法，由注解的 `value` 决定哪些异常交给处理器。
:::

## 方法要求

`@ExceptionCatch` 要求 Bean 由 IoC 容器创建并代理。代理就是 Bean 实例，因此 Bean 内部对自身可覆盖方法的虚调用也能被拦截。

```java
@Service
public class MyService {

    @ExceptionCatch  // 正确 - 方法在受管理的 @Service Bean 中
    public void safeOperation() {
        // ...
    }
}

public class NonManagedClass {

    @ExceptionCatch  // 错误 - 此类不是 Bean
    public void unsafeOperation() {
        // 注解无效
    }
}
```

使用扫描注册的 `@Service`、`@Component` 等组件，或通过 `registerBean(Class, …)` 注册类定义。自行构造的实例不会被代理：`registerSingleton` 拒绝带有 AOP 注解的预构造实例，`registerType` 只绑定传入实例，不提供拦截。

在既不是 `final` 也不是 `sealed` 的类中使用可覆盖的实例方法。`private`、`static`、`final` 方法和声明在其他包中的包私有方法均不能被拦截。对于无法拦截的方法，框架发出警告并忽略该方法上的注解。如果 `final` 或 `sealed` 类中存在本应拦截的方法，代理创建会抛出 `ContainerException`（`ULTI-2000`，`BEAN_CREATION_FAILED`）。自 v7.0.0 起，框架会显式检查密封类。

也可以给类添加注解。对于可拦截的方法，框架依次查找方法自身的注解、从方法声明类沿父类链找到的最近类级注解，以及被覆盖的父类方法上的注解。子类的类级注解不影响仅从父类继承而未覆盖的方法；需要使用子类默认设置时，请在子类覆盖该方法。仅有类级注解时，不拦截 `equals(Object)`、`hashCode()` 和 `canEqual(Object)`。

同一方法同时使用 `@Transactional` 与 `@ExceptionCatch` 时，事务拦截器（顺序 `100`）在异常拦截器（顺序 `200`）外层。若内层返回后备值，外层看到的是正常返回，会按正常路径完成事务；该异常不会触发回滚。若事务已被标记为只能回滚，仍不能提交。若异常向外传播，事务拦截器按回滚规则处理；外层开始或提交事务时的失败不在该方法内层的 `@ExceptionCatch` 范围内。如果你要先回滚再返回后备值，请在事务调用外层处理异常。

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/exception/UserDatabaseService.java

将示例中带 `@Table` 的 `User` 实体打包进调用模块的 JAR，由框架将它登记到该模块。按上文将 `LoggingExceptionHandler` 注册到模块容器；导出失败时，以它返回的 `null` 为准，而不是注解的 `defaultValue`。文件和导出辅助方法是占位实现。如果调用方必须区分未找到记录、查询失败或归属错误，不要在实际数据服务中用同一个后备值覆盖这些结果。

::: tip 最佳实践
自定义处理器适合用于容错，在预期会出现故障或非关键的方法上捕获异常。
指定具体的异常类型，例如 `@ExceptionCatch(IOException.class)`，而不是捕获所有异常；除非有充分理由，否则保持 `silent = false`。
提供有意义的默认值，例如集合用 `defaultValue = "empty"`、计数器用 `"0"`，并把 `@ExceptionCatch` 配合为容错设计的 `@Service` Bean 一起使用。
:::

## 相关文章

- [IoC 容器](/zh/guide/advanced/ioc-container) — Bean 的管理和代理机制
- [事务](/zh/guide/advanced/transactions) — 使用 `@Transactional` 进行声明式事务管理
- [定时任务](/zh/guide/advanced/scheduled-tasks) — 使用生命周期管理的自动任务调度
