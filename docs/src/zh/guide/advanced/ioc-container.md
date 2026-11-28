# IOC 容器

本页介绍 UltiTools-API 7.0 的 IoC（控制反转）。容器负责创建对象并注入依赖，由容器管理的对象称为 Bean。变更概览见 [7.0.0 发布说明](../release-notes/7.0.0)。

自 v7.0.0 起，模块容器在插件启用阶段组装，而不是在[引导阶段](./startup-phases)组装。引导钩子不能查找 IoC 服务。

## 模块容器

每个模块有独立的 `SimpleContainer`，通过模块实例的 `getContext()` 获取。父容器是框架的共享容器。查找单个 Bean 时，只有模块容器没有匹配项才查父容器；本地存在歧义时直接报错。仅在某个模块容器注册的 Bean 对其他模块容器不可见。

自 v7.0.0 起，按接口 `com.ultikits.ultitools.services.NotificationService` 注入通知服务，或调用 `getBean(NotificationService.class)` 获取。旧的名称别名已移除。框架在首次按类型查找时创建并缓存该服务。

## Bean注册

### 自动扫描

UltiTools 默认扫描模块主类所在的包及其子包。可用 `@UltiToolsModule(scanBasePackages = {"com.example.module"})` 指定扫描包，也可以通过 `scanBasePackageClasses` 指定标记类所在的包。框架也支持 `@ComponentScan`。

`@Component`、`@Service`、`@EventListener` 和 `@Configuration` 位于 `com.ultikits.ultitools.annotations`，`@CmdExecutor` 位于 `com.ultikits.ultitools.annotations.command`。扫描也识别通过 `@Component` 组合的注解。`@Component` 和 `@Service` 的 `String value` 指定 Bean 名，默认是 `""`，此时使用类的简单名并将首字母转为小写。`@Service` 还提供 `int priority`，默认为 `0`。

自 v7.0.0 起，扫描到的命令执行器通过 Paper 注册为 Brigadier 命令树。发现 Bean、注册命令或监听器，以及 AOP 拦截是不同的步骤。

扫描时加载失败的类可能被跳过。逐类警告以 `Failed to load scanned class: ` 开头；插件日志以 `SEVERE` 输出以下汇总（控制台显示为 `ERROR`，面板日志流显示为 `error`）。中英文环境均输出英文原文：

```text
Module '<module or package>' skipped <count> class(es) that failed to load during startup and continued loading without them: <classes> -- see https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md for the list of APIs removed or changed in this release.
```

自 v7.0.0 起，旧的类名过滤审计及其启动汇总已移除，但上述跳过诊断仍保留。被跳过的类不会由该次扫描注册。

### 上下文连接器

`@ContextEntry(Connector.class)` 在容器初次刷新后，通过无参构造器另行创建连接器，以类的简单名注册，再对模块实例执行一次注入。它不复用扫描所得的 Bean。不要把该连接器同时作为扫描组件注册，以免创建第二个实例。

### 手动注册

按对象的创建方选择注册方法：

```java
getContext().registerType(MyApi.class, existingInstance);
getContext().registerSingleton("myHelper", new MyHelper());
getContext().registerBean(MyService.class);
```

- `registerType(Class, instance)` 将现有实例绑定到指定类型，不注入字段，也不执行生命周期钩子。
- `registerSingleton(name, instance)` 注入字段并执行 `@PostConstruct`。它不能给已有对象补建 AOP 代理，因此会拒绝需要 `@Transactional` 或 `@ExceptionCatch` 拦截却未代理的实例。
- `registerBean(Class, Object...)` 和组件扫描一样登记 Bean 定义，由容器构造实例。需要由容器创建代理时，使用这两种方式。要在依赖方首次使用前登记；`registerSelf()` 执行时，容器已完成初次组装。

扫描所得的 Bean 定义默认是单例，同一容器内的查找会复用实例。对于手动登记的定义，可用 `BeanDefinition#setScope(SimpleContainer.BeanScope.PROTOTYPE)` 设置原型作用域，再按名称调用 `getBean(name)`，每次都会创建新实例。容器关闭时不会销毁它未跟踪的原型实例。

## 依赖获取

### 自动注入

容器创建组件时，可通过构造器接收必需依赖。没有显式构造参数时，容器先尝试无参构造器；只有不存在无参构造器时，才选择参数最多的构造器，并按类型解析参数。需要明确使用构造器注入时，只声明一个构造器。

```java
@Service
public class MyService {
    private final MyBean dependency;

    public MyService(MyBean dependency) {
        this.dependency = dependency;
    }
}
```

字段注入使用 `com.ultikits.ultitools.annotations.Autowired`。容器在构造后按类型注入字段，也会处理继承的字段。`required` 默认是 `true`；设为 `false` 时，找不到 Bean 就保留字段原值。查找出现歧义或供应器抛出异常时，异常仍会传播。该注解不用于选择构造器，也不会触发方法注入。

