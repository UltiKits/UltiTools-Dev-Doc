# 自动注册

这篇文章将会教你如何使用注解让UltiTools帮你完成一系列的、繁琐的注册任务。

## @UltiToolsModule 注解

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解。

此注解仅可用于UltiTools模块主类，用于简化注解配置。

此注解包含了自动扫描并注册此类包名下的命令，监听器和配置文件。

如果你想要手动注册命令或监听器，可以将 `eventListener` 设置为 `false` 或 `cmdExecutor` 设置为 `false`。

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;
import lombok.Getter;
import com.ultikits.ultitools.annotations.Autowired;

@UltiToolsModule(
        // 是否扫描并注册监听器
        eventListener = true,
        // 是否扫描并注册命令
        cmdExecutor = true,
        // 是否扫描并注册配置文件
        config = true,
        // 扫描包名
        scanBasePackages = {"com.test.plugin"},
        // 指定特定的类扫描
        scanBasePackageClasses = {},
        // 多语言支持
        i18n = {"zh", "en"}
)
public class PluginMain extends UltiToolsPlugin {
    
    @Getter
    private static PluginMain pluginMain;

    public PluginMain() {
        super();
        pluginMain = this;
    }

    @Override
    public boolean registerSelf() {
        return true;
    }
    
    ...
}
```

## @EnableAutoRegister 注解

`@UltiToolsModule` 内包含了 `@EnableAutoRegister` 注解，在不适合使用 `@UltiToolsModule` 的情况下，你可以使用 `@EnableAutoRegister` 注解，比如你想在你自己的插件中使用 UltiTools 的自动注册。

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解，UltiTools 在加载你的模块时会根据你的配置进行自动注册：

```java
@EnableAutoRegister(
    scanPackage = "",     //要扫描的包
    eventListener = true, //是否注册监器
    cmdExecutor = true,   //是否注册执行器
    config = true        //是否注册配置文件类
)
public class UltiToolsConnector extends UltiToolsPlugin {

    // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
    // 在这里请不要主动使用无参数的构造函数
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass) {
        super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        return true;
    }

    ...
}
```

## @ContextEntry 注解

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解，UltiTools 在加载你的模块时会自动为指定的类注册 Bean。

```java
@ContextEntry(MyBean.class)
public class UltiToolsConnector extends UltiToolsPlugin {

    // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
    // 在这里请不要主动使用无参数的构造函数
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass) {
        super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        return true;
    }
    
    ...
}
```

## @CmdExecutor 注解
带有此注解的继承 `AbstractCommandExecutor` 的类在自动扫描注册命令启用的情况下被自动注册

详情参见 [命令执行器](/zh/guide/essentials/cmd-executor)

## @EventListener 注解

带有此注解的实现 `Listener` 的类在自动扫描注册监听器启用的情况下被自动注册

详情参见 [事件监听器](/zh/guide/essentials/event-listener)
