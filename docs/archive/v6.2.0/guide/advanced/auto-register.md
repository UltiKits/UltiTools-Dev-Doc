# Auto Register

This article will teach you how to use annotations to let UltiTools help you complete a series of tedious registration tasks.

## @UtiToolsModule

Add this annotation above the class that extends `UltiToolsPlugin`.

This annotation can only be used in the main class of the UltiTools module to simplify the annotation configuration.

This annotation includes automatic scanning and registration of commands, listeners and configuration files under this class package name.

If you want to manually register commands or listeners, you can set `eventListener` to `false` or `cmdExecutor` to `false`.

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;

@UltiToolsModule(
        // enable auto register listener
        eventListener = true,
        // enable auto register command executor
        cmdExecutor = true,
        // enable auto register config
        config = true,
        // scan package
        scanBasePackages = {"com.test.plugin"},
        // scan class
        scanBasePackageClasses = {},
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

`@UtiToolsModule` contains the `@EnableAutoRegister` annotation. If you cannot use `@UtiToolsModule`, you can use the `@EnableAutoRegister` annotation, such as if you want to use UltiTools' automatic registration in your own plugin.

Add this annotation above the class that extends `UltiToolsPlugin`, UltiTools will automatically register according to your configuration when loading your module:

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
    public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
        super(name, version, authors, depend, loadPriority, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        return true;
    }
    
    ...
}
```

## @ContextEntry

Add this annotation above the class that extends `UltiToolsPlugin`, UltiTools will automatically register Bean for the specified class when loading your module.

```java
@ContextEntry(MyBean.class)
public class UltiToolsConnector extends UltiToolsPlugin {

    // If you need to connect to UltiTools-API, you need to override this constructor with parameters,
    // the other one without parameters is for module development.
    public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
        super(name, version, authors, depend, loadPriority, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        return true;
    }
    
    ...
}
```

## @CmdExecutor

Class that extends `AbstractCommandExecutor` with this annotation will be automatically registered when the command is automatically scanned and registered.

For details please see [Command Executor](/guide/essentials/cmd-executor)

## @EventListener 

Class that implements `Listener` with this annotation will be automatically registered when the listener is automatically scanned and registered.

For details please see [Event Listener](/guide/essentials/event-listener)
