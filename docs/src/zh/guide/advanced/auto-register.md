# 自动注册

这篇文章将会教你如何使用注解让UltiTools帮你完成一系列的、繁琐的注册任务。

## @UltiToolsModule 注解

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解。

此注解仅可用于UltiTools模块主类，用于简化注解配置。

此注解包含了自动扫描并注册此类包名下的命令，监听器和配置文件。

如果你想要手动注册命令或监听器，可以将 `eventListener` 设置为 `false` 或 `cmdExecutor` 设置为 `false`。

::: warning @UltiToolsModule 上的 eventListener、cmdExecutor 与 config 从不被读取
`registerBukkit` 通过朴素的元注解查找取 `@EnableAutoRegister`，拿到的始终是标注在 `@UltiToolsModule` 类型本身上的裸注解，因此你在 `@UltiToolsModule` 上设置的 `eventListener`、`cmdExecutor`、`config` 只是从未被解析的 `@AliasFor` 声明，不会生效。
改为把你要的开关直接标在你的类上，写成 `@EnableAutoRegister(eventListener = false, cmdExecutor = false, config = false)`：`PluginManager` 是按直接查找读取这个注解类型的，标在它自己身上的值才会生效。
解析这个别名，或者在元注解查找命中时合并宿主注解的属性值，跟踪于 [issue #325](https://github.com/UltiKits/UltiTools-Reborn/issues/325)。
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

::: warning 六参数连接器构造器已标记为待移除
下面示例中的构造器对应 `UltiToolsPlugin` 上带 `@Deprecated(since = "6.0.8", forRemoval = true)` 的重载，它把资源目录路径写死，凡是用到的地方 javac 都会产生一条移除警告，页面下方 `@ContextEntry` 示例里的同一个构造器也是如此。
改用外部插件 API，在你自己的 `JavaPlugin` 里调用 `UltiToolsAPI.connect`，或者保留连接器、改调七参数构造器并自行传入 `resourceFolderPath`：这两种写法在 v6.2.5 上都可用。
连接器的替代签名仍在 [issue #217](https://github.com/UltiKits/UltiTools-Reborn/issues/217) 中讨论，移除动作本身跟踪于 [issue #213](https://github.com/UltiKits/UltiTools-Reborn/issues/213)。
:::

`@UltiToolsModule` 内包含了 `@EnableAutoRegister` 注解，在不适合使用 `@UltiToolsModule` 的情况下，你可以使用 `@EnableAutoRegister` 注解，比如你想在你自己的插件中使用 UltiTools 的自动注册。

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解，UltiTools 在加载你的模块时会根据你的配置进行自动注册：

::: warning cmdExecutor = true 会走到一个抛 ClassCastException 的已弃用重载
在本页展示的连接器注册路径上，`registerBukkit` 把命令注册交给 `CommandManager.registerAll(UltiToolsPlugin, String)`，它把每个扫描到的类直接强转成已废弃的 `AbstractCommandExecutor`，现已标 `@Deprecated(since = "6.2.5", forRemoval = true)`，因此按推荐写法继承 `BaseCommandExecutor` 的命令类会抛出未捕获的 `ClassCastException`。
命令类若要走这条连接器路径，请改继承 `AbstractCommandExecutor`，或改用本页前文所述的模块 JAR 标准加载方式，那条路径完全不会调用这个重载。
修复还是移除这个重载，与连接器的替代签名一起在 [issue #327](https://github.com/UltiKits/UltiTools-Reborn/issues/327) 中决定。
:::

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

本示例中的连接器构造器与 `@EnableAutoRegister` 一节所述是同一个六参数重载。

在继承了 `UltiToolsPlugin` 的类的上方添加这一注解；它只在上方所述的 `register(UltiToolsPlugin)` 连接器与适配器路径下生效，标准模块以 JAR 方式被 UltiTools 加载时不会读取它。标准模块请改用 `@Service` 或 `@Bean` 注册 Bean。

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
带有此注解的命令执行器类，在启用自动扫描注册命令时会被注册

详情参见 [命令执行器](/zh/guide/essentials/cmd-executor)

## @EventListener 注解

带有此注解的实现 `Listener` 的类在自动扫描注册监听器启用的情况下被自动注册

详情参见 [事件监听器](/zh/guide/essentials/event-listener)