单例缓存可以在字段注入完成前提供已构造的实例，因而能处理部分单例循环。它不能解决构造器必须先构造彼此的循环、原型循环，也不能解决两个已有对象分别调用 `registerSingleton` 时形成的循环。不要通过循环引用假定依赖已完成初始化。

### 手动获取

用 `context.getBean(MyBean.class)` 按类型获取，或用 `context.getBean("myBean", MyBean.class)` 按名称获取并校验类型。未找到时返回 `null`，按名称获取时类型不符也返回 `null`。按类型查找出现歧义时抛出异常。

### 插件主类

容器提供正在运行的模块实例，不会创建副本。

#### 通过自动注入获取插件主类

托管的服务、命令执行器和监听器遵循同样的注入规则。例如：

```java
@Autowired
private MyPlugin plugin;
```

#### 手动获取

如果已有模块容器，可在组装后调用 `context.getBean(MyPlugin.class)`。否则，将正在运行的模块实例传给容器外的代码，而不是另建实例。

## Bean 生命周期钩子 <Badge type="tip" text="v6.2.0+" />

用 `@PostConstruct` 在字段注入完成后初始化托管 Bean，用 `@PreDestroy` 在容器关闭时释放资源。两个注解都位于 `com.ultikits.ultitools.annotations`。将钩子声明为无参 `void` 方法，可以声明受检异常。

### @PostConstruct

初始化在 Bean 组装时执行，而不是每次查找都执行。`@PostConstruct` 抛出异常会导致本次组装失败。

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/DatabaseConnection.java

### @PreDestroy

容器关闭时，每个托管的单例实例只销毁一次，即使它有多个别名。容器记录 `@PreDestroy` 抛出的异常并继续清理。

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/ResourceManager.java

## 工厂方法 Bean <Badge type="tip" text="v6.2.0+" />

用 `@Configuration` 和 `@Bean` 注册第三方对象或需要多步初始化的对象。两个注解都位于 `com.ultikits.ultitools.annotations`。

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/HttpClientConfiguration.java

扫描器先发现组件定义，再调用工厂方法。配置类应有可访问的无参构造器；`@Bean` 方法也不能带参数。返回的对象注册为单例；类型查找依据保存的对象的实际类型，而不只看工厂方法的签名。不要依赖各个 `@Bean` 方法的执行顺序，在一个工厂产物中注入另一个。

默认使用方法名作为 Bean 名。`@Bean(name = {"client", "httpClient"})` 将 `client` 用作注册名，`httpClient` 是同一实例的别名。`value` 是 `name` 的别名；同时设置时，两个数组必须一致。

## 插件实例注入 <Badge type="tip" text="v6.2.0+" />

框架将每个模块的 `UltiToolsPlugin` 实例注册到该模块的容器。

### 为什么使用此模式

优先注入模块实例，而不是调用静态 `getInstance()`。这样依赖关系是显式的，测试也可以提供自己的实例。

### 构造函数注入示例

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/PlayerDataService.java

### 工作原理

扫描前，框架先将实例绑定到 `UltiToolsPlugin.class`。扫描后，再以具体类的简单名注册为单例。完成该项注册后，普通 Bean 可以注入基类或具体类型。在扫描期间初始化的工厂或 Bean 能依赖已建立的基类绑定，不能依赖稍后才建立的具体类型注册。

## 服务优先级

按类型查找单个 Bean（`getBean(Class)`、字段注入和自动构造器注入）在模块容器中采用以下顺序：

1. 精确类型绑定，包括为该类型注册的供应器。
2. 与请求类型相同的类所对应的 Bean 定义，或者请求类型在自身 `@Component` 或 `@Service` 中显式命名、且类型可赋值的定义。恰好与接口默认生成的名称相同不算匹配。
3. 可赋值候选中 `@Service(priority = ...)` 最高的 Bean。默认优先级是 `0`；最高的两个候选并列时，查找会因歧义而报错。仅在本地没有匹配项时才查父容器。

例如，即使 `PreferredProcessor extends BaseProcessor` 的优先级为 `10`，`getBean(BaseProcessor.class)` 仍会先返回精确匹配的 `BaseProcessor` Bean。要在同一接口的实现中作选择，可设置优先级，或显式绑定接口。

扫描到下列实现且没有显式绑定 `PaymentProcessor` 时，注入选择 `PayPalProcessor`。

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

// 所有具名候选，按优先级降序排列：
List<PaymentProcessor> processors = context.getOrderedBeansOfType(PaymentProcessor.class);
```

`getBeansOfType()` 返回 Bean 名到实例的映射，不按优先级排序。

## 条件注册 <Badge type="tip" text="v6.2.0+" />

用 `@ConditionalOnConfig` 根据模块 YAML 设置决定扫描器是否注册组件。

<<< @/../examples/src/main/java/com/ultikits/docs/ioc/EconomyService.java

`/ul reload` 会报告条件结果的变化，但不会改变已注册的组件集合。详见[条件注册](./conditional-registration)。
