# IOC 容器

IOC 的全称为 Inversion of Control （反转控制），意在将对象的创建和管理交由容器，而不是由开发者主动新建对象。

UltiTools 整合了 Spring IOC 容器，如果你接触过 Spring 开发，你将会对下面的内容感到十分熟悉。

::: warning 局限性
尽管 UltiTools 尽可能地对涉及的class进行扫描，但仍然可能存在因找不到类使 Bean 注册失败的问题。
:::

## 模块容器

每个模块都有一个独立的上下文容器 `Context`，你可以使用主类的 `getContext()` 方法获取到。

该 `Context` 与 Spring 的 `AnnotationConfigApplicationContext` 一致，具体使用方法可查阅官网文档，本文仅涉及基本的用法。

所有模块的上下文容器都使用了一个公共的容器作为父容器，该父容器拥有一些 UltiTools 的公共 Bean，也有可能存在其他模块注册的公共 Bean。

## Bean注册

### 自动扫描
在你的主类添加 `@ConpomentScan(...)` 注解，UltiTools在初始化你的插件时会自动扫描给定包下所有的类，带有相应注解的将会被自动注册为 Bean。

支持的注解有：
- `@Component`
- `@Controller`
- `@Service`
- `@Repository`
- `@CmdExecutor` (UltiTools API 内建)
- `@EventListener` (UltiTools API 内建)

详情参见 [Classpath Scanning and Managed Components](https://docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html)

### 手动注册

你可以直接使用容器对象的 `register()` 方法进行注册：

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
        // 插件启动时执行
        getContext().register(MyBean.class);
        getContext().refresh();              //别忘记刷新上下文
    }
  
  ...
}
```

详情参见 [Bean Overview](https://docs.spring.io/spring-framework/reference/core/beans/definition.html)

## 依赖获取

### 自动注入

如果某一类受容器管理，那么可以使用自动注入：

```java
//字段注入
@Autowired
MyBean myBean;                  

--- OR ---

//构造函数注入
public MyClass(MyBean myBean) {
    this.myBean = MyBean;       
}
```

### 手动获取

如果需要从容器获取某个依赖，仅需调用容器对象的 `getBean()` 方法即可：

```java
MyBean myBean = context.getBean(MyBean.class);
```

### 插件主类

插件主类受容器管理，你可以通过多种方式来获取它。

#### 通过自动注入获取插件主类

前提是该类受容器管理

```java
@Autowired
PluginMain pluginMain;                       //字段注入

public MyClass(PluginMain pluginMain) {
    this.pluginMain = pluginMain;            //构造函数注入
}
```

::: tip
如果该类为事件监听器类或命令执行器类，那么可以使用字段注入的方式来实现主类的获取。
:::

#### 手动获取

如果在某些情况下无法通过容器来获取插件主类，那么你仍然可以通过创建 getter 来获取主类。

```java
public class MyPlugin extends UltiToolsPlugin {
  private MyPlugin plugin;

  @Override
  public boolean registerSelf() {
    // 插件启动时执行
    this.plugin = this;
    return true;
  }

  public MyPlugin getInstance() {
    return this.plugin;
  }

  ...
}
```

## Bean 生命周期钩子 <Badge type="tip" text="v6.2.0+" />

使用 `@PostConstruct` 和 `@PreDestroy` 注解可以在托管 Bean 的特定生命周期阶段自动调用方法。

### @PostConstruct

`@PostConstruct` 注解标记一个方法在**所有依赖都被注入后且 Bean 完全初始化后**被调用。

```java
@Service
public class DatabaseConnection {
    private String connectionUrl;

    @Autowired
    private ConfigService config;

    @PostConstruct
    public void initialize() {
        // 在注入完成后调用
        this.connectionUrl = config.getDatabaseUrl();
        // 连接到数据库
        connectToDatabase();
    }

    private void connectToDatabase() {
        // 初始化逻辑
    }
}
```

**规则：**
- 方法必须返回 `void`
- 方法不能接受任何参数
- 可以抛出已检查异常
- 每个 Bean 实例仅调用一次（对于单例）

### @PreDestroy

`@PreDestroy` 注解标记一个方法在**Bean 销毁前**被调用（当插件被禁用或容器关闭时）。

```java
@Service
public class ResourceManager {
    private Connection dbConnection;

    @PostConstruct
    public void connect() {
        dbConnection = createConnection();
    }

    @PreDestroy
    public void cleanup() {
        // 在关闭前调用
        if (dbConnection != null && dbConnection.isOpen()) {
            dbConnection.close();
        }
    }
}
```

**规则：**
- 方法必须返回 `void`
- 方法不能接受任何参数
- 可以抛出已检查异常
- 异常将被记录但不会阻止关闭

## 工厂方法 Bean <Badge type="tip" text="v6.2.0+" />

对于复杂的 Bean 初始化或从第三方库创建 Bean，使用 `@Configuration` 注解配合 `@Bean` 工厂方法。

```java
@Configuration
public class HttpClientConfiguration {

