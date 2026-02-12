# Exception Handling

::: info Since v6.2.0
Automatic exception catching and handling for service methods.
:::

UltiTools provides declarative exception handling through the `@ExceptionCatch` annotation. Instead of wrapping service method calls in try-catch blocks, you simply annotate a method and the framework handles exceptions automatically based on your configuration.

## Basic Usage

Add `@ExceptionCatch` to any method inside a managed bean (such as a `@Service`):

```java
@Service
public class FileService {

    @ExceptionCatch
    public String readFile(String path) {
        // If any exception occurs, it will be caught and logged
        // The method returns null
        return new String(Files.readAllBytes(Paths.get(path)));
    }
}
```

By default:
- All `Exception` types are caught
- Exceptions are logged as warnings (unless `silent = true`)
- A default value (null for objects, 0 for primitives) is returned

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `Class<? extends Throwable>[]` | `{Exception.class}` | Exception types to catch. Subclasses are automatically included. |
| `silent` | `boolean` | `false` | If true, exceptions are caught without logging. If false, caught exceptions are logged as warnings. |
| `handler` | `String` | `""` | Name of a custom exception handler bean. The bean must implement `ExceptionHandler`. |
| `defaultValue` | `String` | `""` | Expression specifying the return value when an exception is caught. |

## Catching Specific Exceptions

Specify which exception types should be caught:

```java
@Service
public class DataService {

    @ExceptionCatch(IOException.class)
    public String loadData() {
        // Only IOException will be caught
        // Other exceptions will propagate up
        return readFromFile();
    }

    @ExceptionCatch({IOException.class, SQLException.class})
    public List<User> fetchUsers() {
        // Both IOException and SQLException will be caught
        // Subclasses are also caught
        return queryDatabase();
    }
}
```

::: tip Exception Hierarchy
When you specify an exception type, the framework also catches its subclasses. For example, `@ExceptionCatch(IOException.class)` will catch `FileNotFoundException`, `EOFException`, and other subclasses of `IOException`.
:::

## Silent Mode

Suppress logging for expected or non-critical exceptions:

```java
@Service
public class ConfigService {

    @ExceptionCatch(silent = true)
    public void saveOptionalConfig() {
        // Any exception is caught and NOT logged
        // Useful for non-critical background operations
        writeConfigBackup();
    }

    @ExceptionCatch(value = FileNotFoundException.class, silent = true)
    public boolean fileExists(String path) {
        // FileNotFoundException is silently caught
        // Other exceptions are still logged
        return checkFile(path);
    }
}
```

Use `silent = true` for:
- Non-critical operations (e.g., optional backups)
- Fallback logic (e.g., use default if file not found)
- Operations where exceptions are expected

## Default Return Values

Control what value is returned when an exception is caught:

```java
@Service
public class MoneyService {

    @ExceptionCatch(defaultValue = "0")
    public int getBalance(String accountId) {
        // If exception occurs, returns 0 instead of null
        return queryBalance(accountId);
    }

    @ExceptionCatch(defaultValue = "false")
    public boolean isPlayerOnline(String playerName) {
        // Returns false instead of null
        return checkDatabase(playerName);
    }

    @ExceptionCatch(defaultValue = "empty")
    public List<User> getAllUsers() {
        // Returns empty list instead of null
        return queryAllUsers();
    }
}
```

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

```java
@Service
public class LoggingExceptionHandler implements ExceptionHandler {

    @Override
    public Object handleException(Throwable exception, Object target, Method method, Object[] args) {
        // Log detailed exception information
        System.out.println("Exception in: " + method.getDeclaringClass().getSimpleName() + "." + method.getName());
        System.out.println("Message: " + exception.getMessage());
        exception.printStackTrace();
        return null;
    }

    @Override
    public boolean supports(Class<? extends Throwable> exceptionType) {
        // This handler supports any exception
        return true;
    }
}
```

Register the handler and reference it by name:

```java
@Service
public class MyService {

    @ExceptionCatch(handler = "loggingExceptionHandler")
    public String processData() {
        // If an exception occurs, LoggingExceptionHandler.handleException() is called
        return getData();
    }
}
```

::: tip Handler Interface
Custom handlers implement the `ExceptionHandler` interface with:
- `handleException(Throwable, Object, Method, Object[])` — main handler logic, returns a replacement value or can re-throw
- `supports(Class)` — optional; returns true if this handler supports the exception type (default: true for all)
- `getOrder()` — optional; lower values have higher priority (default: 0)
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

```java
@Service
public class UserDatabaseService {

    @Autowired
    private UltiToolsPlugin plugin;

    // Safe read: returns null on any exception, with logging
    @ExceptionCatch
    public User findById(String userId) {
        DataOperator<User> op = plugin.getDataOperator(User.class);
        return op.query().where("id").eq(userId).first();
    }

    // Safe read with default: returns empty list if query fails
    @ExceptionCatch(defaultValue = "empty")
    public List<User> findByRole(String role) {
        DataOperator<User> op = plugin.getDataOperator(User.class);
        return op.query().where("role").eq(role).list();
    }

    // Safe with silent mode: no logging for file-not-found
    @ExceptionCatch(value = FileNotFoundException.class, silent = true)
    public String loadUserData(String filename) {
        return readFile(filename);
    }

    // Safe with custom handler: detailed error reporting
    @ExceptionCatch(
        value = {SQLException.class, IOException.class},
        handler = "detailedErrorHandler",
        defaultValue = "null"
    )
    public String exportUsers() {
        // If SQLException or IOException occurs, detailedErrorHandler is invoked
        return performExport();
    }

    // Critical operation: no exception catching, propagates up
    public void deleteUser(String userId) {
        // No @ExceptionCatch - exceptions must be handled by caller
        DataOperator<User> op = plugin.getDataOperator(User.class);
        op.query().where("id").eq(userId).delete();
    }
}
```

::: tip Best Practices
1. **Use for fault tolerance** — Catch exceptions in methods where failures are expected or non-critical
2. **Specify exception types** — Use `@ExceptionCatch(IOException.class)` instead of catching all exceptions
3. **Enable logging** — Keep `silent = false` unless you have a specific reason to suppress logs
4. **Provide meaningful defaults** — Use `defaultValue = "empty"` for collections, `"0"` for counts, etc.
5. **Combine with services** — `@ExceptionCatch` works best on `@Service` beans designed for fault tolerance
:::

## See Also

- [IoC Container](/en/guide/advanced/ioc-container) — How beans are managed and proxied
- [Transactions](/en/guide/advanced/transactions) — Declarative transaction management with `@Transactional`
- [Scheduled Tasks](/en/guide/advanced/scheduled-tasks) — Automatic task scheduling with lifecycle management
