---
footer: false
---

# 快速开始

在这篇文章中，将会教你如何创建一个 UltiTools 模块。以及如何在自己的插件中使用UltiTools-API。

[//]: # (## 使用 IDEA 插件快速创建)

[//]: # ()

[//]: # (UltiKits 开发了官方的 IDEA 插件，你可以使用他来快速创建项目。)

## 创建 Spigot 项目

万事万物都起源于一个空项目，所以你需要创建一个空的Spigot项目。你可以使用IDEA的[Minecraft插件](https://plugins.jetbrains.com/plugin/8327-minecraft-development)
来快速创建一个空的Spigot项目，或者手动创建一个空的maven项目。

## 添加依赖项

不管是创建一个UltiTools模块还是使用 UltiTools-API，你都需要在你的 Java 项目中，将 UltiTools-API 添加到你的依赖项中。

::: code-group

```xml [Maven]
<dependency>
  <groupId>com.ultikits</groupId>
  <artifactId>UltiTools-API</artifactId>
  <version>{VERSION}</version>
</dependency>
```

```groovy [Gradle]
dependencies {
  implementation 'com.ultikits:UltiTools-API:{VERSION}'
}
```

:::

最新的UltiTools-API版本号，可以在 [Maven Central](https://search.maven.org/artifact/com.ultikits/UltiTools-API) 中查看。

添加完成后重载你的项目。

## 创建一个UltiTools的模块

以下内容将会教你如何创建一个UltiTools的模块。如果你只是想使用UltiTools-API，可以跳转到 [使用UltiTools-API](#使用ultitools-api)。

### 创建模块元数据文件

在你开始编写代码之前，你需要在 `resources` 文件夹中创建一个 `plugin.yml` 文件。

UltiTools 在加载该模块之前会先读取该文件，以便确认该模块的主类等信息。

```yaml
# 模块名称
name: TestPlugin
# 模块版本
version: '${project.version}'
# 模块主类
main: com.test.plugin.MyPlugin
# 模块用到的UltiTools-API版本，例如6.0.0就是600
api-version: 600
# 模块作者
authors: [ yourname ]
```

### 编写模块主类

新建一个主类继承 `UltiToolsPlugin` ，类似传统的Spigot插件，UltiTools模块也需要重写启动和关闭方法。
但是UltiToolsPlugin增加了一个可选的 `UltiToolsPlugin#reloadSelf()` 方法，用于模块重载时执行。

```java
public class MyPlugin extends UltiToolsPlugin {
  @Override
  public boolean registerSelf() {
    // 插件启动时执行
    return true;
  }

  @Override
  public void unregisterSelf() {
    // 插件关闭时执行
  }

  @Override
  public void reloadSelf() {
    // 插件重载时执行
  }
}
```

这样就已经完成了一个什么功能都没有的UltiTools模块。

## 使用UltiTools-API

### 创建入口类

新建一个类继承 `UltiToolsPlugin` ，这个类将会作为你的插件的入口类。

```java
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

  // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
  // 在这里请不要主动使用无参数的构造函数
  public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
    super(name, version, authors, depend, loadPriority, mainClass);
  }

  @Override
  public boolean registerSelf() throws IOException {
    return false;
  }

  @Override
  public void unregisterSelf() {

  }

  @Override
  public void reloadSelf() {
    super.reloadSelf();
  }
}
```

### 将入口类注册到UltiTools插件管理器

由于你的插件并不是由UltiTools加载，所以你需要手动将你的入口类注册到UltiTools插件管理器中。

```java
import com.ultikits.ultitools.UltiTools;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Collections;

public final class UltiKitsExample extends JavaPlugin {
  @Override
  public void onEnable() {
    // 将此连接类注册到UltiTools的模块/插件管理器中
    UltiTools.getInstance().getPluginManager().register(
      UltiToolsConnector.class,
      "Example",  // 模块名称
      "1.0.0",  // 模块版本
      Collections.singletonList("wisdomme"),  // 模块作者
      Collections.emptyList(),  // 模块依赖
      600,  // UltiTools API 需求最低版本
      "com.ultikits.plugin.ultikitsapiexample.UltiToolsConnector"  // 模块主类
    );

    System.out.println();
  }

  @Override
  public void onDisable() {
    // 记得在插件卸载时将连接类从UltiTools的模块/插件管理器中注销
    UltiTools.getInstance().getPluginManager().unregister(UltiToolsConnector.getInstance());
  }
}

```

## 验证安装

如果是模块，将模块放入插件文件夹/UltiTools/plugins文件夹中，重新启动服务器。

如果是连接到UltiTools的插件，将插件放入插件文件夹，重新启动服务器。

在游戏中OP或者在命令行中使用这个命令来验证你是否成功连接到了UltiTools。

```shell
ul list
```

如果一切正常的话，你应该会在输出中看到你的插件的名字和版本。

```text
ul list
[12:42:16] [Server thread/INFO]: BasicFunctions 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-Login 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-MysqlConnector 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-SidebarPlugin 1.0.0
[12:42:16] [Server thread/INFO]: Example 1.0.0           <--- 这是我们的示例插件
```

在后续的文章中，将会教你有关命令、事件、配置文件、数据存储、开发注解等的使用方法。
