# Auto Register

This article will teach you how to use annotations to let UltiTools help you complete a series of tedious registration tasks.

## @UltiToolsModule

Add this annotation above the class that extends `UltiToolsPlugin`.

This annotation can only be used in the main class of the UltiTools module to simplify the annotation configuration.

This annotation includes automatic scanning and registration of commands, listeners and configuration files under this class package name.

::: tip eventListener, cmdExecutor and config on @UltiToolsModule take effect (as of v6.3.0)
`registerBukkit` now resolves `@EnableAutoRegister` through a merged-annotation lookup that honours `@AliasFor`, so setting `eventListener`, `cmdExecutor` or `config` to `false` directly on `@UltiToolsModule` disables that registration.
:::

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;
import lombok.Getter;
import com.ultikits.ultitools.annotations.Autowired;

@UltiToolsModule(
        // enable auto register listener
        eventListener = true,
        // enable auto register command executor
        cmdExecutor = true,
        // enable auto register config
        config = true,
        // scan package
        scanBasePackages = {"com.test.plugin"},
        // i18n support
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

## @EnableAutoRegister

::: warning The six-parameter connector constructor is marked for removal
The constructor in the example below matches the `UltiToolsPlugin` overload that carries `@Deprecated(since = "6.0.8", forRemoval = true)` and hardcodes the resource folder path, so javac reports a removal warning wherever it is used, including the identical constructor in the `@ContextEntry` example further down.
Move the integration to the External Plugin API and call `UltiToolsAPI.connect` from your own `JavaPlugin`, or keep the connector and call the seven-parameter constructor passing `resourceFolderPath` yourself: both are supported on v6.2.5.
The replacement signature for connectors is still being decided in [issue #217](https://github.com/UltiKits/UltiTools-Reborn/issues/217), and the removal itself is tracked in [issue #213](https://github.com/UltiKits/UltiTools-Reborn/issues/213).
:::

`@UltiToolsModule` contains the `@EnableAutoRegister` annotation. If you cannot use `@UltiToolsModule`, you can use the `@EnableAutoRegister` annotation, such as if you want to use UltiTools' automatic registration in your own plugin.

Add this annotation above the class that extends `UltiToolsPlugin`, UltiTools will automatically register according to your configuration when loading your module:

::: warning cmdExecutor = true routes through a deprecated overload that throws ClassCastException
On the connector registration path shown on this page, `registerBukkit` sends command registration to `CommandManager.registerAll(UltiToolsPlugin, String)`, which casts every scanned class straight to the retired `AbstractCommandExecutor` and is now `@Deprecated(since = "6.2.5", forRemoval = true)`, so a command class written against the recommended `BaseCommandExecutor` throws an uncaught `ClassCastException`.
Extend `AbstractCommandExecutor` for commands registered through this connector path, or use the standard module JAR loading path shown earlier in this guide, which never calls this overload.
Fixing or removing this overload is being decided together with the connector's replacement signature in [issue #327](https://github.com/UltiKits/UltiTools-Reborn/issues/327).
:::

```java
@EnableAutoRegister(
    scanPackage = "",     // package to scan
    eventListener = true, // whether to register listener
    cmdExecutor = true,   // whether to register command executor
    config = true        // whether to register config
)
public class UltiToolsConnector extends UltiToolsPlugin {
    
    // If you need to connect to UltiTools-API, you need to override this constructor with parameters,
    // the other one without parameters is for module development.
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

## @ContextEntry

The connector constructor in this example is the same six-parameter overload described under `@EnableAutoRegister`.

Add this annotation above the class that extends `UltiToolsPlugin`; it only takes effect on the `register(UltiToolsPlugin)` connector and adapter path described above, not when UltiTools loads your module as a standard JAR. Standard modules should register beans with `@Service` or `@Bean` instead.

```java
@ContextEntry(MyBean.class)
public class UltiToolsConnector extends UltiToolsPlugin {

    // If you need to connect to UltiTools-API, you need to override this constructor with parameters,
    // the other one without parameters is for module development.
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

## @CmdExecutor

A command executor class with this annotation is registered when automatic command scanning is enabled.

For details please see [Command Executor](/guide/essentials/cmd-executor)

## @EventListener 

Class that implements `Listener` with this annotation will be automatically registered when the listener is automatically scanned and registered.

For details please see [Event Listener](/guide/essentials/event-listener)
