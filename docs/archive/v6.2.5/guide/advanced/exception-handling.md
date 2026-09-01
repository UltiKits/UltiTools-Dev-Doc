# Exception Handling

::: info Since v6.2.0
Automatic exception catching and handling for service methods.
:::

UltiTools provides declarative exception handling through the `@ExceptionCatch` annotation. Instead of wrapping service method calls in try-catch blocks, you simply annotate a method and the framework handles exceptions automatically based on your configuration.

::: warning @ExceptionCatch has no reader in v6.2.5
The `aop` package is connected to the rest of the framework only by two javadoc references in v6.2.5: no proxy is created, no advisor is registered and `ExceptionInterceptor` is never instantiated, so an annotated method throws exactly as it would without the annotation and `silent`, `value`, `defaultValue` and `handler` all stay inert.
Wrap the call in an ordinary try-catch until the wiring ships: everything described on this page, including the handler lookup by name further down, depends on that one missing connection.
The wiring is merged into the development branch but is not part of v6.2.5; it is tracked in [issue #190](https://github.com/UltiKits/UltiTools-Reborn/issues/190).
:::

## Basic Usage

Add `@ExceptionCatch` to any method inside a managed bean (such as a `@Service`):

<<< @/../examples/src/main/java/com/ultikits/docs/exception/FileService.java

By default:
- All `Exception` types are caught
- Exceptions are logged as warnings (unless `silent = true`)
- A default value (null for objects, 0 for primitives) is returned

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `Class<? extends Throwable>[]` | `{Exception.class}` | Exception types to catch. Subclasses are automatically included. |
| `silent` | `boolean` | `false` | If true, exceptions are caught without logging. If false, caught exceptions are logged as warnings. Either way, the exception is also reported to the framework's ErrorReportCollector. |
| `handler` | `String` | `""` | Name of a custom exception handler bean. The bean must implement `ExceptionHandler`. |
| `defaultValue` | `String` | `""` | Expression specifying the return value when an exception is caught. |

## Catching Specific Exceptions

Specify which exception types should be caught:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/DataService.java

::: tip Exception Hierarchy
When you specify an exception type, the framework also catches its subclasses. For example, `@ExceptionCatch(IOException.class)` will catch `FileNotFoundException`, `EOFException`, and other subclasses of `IOException`.
:::

## Silent Mode

Suppress logging for expected or non-critical exceptions:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/ConfigService.java

Use `silent = true` for:
- Non-critical operations (e.g., optional backups)
- Fallback logic (e.g., use default if file not found)
- Operations where exceptions are expected

## Default Return Values

Control what value is returned when an exception is caught:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MoneyService.java

Supported default value expressions:
- `"null"` — returns null (default for objects)
- `"true"` / `"false"` — returns boolean
- Numeric literals — `"0"`, `"100"`, `"-5"`, `"3.14"` — returns the number
- `"empty"` — returns empty collection/array/string based on return type

If `defaultValue` is not specified, a type-appropriate default is used:
- Objects: `null`
- boolean: `false`
- int, long, etc.: `0`
- String: `null`
- Collections: `null`

::: warning defaultValue Type Matching
The `defaultValue` expression is parsed according to the method's return type. If you specify `defaultValue = "0"` on a `String`-returning method, it returns the string `"0"`, not the number zero.
:::

## Custom Exception Handlers

Implement custom logic for exception handling by creating an `ExceptionHandler` bean:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/LoggingExceptionHandler.java

Register the handler and reference it by name:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MyService.java

::: tip Handler Interface
Custom handlers implement the `ExceptionHandler` interface, whose `handleException(Throwable, Object, Method, Object[])` method holds the main logic and can return a replacement value or re-throw.
`supports(Class)` is optional and reports whether the handler covers a given exception type, defaulting to true for all types.
`getOrder()` is optional too and sets priority, where lower values run first and the default is 0.
:::

## Method Requirements

`@ExceptionCatch` works only on methods in beans managed by the IoC container:

```java
@Service
public class MyService {

    @ExceptionCatch  // CORRECT - method in a managed @Service bean
    public void safeOperation() {
        // ...
    }
}

public class NonManagedClass {

    @ExceptionCatch  // WRONG - this class is not a bean
    public void unsafeOperation() {
        // The annotation has no effect
    }
}
```

Supported bean types:
- `@Service` — services
- `@Component` — general-purpose beans
- Any class registered manually in the IoC container

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/exception/UserDatabaseService.java

::: tip Best Practices
Custom handlers work best for fault tolerance, catching exceptions in methods where failures are expected or non-critical.
Specify exception types such as `@ExceptionCatch(IOException.class)` instead of catching everything, and keep `silent = false` unless you have a specific reason to suppress the log.
Provide meaningful defaults, for example `defaultValue = "empty"` for collections and `"0"` for counts, and combine `@ExceptionCatch` with `@Service` beans designed for fault tolerance.
:::

## See Also

- [IoC Container](/guide/advanced/ioc-container) — How beans are managed and proxied
- [Transactions](/guide/advanced/transactions) — Declarative transaction management with `@Transactional`
- [Scheduled Tasks](/guide/advanced/scheduled-tasks) — Automatic task scheduling with lifecycle management
