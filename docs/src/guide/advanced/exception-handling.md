# Exception Handling

This guide describes exception handling in UltiTools-API 7.0; see the [release notes](../release-notes/7.0.0) and the [6.x upgrade guide](./upgrading-to-7).

Use `@ExceptionCatch` when a method on a managed bean can return a useful fallback after an expected failure. The framework intercepts the call through the bean's proxy. The annotation does not change Java's checked-exception rules.

## Basic Usage

Add `@ExceptionCatch` to an overridable instance method on a managed bean (such as a `@Service`):

<<< @/../examples/src/main/java/com/ultikits/docs/exception/FileService.java

By default, the advice catches `Exception` and its subclasses, not `Error`. It logs the caught exception at `WARNING`, submits it to the error-report collector if available, and returns the default for the declared return type. In this example, that default is `null`.

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `Class<? extends Throwable>[]` | `{Exception.class}` | Exception types to catch. Subclasses are automatically included. |
| `silent` | `boolean` | `false` | Suppresses the caught-exception warning, not error reporting or handler diagnostics. |
| `handler` | `String` | `""` | Name of a custom exception handler bean. The bean must implement `ExceptionHandler`. |
| `defaultValue` | `String` | `""` | Fallback expression used when no custom handler runs. |

## Catching Specific Exceptions

Specify which exception types should be caught:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/DataService.java

The helper methods are placeholders. With real file or database code, declare any checked exceptions as required by Java. Matching uses the thrown object, not its cause: an unchecked wrapper around an `IOException` does not match `IOException.class`.

::: tip Exception Hierarchy
When you specify an exception type, the framework also catches its subclasses. For example, `@ExceptionCatch(IOException.class)` will catch `FileNotFoundException`, `EOFException`, and other subclasses of `IOException`.
:::

## Silent Mode

Suppress logging for expected or non-critical exceptions:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/ConfigService.java

`silent = true` suppresses only the advice’s `WARNING` message, `Exception caught in <Bean>.<method>(): <message>`, and its attached exception. It does not suppress error reporting, handler lookup warnings, or any logging the handler does itself. The first method in the example still does not catch `Error`.

Use `silent = true` for:
- Non-critical operations (e.g., optional backups)
- Fallback logic (e.g., use default if file not found)
- Operations where exceptions are expected

## Error Reports

When error reporting is enabled, the collector attributes a caught exception to the loaded module whose JAR contains the concrete bean class, even when the bean is proxied or the method is inherited. If there is no unique match, the report is unattributed. The collector deduplicates and samples by fingerprint and module identity and truncates report text to the gateway limits. See [Panel Integration](./panel-integration).

For data failures, `DataAccessException` and `UnexpectedRollbackException` both extend `UltiToolsException`, which extends `RuntimeException`. Neither is a subtype of `SQLException`, and `UnexpectedRollbackException` is not a subtype of `DataAccessException`. To distinguish framework failures, inspect `getErrorCode()` rather than parsing the message. `getFormattedMessage()` returns `[ULTI-xxxx] <message>`; `getMessage()` does not add the code prefix.

- `ULTI-3010` (`ENTITY_NOT_OWNED`): the requested entity is not registered to the requesting module or external plugin, or a module or connected external plugin has no data scope. An external plugin that has not connected instead gets `IllegalStateException`. See [Data Storage](../essentials/data-storage) for registration and the refusal messages. This is a setup or ownership error, not a missing row.
- `ULTI-3009` (`TRANSACTION_ROLLBACK_ONLY`): the outer commit encounters a rollback-only transaction and rolls it back instead. The exception text is `Transaction was marked rollback-only by <origin>; the outer commit() performed a real rollback instead of committing.` See [Transactions](./transactions).

## Default Return Values

Control what value is returned when an exception is caught:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MoneyService.java

If `defaultValue` is omitted or `""`, the advice returns `null` for reference types (including wrappers, strings and collections), `false` for `boolean`, `\0` for `char`, and zero for numeric primitives. A `void` method has no return value. The `int` and `boolean` expressions in the example explicitly request the same values as their type defaults; `"empty"` changes the `List` result from `null` to an empty list.

| Expression | Result |
|---|---|
| `"null"`, `"true"`, `"false"` | The corresponding null or boolean value. Use them only with a compatible return type. |
| Numeric literal | Parsed for `int`, `long`, `float`, `double` and their wrappers. If parsing fails, or the numeric type is not supported, the type default applies. |
| `"empty"` | Use with `String`, arrays, `List`, `Set`, `Map`, `Collection`, or `Optional`. For collections the advice supplies an `ArrayList`, `HashSet`, or `HashMap`; do not assume it can return a specific concrete type such as `LinkedList`. |
| Other text for a `String` method | Returned as written, for example `"0"` returns the string `"0"`. |

