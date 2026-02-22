---
footer: false
---

# Quick Start

In this article, you will learn how to create an UltiTools module and how to use UltiTools-API in your own plugin.

[//]: # (## 使用 IDEA 插件快速创建)

[//]: # ()

[//]: # (UltiKits 开发了官方的 IDEA 插件，你可以使用他来快速创建项目。)

## Create a new Paper project

Everything starts with an empty project, so you need to create an empty Paper project.
You can use IDEA's [Minecraft plugin](https://plugins.jetbrains.com/plugin/8327-minecraft-development)
to quickly create an empty Paper project, or manually create an empty maven project.

## Add UltiTools-API to your project

Whether you are creating an UltiTools module or using UltiTools-API, you need to add UltiTools-API to your dependencies in your Java project.

::: code-group

```xml [Maven]
<dependency>
  <groupId>com.ultikits</groupId>
  <artifactId>UltiTools-API</artifactId>
  <version>6.2.3</version>
</dependency>
```

```groovy [Gradle]
dependencies {
  implementation 'com.ultikits:UltiTools-API:6.2.3'
}
```

:::

The newest version of UltiTools-API can be found in [Maven Central](https://search.maven.org/artifact/com.ultikits/UltiTools-API).

Reload your project after adding the dependency.

## Create a new UltiTools module

The following content will teach you how to create an UltiTools module. 

If you just want to use UltiTools-API in your own plugin, you can jump to [Use UltiTools-API](#use-ultitools-api).

### Create a module metadata file

Before you start writing code, you need to create a `plugin.yml` file in the `resources` folder.

UltiTools will read this file before loading the module to confirm the main class of the module.

```yaml
# Module name
name: TestPlugin
# Module version
version: '${project.version}'
# Module main class
main: com.test.plugin.MyPlugin
# UltiTools API version, for example 6.2.0 is 620
api-version: 620
# Module authors
authors: 
  - yourname
```

### Create the main class of the module

Create a new class that extends `UltiToolsPlugin`, similar to traditional Paper plugins,
UltiTools modules also need to override the startup and shutdown methods.
But UltiToolsPlugin adds an optional `UltiToolsPlugin#reloadSelf()` method for execution when the module is reloaded.

```java
// This annotation contains automatic registration and must be added to the module main class
@UltiToolsModule
public class MyPlugin extends UltiToolsPlugin {
    @Override
    public boolean registerSelf() {
      // Executed when the module is started
      // If false is returned, UltiTools will not load this module
      return true;
    }
    
    @Override
    public void unregisterSelf() {
      // Optional, 
      // if you only need to unregister all commands and listeners, 
      // you don't need to override this method
      // Executed when the module is unregistered
    }
    
    @Override
    public void reloadSelf() {
      // Optional,
      // if you only need to reload the module configuration file,
      // you don't need to override this method
      // Executed when the module is reloaded
    }
}
```

Then you have completed an UltiTools module that does nothing.

## Use UltiTools-API

::: tip Since v6.2.2
You can use the simpler External Plugin API: `UltiToolsAPI.connect(this)` in your plugin's `onEnable()`. See the [External Plugin API guide](../advanced/external-plugin-api.md) for details.
:::

The following section describes the legacy connector approach, which is still supported but no longer recommended for new projects.

### Create a connector class (Legacy)

Create a new class that extends `UltiToolsPlugin`, this class will be the connector class of your plugin.

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.EnableAutoRegister;

import java.io.IOException;
import java.util.List;

// This annotation is required for automatic registration
@EnableAutoRegister(scanPackage = "com.ultikits.plugin.ultikitsapiexample")
public class UltiToolsConnector extends UltiToolsPlugin {

    // If you need to connect to UltiTools-API, you need to override this constructor with parameters,
    // the other one without parameters is for module development.
    // Please do not use the constructor without parameters here
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass) {
      super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass);
    }
    @Override
    public boolean registerSelf() {
        // Executed when the module is started
        // If false is returned, UltiTools will not load this module
        return true;
    }

    @Override
    public void unregisterSelf() {
        // Optional,
        // if you only need to unregister all commands and listeners,
        // you don't need to override this method
        // Executed when the module is unregistered
    }

    @Override
    public void reloadSelf() {
        // Optional,
        // if you only need to reload the module configuration file,
        // you don't need to override this method
        // Executed when the module is reloaded
    }
}
```

### Register your connector class (Legacy)

Since your plugin is not loaded by UltiTools, you need to manually register your connector class to the UltiTools plugin manager.

```java
import com.ultikits.ultitools.UltiTools;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Collections;

// Your plugin main class
public final class UltiKitsExample extends JavaPlugin {
    @Override
    public void onEnable() {
        // Register this connector class to the UltiTools plugin manager
        UltiTools.getInstance().getPluginManager().register(
                UltiToolsConnector.class,
                "Example",  // Plugin name
                "1.0.0",  // Version
                Collections.singletonList("wisdomme"),  // Authors
                Collections.emptyList(),  // Load after
                620,  // UltiTools API minimum version
                "com.ultikits.plugin.ultikitsapiexample.UltiToolsConnector"  // Full class name of the connector class
        );
    }

    @Override
    public void onDisable() {
        // Remember to unregister the connector class from the UltiTools plugin manager when the plugin is unloaded
        UltiTools.getInstance().getPluginManager().unregister(UltiToolsConnector.getInstance());
    }
}

```

## Verify installation

If it is a module, put the module in the `plugins/UltiTools/plugins` folder and restart the server.

If it is a plugin connected to UltiTools, put the plugin in the `plugins` folder and restart the server.

Use this command in the game by OP or in the command line to verify that you have successfully connected to UltiTools.

```shell
ul list
```

If everything goes well, you should see the name and version of your plugin in the output.

```text
ul list
[12:42:16] [Server thread/INFO]: BasicFunctions 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-Login 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-MysqlConnector 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-SidebarPlugin 1.0.0
[12:42:16] [Server thread/INFO]: Example 1.0.0           <--- This is our plugin
```

In the following articles, you will learn how to use commands, events, configuration files, data storage, development annotations, etc.
