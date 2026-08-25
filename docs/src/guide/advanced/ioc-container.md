# IOC Container

IOC stands for Inversion of Control, which means that the creation and management of objects are handed over to the container instead of being actively created by the developer.

UltiTools has its own IOC container built on `SimpleContainer`, which uses a three-level cache for circular dependency resolution. If you have used Spring before, you will find the concepts familiar.


::: warning

Despite UltiTools attempting to scan the involved classes as comprehensively as possible, there may still be issues with Bean registration if the class cannot be found.

:::

## Module container

Each module has an independent context container `Context`, which you can get using the `getContext()` method of the main class.

The `Context` is backed by UltiTools' `SimpleContainer`. This article covers the basic usage.

All modules' context containers use a public container as the parent container, which has some common UltiTools Beans, and there may be other common Beans registered by other modules.

## Bean registration

### Automatic scanning
Add the `@ComponentScan(...)` annotation to your main class, and UltiTools will automatically scan all classes in the given package when initializing your plugin. Those with the corresponding annotations will be automatically registered as Beans.

Supported annotations：
- `@Component`
- `@Service`
- `@CmdExecutor` (UltiTools API built-in)
- `@EventListener` (UltiTools API built-in)

### Manual registration

You can register directly using the `registerType()` method of the container object:

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;

@UltiToolsModule
public class BasicFunctions extends UltiToolsPlugin {

    @Override
    public boolean registerSelf() {
        // on module register
        getContext().registerType(MyBean.class, new MyBean());
        return true;
    }

    ...
}
```


## Dependency acquisition

### Automatic injection

If a class is managed by the container, you can use automatic injection:

```java
// field injection
@Autowired
MyBean myBean;                  

--- OR ---

// constructor injection
public MyClass(MyBean myBean) {
    this.myBean = myBean;
}
```

### Manual acquisition

If you need to get a dependency from the container, just call the `getBean()` method of the container object:

```java
MyBean myBean = context.getBean(MyBean.class);
```

### Module main class

Module main class is managed by the container, and you can get it in many ways.

#### Get the main class through automatic injection

Only if the class is managed by the container

```java
@Autowired
PluginMain pluginMain;                       // field injection

public MyClass(PluginMain pluginMain) {
    this.pluginMain = pluginMain;            // constructor injection
}
```

::: tip
If the class is an event listener class or a command executor class, you can use field injection to get the main class.
:::

#### Manual acquisition

If you cannot get the main class through the container in some cases, you can still create a getter to get the main class.

```java
public class MyPlugin extends UltiToolsPlugin {
  private MyPlugin plugin;

  @Override
  public boolean registerSelf() {
    // on module register
    this.plugin = this;
    return true;
  }

  public MyPlugin getInstance() {
    return this.plugin;
  }

  ...
}
```

## Bean Lifecycle Hooks <Badge type="tip" text="v6.2.0+" />

Methods in managed beans can be automatically called at specific lifecycle points using `@PostConstruct` and `@PreDestroy` annotations.

### @PostConstruct

The `@PostConstruct` annotation marks a method to be called **after all dependencies have been injected** and the bean is fully initialized.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/DatabaseConnection.java

**Rules:**
- Method must have `void` return type
- Method must accept no arguments
- Can throw checked exceptions
- Called only once per bean instance (for singletons)

### @PreDestroy

The `@PreDestroy` annotation marks a method to be called **before the bean is destroyed** (when the plugin is disabled or the container shuts down).

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/ResourceManager.java

**Rules:**
- Method must have `void` return type
- Method must accept no arguments
- Can throw checked exceptions
- Exceptions are logged but don't prevent shutdown

## Factory Method Beans <Badge type="tip" text="v6.2.0+" />

For complex bean initialization or creating beans from third-party classes, use the `@Configuration` annotation with `@Bean` factory methods.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/HttpClientConfiguration.java

**When to use:**
- Creating beans from external libraries (Gson, HTTP clients, database connection pools)
- Complex initialization logic with multiple steps
- Conditional bean creation based on runtime configuration
- Named beans to disambiguate multiple implementations

**Rules:**
- Class must be annotated with `@Configuration`
- Methods must be annotated with `@Bean`
- Return type becomes the bean type
- Bean name defaults to method name.
- Factory methods are invoked with no arguments; they cannot accept `@Autowired` parameters.

## Plugin Instance Injection <Badge type="tip" text="v6.2.0+" />

Your plugin's main class (which extends `UltiToolsPlugin`) is automatically registered in the IoC container and can be injected into any managed bean.

### Why Use This Pattern

Before v6.2.0, code typically used the static `getInstance()` pattern:

```java
// Old pattern (works but creates coupling)
public class MyService {
    public void doSomething() {
        MyPlugin plugin = MyPlugin.getInstance();
        // Use plugin
    }
}
```

Starting in v6.2.0, the plugin instance is automatically managed by the container:

```java
// New pattern (better - dependency injection)
@Service
public class MyService {
    @Autowired
    private MyPlugin plugin;  // Automatically injected

    public void doSomething() {
        // Use plugin - no coupling to static getInstance()
    }
}
```

### Constructor Injection Example

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/PlayerDataService.java

### How It Works

The container automatically performs this registration:

```java
// Inside PluginManager during plugin initialization
UltiToolsPlugin plugin = new YourPlugin();
pluginContext.registerType(UltiToolsPlugin.class, plugin);  // Registered by parent class type
pluginContext.registerType(YourPlugin.class, plugin);       // Also by concrete type
```

This means both injection styles work:

```java
@Autowired
private UltiToolsPlugin plugin;  // Via parent type

@Autowired
private YourPlugin plugin;       // Via concrete type
```

**Benefits:**
- Type-safe dependency injection
- Better testability (can mock plugin for unit tests)
- Eliminates static getInstance() calls
- Follows standard dependency injection patterns

## Service Priority

When multiple implementations of the same interface exist, use the `priority` attribute of the `@Service` annotation to control which one is returned by `getBean(Class)`.

```java
// Multiple implementations of a payment processor
@Service(priority = 10)
public class PayPalProcessor implements PaymentProcessor {
    // Higher priority = processed first
}

@Service(priority = 5)
public class StripeProcessor implements PaymentProcessor {
    // Lower priority
}

@Service  // default priority = 0
public class DirectBankProcessor implements PaymentProcessor {
    // Lowest priority
}
```

**Behavior:**
- Higher `priority` value takes precedence
- Default priority is 0
- Only affects `getBean(Class)` lookup of interface types
- When multiple beans match, the highest priority bean is returned
- Only `getOrderedBeansOfType()` returns results ordered by priority (highest first); `getBeansOfType()` returns an unordered map.

```java
// Usage
@Autowired
private PaymentProcessor processor;  // Gets PayPalProcessor (highest priority)

// Or get all ordered by priority
List<PaymentProcessor> allProcessors = context.getOrderedBeansOfType(PaymentProcessor.class);
// Returns: [PayPalProcessor, StripeProcessor, DirectBankProcessor]
```

## Conditional Registration <Badge type="tip" text="v6.2.0+" />

Starting from v6.2.0, you can conditionally register components based on YAML configuration values using the `@ConditionalOnConfig` annotation.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/EconomyService.java

This eliminates the need for manual `if` checks in `registerSelf()`. See the [Conditional Registration](/guide/advanced/conditional-registration) guide for full details.
