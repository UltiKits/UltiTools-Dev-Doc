# IOC Container

7.0.0 has not been released. This guide describes IoC (inversion of control) in UltiTools-API 7.0. The container creates and wires objects called beans. See the [7.0.0 release notes](../release-notes/7.0.0) for the preview scope.

As of v7.0.0, the module container is assembled during plugin enable, not during [bootstrap](./startup-phases). Bootstrap hooks cannot look up IoC services.

## Module container

Every module has its own `SimpleContainer`, available from the module instance's `getContext()`. Its parent is the framework's shared container. A single-bean lookup falls back to the parent only if the module container has no matching bean; a local ambiguity is an error, not a reason to try the parent. Beans registered only in one module's container are not visible to sibling containers.

As of v7.0.0, obtain the framework `NotificationService` by its interface (`com.ultikits.ultitools.services.NotificationService`), through injection or `getBean(NotificationService.class)`. The old name aliases are gone. The framework creates and caches the service on first type lookup.

## Bean registration

### Automatic scanning

By default, UltiTools scans the module main class's package and its subpackages. Set `@UltiToolsModule(scanBasePackages = {"com.example.module"})` to choose packages instead. `scanBasePackageClasses` selects packages by marker class; `@ComponentScan` is also supported.

`@Component`, `@Service`, `@EventListener` and `@Configuration` are in `com.ultikits.ultitools.annotations`; `@CmdExecutor` is in `com.ultikits.ultitools.annotations.command`. The scanner also recognizes annotations composed with `@Component`. `@Component` and `@Service` accept a `String value` for the bean name; it defaults to `""`, which leaves the default name (the class's simple name with its first letter lowercased). `@Service` also takes `int priority`, default `0`.

As of v7.0.0, scanned command executors are registered through Paper as Brigadier command trees. Discovery as a bean is distinct from command or listener registration and from AOP interception.

A class that fails to load during discovery may be skipped. The per-class warning begins `Failed to load scanned class: `; the plugin logger emits this `SEVERE` summary (`ERROR` in the console, `error` in the panel stream). These messages are English in both locales:

```text
Module '<module or package>' skipped <count> class(es) that failed to load during startup and continued loading without them: <classes> -- see https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md for the list of APIs removed or changed in this release.
```

As of v7.0.0, the old class-name filter audit and startup audit summaries are gone; this skip diagnostic remains. A skipped class is not registered by that scan.

### Context connectors

`@ContextEntry(Connector.class)` constructs the connector separately through its no-argument constructor after the initial container refresh, registers it under its simple class name, and then injects the module instance again. It does not reuse a scanned bean. Keep the connector out of component scanning to avoid creating a second instance.

### Manual registration

Use the registration method that matches who creates the object:

```java
getContext().registerType(MyApi.class, existingInstance);
getContext().registerSingleton("myHelper", new MyHelper());
getContext().registerBean(MyService.class);
```

- `registerType(Class, instance)` binds an existing instance for exact type lookup. It does not inject fields or run lifecycle hooks.
- `registerSingleton(name, instance)` injects fields and runs `@PostConstruct`. It cannot attach an AOP proxy to an existing object and rejects unproxied instances that require `@Transactional` or `@ExceptionCatch` interception.
- `registerBean(Class, Object...)` registers a definition for the container to construct, just as component scanning registers definitions. Use these paths for classes that need container-created proxies. Register before consumers first need the dependency; `registerSelf()` runs after the initial assembly.

Scanned definitions are singleton by default, so lookups reuse the instance in that container. For a manual definition, `BeanDefinition#setScope(SimpleContainer.BeanScope.PROTOTYPE)` selects a fresh instance on each `getBean(name)` lookup. Prototype instances are not tracked for destruction on container close.

## Dependency acquisition

### Automatic injection

For a container-created component, use a constructor to receive required dependencies. With no explicit constructor arguments, the container tries a no-argument constructor first; only if there is none does it choose a constructor with the most parameters and resolve each parameter by type. Give the component one constructor if you want unambiguous constructor injection.

```java
@Service
public class MyService {
    private final MyBean dependency;

    public MyService(MyBean dependency) {
        this.dependency = dependency;
    }
}
```

For field injection, import `com.ultikits.ultitools.annotations.Autowired`. The container injects annotated fields by type after construction, including inherited fields. `required` defaults to `true`; with `required = false`, a missing bean leaves the field unchanged. A lookup exception, such as ambiguity or a supplier failure, still propagates. The annotation is not used to select a constructor or invoke an injection method.

The singleton cache can expose an already constructed instance while its fields are being injected, which can resolve some singleton cycles. It does not resolve a cycle where constructors must build each other first, a prototype cycle, or a cycle between two already-created objects registered through separate `registerSingleton` calls. Do not rely on accessing a fully initialized bean through a circular reference.

### Manual acquisition

Use `context.getBean(MyBean.class)` for type lookup or `context.getBean("myBean", MyBean.class)` for a named bean with a type check. A lookup returns `null` if the bean is missing (or, for the named overload, has the wrong type). An ambiguous type lookup throws instead.

### Module main class

The container exposes the running module instance, not a new copy.

#### Get the main class through automatic injection

Use the same injection rules in managed services, command executors and listeners. For example:

```java
@Autowired
private MyPlugin plugin;
```

#### Manual acquisition

If you already have the module context, use `context.getBean(MyPlugin.class)` after assembly. Otherwise, pass the running module instance to code outside the container instead of creating another instance.

## Bean Lifecycle Hooks <Badge type="tip" text="v6.2.0+" />

Use `@PostConstruct` to initialize a managed bean after field injection and `@PreDestroy` to release resources when the container closes. Both annotations are in `com.ultikits.ultitools.annotations`. Declare a no-argument `void` method; it may declare checked exceptions.

### @PostConstruct

Initialization runs when the bean is assembled, not on every lookup. An exception from `@PostConstruct` fails that assembly.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/DatabaseConnection.java

### @PreDestroy

On container close, each managed singleton instance is destroyed once, even if it has aliases. The container logs exceptions from `@PreDestroy` and continues cleanup.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/ResourceManager.java

## Factory Method Beans <Badge type="tip" text="v6.2.0+" />

Use `@Configuration` and `@Bean` (both from `com.ultikits.ultitools.annotations`) for third-party objects or objects that need several initialization steps.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/HttpClientConfiguration.java

The scanner discovers component definitions before calling the factories. Give the configuration class an accessible no-argument constructor and declare the `@Bean` methods without parameters. The returned object is registered as a singleton; type lookup uses the stored object's actual class, not just the factory signature. Do not rely on the order of separate `@Bean` methods to inject one factory product into another.

The name defaults to the method name. In `@Bean(name = {"client", "httpClient"})`, `client` is the registered name and `httpClient` is an alias for the same instance. `value` is an alias for `name`; if you set both, their arrays must agree.

## Plugin Instance Injection <Badge type="tip" text="v6.2.0+" />

The framework registers each module's `UltiToolsPlugin` instance in that module's container.

### Why Use This Pattern

Prefer injecting the module instance over calling a static `getInstance()`: the dependency is explicit, and a test can supply its own instance.

### Constructor Injection Example

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/PlayerDataService.java

### How It Works

Before scanning, the framework binds the instance under `UltiToolsPlugin.class`. After scanning, it also registers it as a singleton under the concrete class's simple name. Ordinary beans can therefore inject either the base type or the concrete type once assembly reaches that registration. A factory or bean initialized during the scan can rely on the base-type binding, not on the later concrete-type registration.

## Service Priority

Single-bean type lookup (`getBean(Class)`, field injection and automatic constructor injection) uses this order in the module container:

1. An exact type binding, including a supplier registered for that exact type.
2. A matching bean definition for that exact class, or an assignable definition under the name the requested type explicitly declares in its own `@Component` or `@Service`. An accidental match to the generated name of an interface does not count.
3. The highest `@Service(priority = ...)` among assignable candidates. Default priority is `0`. If the two highest priorities tie, the lookup throws an ambiguity error. Only when there is no local match does lookup fall back to the parent.

For example, `getBean(BaseProcessor.class)` still returns an exact `BaseProcessor` bean even if a `PreferredProcessor extends BaseProcessor` has priority `10`. If you want to choose among implementations of an interface, set their priorities or explicitly bind the interface.

When the following implementations are scanned and there is no explicit `PaymentProcessor` binding, injection selects `PayPalProcessor`.

```java
@Service(priority = 10)
class PayPalProcessor implements PaymentProcessor { /* ... */ }

@Service(priority = 5)
class StripeProcessor implements PaymentProcessor { /* ... */ }

@Service
class DirectBankProcessor implements PaymentProcessor { /* ... */ }
```

```java
@Autowired
private PaymentProcessor processor;

// All named candidates, sorted by descending priority:
List<PaymentProcessor> processors = context.getOrderedBeansOfType(PaymentProcessor.class);
```

`getBeansOfType()` returns a name-to-bean map without priority ordering.

## Conditional Registration <Badge type="tip" text="v6.2.0+" />

Use `@ConditionalOnConfig` to control whether the scanner registers a component based on a module YAML setting.

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/EconomyService.java

`/ul reload` reports changed condition results but does not change the registered component set. See [Conditional Registration](./conditional-registration).