::: warning defaultValue Type Matching
The reserved words `null`, `true`, `false`, and `empty` are matched after trimming and ignoring case, before numeric or string handling. For example, `"false"` produces a boolean, not the string `"false"`. Numeric parsers receive the original string: `int` and `long` reject surrounding spaces and use the type default, while `float` and `double` accept surrounding whitespace.
:::

## Custom Exception Handlers

Implement custom logic for exception handling by creating an `ExceptionHandler` bean:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/LoggingExceptionHandler.java

Register the handler and reference it by name:

<<< @/../examples/src/main/java/com/ultikits/docs/exception/MyService.java

The advice looks up `loggingExceptionHandler` by name from the bean’s container. Merely registering a handler bean does not make it global. If name lookup fails with an exception or resolves to a value that does not implement `ExceptionHandler`, the advice warns and uses `defaultValue` or the type default. A resolved handler’s return value wins, even if it is `null`; its result must be compatible with the method’s return type. Anything the handler throws, including a checked exception or a failure in the handler itself, propagates instead of using the fallback.

::: tip Handler Interface
`handleException(Throwable, Object, Method, Object[])` returns `Object` and declares `throws Throwable`.
`supports(Class<? extends Throwable>)` defaults to `true` and `getOrder()` to `0`; neither is consulted for a named handler. The annotation’s `value` controls which failures reach it.
:::

## Method Requirements

`@ExceptionCatch` requires a bean created and proxied by the IoC container. A virtual call from the bean to its own overridable method can also be intercepted: the proxy is the bean instance.

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

Use a scanned component such as `@Service` or `@Component`, or register a class definition with `registerBean(Class, …)`. An instance you construct yourself is not proxied: `registerSingleton` rejects a preconstructed instance with an AOP annotation, and `registerType` binds the supplied instance without interception.

Use a non-`final`, non-sealed class and an overridable instance method. `private`, `static`, and `final` methods are not interceptable, nor are package-private methods declared in another package. The resolver warns and ignores a method annotation it cannot intercept. If a `final` or `sealed` class has a method that would otherwise be intercepted, proxy creation fails with `ContainerException` (`ULTI-2000`, `BEAN_CREATION_FAILED`). As of v7.0.0, sealed classes are checked explicitly.

You can also annotate a class. For an eligible method, the advice checks the annotation on the method itself, then the nearest annotated class from the method’s declaring class up its superclass chain, then an annotation on an overridden superclass method. A subclass’s class-level annotation does not apply to a method it merely inherits; override the method locally to use the subclass default. Class-level advice skips `equals(Object)`, `hashCode()`, and `canEqual(Object)` unless the method is covered by a method-level annotation.

With `@Transactional` and `@ExceptionCatch` on the same method, transaction advice (order `100`) wraps exception advice (order `200`). If the exception advice returns a fallback, the outer advice sees a normal return and attempts normal transaction completion; that exception does not trigger rollback. A transaction already marked rollback-only still cannot commit. If the failure escapes, the transaction advice applies its rollback rules; failures from its own begin or commit are outside the inner `@ExceptionCatch` on that method. If a failure must roll back the work before you turn it into a fallback, handle it outside the transactional call.

## Complete Example

<<< @/../examples/src/main/java/com/ultikits/docs/exception/UserDatabaseService.java

Package `User`, the example `@Table` entity, in the calling module’s JAR so that the framework registers it to that module. Register `LoggingExceptionHandler` in its container as shown above. Its `null` return, not the annotation’s `defaultValue`, determines the export fallback. The file and export helpers are placeholders. In a real data service, avoid a broad fallback if the caller must distinguish no row from a query or ownership failure.

::: tip Best Practices
Custom handlers work best for fault tolerance, catching exceptions in methods where failures are expected or non-critical.
Specify exception types such as `@ExceptionCatch(IOException.class)` instead of catching everything, and keep `silent = false` unless you have a specific reason to suppress the log.
Provide meaningful defaults, for example `defaultValue = "empty"` for collections and `"0"` for counts, and combine `@ExceptionCatch` with `@Service` beans designed for fault tolerance.
:::

## See Also

- [IoC Container](/guide/advanced/ioc-container) — How beans are managed and proxied
- [Transactions](/guide/advanced/transactions) — Declarative transaction management with `@Transactional`
- [Scheduled Tasks](/guide/advanced/scheduled-tasks) — Automatic task scheduling with lifecycle management