    @Bean
    public HttpClient createHttpClient() {
        // 此方法的返回值会成为托管 Bean
        return HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .version(HttpClient.Version.HTTP_2)
            .build();
    }

    @Bean(name = "primaryDatabase")
    public DataSource createDataSource() {
        // 命名 Bean - 当存在多个相同类型的 Bean 时很有用
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://localhost:3306/db");
        config.setUsername("user");
        config.setPassword("pass");
        return new HikariDataSource(config);
    }
}
```

**何时使用：**
- 从外部库创建 Bean（Gson、HTTP 客户端、数据库连接池）
- 具有多个步骤的复杂初始化逻辑
- 基于运行时配置的条件性 Bean 创建
- 命名 Bean 用于消除多个实现的歧义

**规则：**
- 类必须用 `@Configuration` 注解
- 方法必须用 `@Bean` 注解
- 返回类型变成 Bean 类型
- Bean 名称默认为方法名，或使用 `@Bean(name="customName")`
- 工厂方法可以接受 `@Autowired` 依赖

## 插件实例注入 <Badge type="tip" text="v6.2.0+" />

你的插件主类（扩展 `UltiToolsPlugin` 的类）会自动在 IoC 容器中注册，并可以被注入到任何托管 Bean 中。

### 为什么使用此模式

在 v6.2.0 之前，代码通常使用静态 `getInstance()` 模式：

```java
// 旧模式（可行但产生耦合）
public class MyService {
    public void doSomething() {
        MyPlugin plugin = MyPlugin.getInstance();
        // 使用 plugin
    }
}
```

从 v6.2.0 开始，插件实例由容器自动管理：

```java
// 新模式（更好 - 依赖注入）
@Service
public class MyService {
    @Autowired
    private MyPlugin plugin;  // 自动注入

    public void doSomething() {
        // 使用 plugin - 不依赖于静态 getInstance()
    }
}
```

### 构造函数注入示例

```java
@Service
public class PlayerDataService {
    private final MyPlugin plugin;
    private final ConfigService config;

    public PlayerDataService(MyPlugin plugin, ConfigService config) {
        this.plugin = plugin;
        this.config = config;
    }

    public void syncPlayerData(UUID playerId) {
        // 使用 plugin.getServer()、plugin.getLogger() 等
        plugin.getLogger().info("Syncing data for: " + playerId);
    }
}
```

### 工作原理

容器在插件初始化期间自动执行此注册：

```java
// 在 PluginManager 中的插件初始化期间
UltiToolsPlugin plugin = new YourPlugin();
pluginContext.registerType(UltiToolsPlugin.class, plugin);  // 按父类类型注册
pluginContext.registerType(YourPlugin.class, plugin);       // 也按具体类型注册
```

这意味着两种注入方式都有效：

```java
@Autowired
private UltiToolsPlugin plugin;  // 通过父类类型

@Autowired
private YourPlugin plugin;       // 通过具体类型
```

**优势：**
- 类型安全的依赖注入
- 更好的可测试性（可以为单元测试模拟插件）
- 消除了静态 getInstance() 调用
- 遵循 Spring 依赖注入模式

## 服务优先级

当同一接口存在多个实现时，使用 `@Service` 注解的 `priority` 属性来控制 `getBean(Class)` 返回哪一个。

```java
// 支付处理器的多个实现
@Service(priority = 10)
public class PayPalProcessor implements PaymentProcessor {
    // 优先级高 = 优先处理
}

@Service(priority = 5)
public class StripeProcessor implements PaymentProcessor {
    // 优先级中等
}

@Service  // 默认优先级 = 0
public class DirectBankProcessor implements PaymentProcessor {
    // 优先级最低
}
```

**行为：**
- 更高的 `priority` 值优先
- 默认优先级为 0
- 仅影响接口类型的 `getBean(Class)` 查找
- 当多个 Bean 匹配时，返回优先级最高的 Bean
- 在 `getBeansOfType()` 和 `getOrderedBeansOfType()` 中保持顺序（最高优先级在前）

```java
// 使用方式
@Autowired
private PaymentProcessor processor;  // 获得 PayPalProcessor（最高优先级）

// 或获得按优先级排序的所有实现
List<PaymentProcessor> allProcessors = context.getOrderedBeansOfType(PaymentProcessor.class);
// 返回：[PayPalProcessor, StripeProcessor, DirectBankProcessor]
```

## 条件注册 <Badge type="tip" text="v6.2.0+" />

从 v6.2.0 开始，你可以使用 `@ConditionalOnConfig` 注解根据 YAML 配置值来条件性地注册组件。

```java
@Service
@ConditionalOnConfig(value = "config/config.yml", path = "features.economy")
public class EconomyService {
    // 仅在 config.yml 中 features.economy: true 时才注册
}
```

这消除了在 `registerSelf()` 中手动进行 `if` 判断的需要。详情请参阅[条件注册](/zh/guide/advanced/conditional-registration)指南。
