# IOC Container

IOC stands for Inversion of Control, which means that the creation and management of objects are handed over to the container instead of being actively created by the developer.

UltiTools has integrated the Spring IOC container. If you have used Spring before, you will be very familiar with the following content.


::: warning

Despite UltiTools attempting to scan the involved classes as comprehensively as possible, there may still be issues with Bean registration if the class cannot be found.

:::

## Module container

Each module has an independent context container `Context`, which you can get using the `getContext()` method of the main class.

The `Context` is consistent with Spring's `AnnotationConfigApplicationContext`. For specific usage, please refer to the official website documentation. This article only involves basic usage.

All modules' context containers use a public container as the parent container, which has some common UltiTools Beans, and there may be other common Beans registered by other modules.

## Bean registration

### Automatic scanning
Add the `@ConpomentScan(...)` annotation to your main class, and UltiTools will automatically scan all classes in the given package when initializing your plugin. Those with the corresponding annotations will be automatically registered as Beans.

Supported annotation：
- `@Component`
- `@Controller`
- `@Service`
- `@Repository`
- `@CmdExecutor` (UltiTools API built-in)
- `@EventListener` (UltiTools API built-in)

Please refer [Classpath Scanning and Managed Components](https://docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html)

### Manual registration

You can register directly using the `register()` method of the container object:

```java "MyBean.java"
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.EnableAutoRegister;
import com.ultikits.ultitools.annotations.I18n;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.stereotype.Component;

@UltToolsModule
public class BasicFunctions extends UltiToolsPlugin {
    
    @Override
    public boolean registerSelf() {
        // on module register
        getContext().register(MyBean.class);
        getContext().refresh();              // don't forget to refresh context
    }
  
  ...
}
```

Please refer [Bean Overview](https://docs.spring.io/spring-framework/reference/core/beans/definition.html)

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
    this.myBean = MyBean;       
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

## Conditional Registration <Badge type="tip" text="v6.2.0+" />

Starting from v6.2.0, you can conditionally register components based on YAML configuration values using the `@ConditionalOnConfig` annotation.

```java
@Service
@ConditionalOnConfig(value = "config/config.yml", path = "features.economy")
public class EconomyService {
    // Only registered if features.economy: true in config.yml
}
```

This eliminates the need for manual `if` checks in `registerSelf()`. See the [Conditional Registration](/en/guide/advanced/conditional-registration) guide for full details.
```
