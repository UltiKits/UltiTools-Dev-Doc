# 自动注册

这篇文章将会教你如何使用注解让UltiTools帮你完成一系列的、繁琐的注册任务。

## @UltiToolsModule 注解

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解。

此注解仅可用于UltiTools模块主类，用于简化注解配置。

此注解包含了自动扫描并注册此类包名下的命令，监听器和配置文件。

::: tip @UltiToolsModule 上的 eventListener、cmdExecutor 与 config 现在会生效（v6.3.0 起）
`registerBukkit` 现在改用会遵循 `@AliasFor` 的合并注解查找来解析 `@EnableAutoRegister`，所以直接在 `@UltiToolsModule` 上把 `eventListener`、`cmdExecutor` 或 `config` 设为 `false`，就能关掉对应的自动注册。
:::

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

::: info 自 v6.3.0 起的连接器构造器
六参数构造器已移除。下面两个连接器示例使用七参数构造器，由调用方传入 `resourceFolderPath`。
新的独立 Bukkit 插件优先在自己的 `JavaPlugin` 中调用 `UltiToolsAPI.connect(this)`，见[外部插件 API](/zh/guide/advanced/external-plugin-api)。
:::

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
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath) {
        super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass, resourceFolderPath);
    }

    @Override
    public boolean registerSelf() throws IOException {
        return true;
    }

    ...
}
```

## @ContextEntry 注解

本示例中的连接器构造器与 `@EnableAutoRegister` 一节所述是同一个七参数重载。

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解；它只在上方所述的 `register(UltiToolsPlugin)` 连接器与适配器路径下生效，标准模块以 JAR 方式被 UltiTools 加载时不会读取它。标准模块请改用 `@Service` 或 `@Bean` 注册 Bean。

```java
@ContextEntry(MyBean.class)
public class UltiToolsConnector extends UltiToolsPlugin {

    // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
    // 在这里请不要主动使用无参数的构造函数
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath) {
        super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass, resourceFolderPath);
    }

    @Override
    public boolean registerSelf() throws IOException {
        return true;
    }
    
    ...
}
```

## @CmdExecutor 注解
带有此注解的命令执行器类，在启用自动扫描注册命令时会被注册

详情参见 [命令执行器](/zh/guide/essentials/cmd-executor)

## @EventListener 注解

带有此注解的实现 `Listener` 的类在自动扫描注册监听器启用的情况下被自动注册

详情参见 [事件监听器](/zh/guide/essentials/event-listener)
