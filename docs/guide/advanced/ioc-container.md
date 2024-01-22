# IOC 容器

IOC 的全称为 Inversion of Control （反转控制），意在将对象的创建和管理交由容器，而不是由开发者主动新建对象。

UltiTools 整合了 Spring IOC 容器，如果你接触过 Spring 开发，你将会对下面的内容感到十分熟悉。

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
