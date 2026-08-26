# 异常处理

::: info 自 v6.2.0 起
自动捕获和处理服务方法中的异常。
:::

UltiTools 通过 `@ExceptionCatch` 注解提供声明式异常处理。无需在服务方法调用处用 try-catch 块包裹，只需为方法添加注解，框架根据你的配置自动处理异常。

::: warning v6.2.5 中没有任何代码读取 @ExceptionCatch
在 v6.2.5 里，`aop` 包与框架其余代码之间只剩两处 javadoc 引用：没有代理被创建，没有 advisor 被注册，`ExceptionInterceptor` 从不被实例化，因此带注解的方法抛出的异常与不带注解时完全一样，`silent`、`value`、`defaultValue`、`handler` 四个属性均不产生作用。
接线发布之前，用普通的 try-catch 包住调用：本页描述的全部内容，包括下文按名字查找处理器的部分，都依赖这同一处缺失的连接。
该接线已合入开发分支，未包含在 v6.2.5，跟踪于 [issue #190](https://github.com/UltiKits/UltiTools-Reborn/issues/190)。
:::

## 基本用法

在任意受容器管理的 Bean（如 `@Service`）的方法上添加 `@ExceptionCatch`：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/FileService.java

默认行为：
- 捕获所有 `Exception` 类型（及其子类）
- 异常会被记录为警告日志（除非 `silent = true`）
- 返回默认值（对象返回 null，原始类型返回 0 等）

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `Class<? extends Throwable>[]` | `{Exception.class}` | 要捕获的异常类型。子类会自动被包含。 |
| `silent` | `boolean` | `false` | 为 true 时，异常被静默捕获，不记录日志。为 false 时，异常被记录为警告。无论哪种情况，异常都会被同时上报给框架的 ErrorReportCollector。 |
| `handler` | `String` | `""` | 自定义异常处理器 Bean 的名称。该 Bean 必须实现 `ExceptionHandler` 接口。 |
| `defaultValue` | `String` | `""` | 异常被捕获时返回的值的表达式。 |

## 捕获特定异常

指定应该被捕获的异常类型：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/DataService.java

::: tip 异常继承关系
当指定异常类型时，框架也会捕获其子类。例如，`@ExceptionCatch(IOException.class)` 会捕获 `FileNotFoundException`、`EOFException` 等 IOException 的子类。
:::

## 静默模式

对于已预期的或非关键异常，禁用日志记录：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/ConfigService.java

何时使用 `silent = true`：
- 非关键操作（如可选备份）
- 后备逻辑（如文件未找到时使用默认值）
- 异常是预期的操作

## 默认返回值

控制异常被捕获时返回的值：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MoneyService.java

支持的默认值表达式：
- `"null"` — 返回 null（对象的默认值）
- `"true"` / `"false"` — 返回布尔值
- 数字字面量 — `"0"`、`"100"`、`"-5"`、`"3.14"` — 返回该数字
- `"empty"` — 根据返回类型返回空集合/数组/字符串

如果未指定 `defaultValue`，会使用类型默认值：
- 对象：`null`
- boolean：`false`
- int、long 等：`0`
- String：`null`
- 集合：`null`

::: warning defaultValue 类型匹配
`defaultValue` 表达式会根据方法的返回类型进行解析。如果在返回 `String` 的方法上指定 `defaultValue = "0"`，会返回字符串 `"0"`，而不是数字零。
:::

## 自定义异常处理器

通过创建 `ExceptionHandler` Bean 来实现自定义异常处理逻辑：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/LoggingExceptionHandler.java

注册并通过名称引用处理器：

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MyService.java

::: tip 处理器接口
自定义处理器实现 `ExceptionHandler` 接口，包含以下方法：
- `handleException(Throwable, Object, Method, Object[])` — 主处理逻辑，返回替换值或可以重新抛出异常
- `supports(Class)` — 可选；返回 true 表示该处理器支持此异常类型（默认：支持所有异常）
- `getOrder()` — 可选；值越低优先级越高（默认：0）
:::

## 方法要求

`@ExceptionCatch` 仅对受 IoC 容器管理的 Bean 中的方法有效：

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

支持的 Bean 类型：
- `@Service` — 服务
- `@Component` — 通用 Bean
- 任何手动注册到 IoC 容器中的类

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/exception/UserDatabaseService.java

::: tip 最佳实践
1. **用于容错** — 在预期会出现故障或非关键的方法上捕获异常
2. **指定异常类型** — 使用 `@ExceptionCatch(IOException.class)` 而非捕获所有异常
3. **启用日志** — 除非有充分理由，否则保持 `silent = false`
4. **提供有意义的默认值** — 集合使用 `defaultValue = "empty"`，计数器使用 `"0"` 等
5. **配合服务使用** — `@ExceptionCatch` 最适合用在为容错而设计的 `@Service` Bean 上
:::

## 相关文章

- [IoC 容器](/zh/guide/advanced/ioc-container) — Bean 的管理和代理机制
- [事务](/zh/guide/advanced/transactions) — 使用 `@Transactional` 进行声明式事务管理
- [定时任务](/zh/guide/advanced/scheduled-tasks) — 使用生命周期管理的自动任务调度
