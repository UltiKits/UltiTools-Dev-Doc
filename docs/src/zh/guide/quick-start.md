---
footer: false
---

# 快速开始

在这篇文章中，将会教你如何创建一个 UltiTools 模块。以及如何在自己的插件中使用UltiTools-API。

[//]: # (## 使用 IDEA 插件快速创建)

[//]: # ()

[//]: # (UltiKits 开发了官方的 IDEA 插件，你可以使用他来快速创建项目。)

## 创建 Paper 项目

万事万物都起源于一个空项目，所以你需要创建一个空的Paper项目。你可以使用IDEA的[Minecraft插件](https://plugins.jetbrains.com/plugin/8327-minecraft-development)
来快速创建一个空的Paper项目，或者手动创建一个空的maven项目。

## 添加依赖项

不管是创建一个UltiTools模块还是使用 UltiTools-API，你都需要在你的 Java 项目中，将 UltiTools-API 添加到你的依赖项中。

::: code-group

```xml [Maven]
<dependency>
  <groupId>com.ultikits</groupId>
  <artifactId>UltiTools-API</artifactId>
  <version>6.3.0</version>
  <scope>provided</scope>
</dependency>
```

```groovy [Gradle]
dependencies {
  compileOnly 'com.ultikits:UltiTools-API:6.3.0'
}
```

:::

最新的UltiTools-API版本号，可以在 [Maven Central](https://search.maven.org/artifact/com.ultikits/UltiTools-API) 中查看。

添加完成后重载你的项目。

## 创建一个UltiTools的模块

以下内容将会教你如何创建一个UltiTools的模块。如果你只是想在自己的插件中使用UltiTools-API，可以跳转到 [使用UltiTools-API](#使用ultitools-api)。

### 创建模块元数据文件

在你开始编写代码之前，你需要在 `resources` 文件夹中创建一个 `plugin.yml` 文件。

UltiTools 在加载该模块之前会先读取该文件，以便确认该模块的主类等信息。

::: tip 自 v6.3.0 起
没有可读的 `plugin.yml`、没有 `main:` 声明，或 `main:` 指向的类不是具体的 `UltiToolsPlugin`
子类的模块 jar，会在加载时被拒绝，并给出具体原因。
:::

当 `main:` 指向一个不存在的类时，拒载的那一行后面会跟着 `ClassNotFoundException` 的堆栈。这是预期行为：
堆栈是有意打印的，便于看清是哪一次类查找失败。完全没有 `main:` 声明的 jar 被拒载时不打印堆栈。

```yaml
# 模块名称
name: TestPlugin
# 模块版本
version: '${project.version}'
# 模块主类
main: com.test.plugin.MyPlugin
# 模块用到的 UltiTools API 级别，例如 6.3.0 为 630
api-version: 630
# 模块作者
authors: [ yourname ]
# UltiTools 检查更新时使用的唯一标识符
identify-string: test-plugin
```

自 v6.3.0 起，为 UltiTools-API 6.3.0 构建的模块应声明 `api-version: 630`；6.3.0 上的 `/upm` 只安装声明 `630`（框架自身 API 级别）的模块（见[模块版本规范](/zh/guide/advanced/module-versioning)）。

### 编写模块主类

新建一个主类继承 `UltiToolsPlugin`，实现 `registerSelf()` 完成启动工作。
可选的 `onReload()` 和 `onUnregister()` 钩子分别处理自定义重载与卸载工作；没有自定义工作时可以省略。

::: tip 自 v6.3.0 起
`reloadSelf()` 与 `unregisterSelf()` 是 `final` 方法，改为重写 `onReload()` 与
`onUnregister()`。
:::

`onUnregister()` 在框架注销该模块的命令与监听器之前运行，此时模块自身的 bean 仍然存活。`onReload()` 在框架自身的重载步骤之后运行：配置重载与语言目录刷新。

执行 `/ul reload` 时，框架会在 `onReload()` 返回之后记录一行日志，写明模块名称。如果模块原有的重写只是记录自己的重载日志，这个重写可以直接删除。如果模块有实际的重载或卸载工作，把原有的 `reloadSelf()`/`unregisterSelf()` 重写改名为 `onReload()`/`onUnregister()`。从改名后的钩子中删除所有 `super.unregisterSelf()` 调用，保留模块自己的实际清理逻辑；框架会在 `onUnregister()` 返回后注销命令和监听器。

自 v6.3.0 起，`onUnregister()` 可以抛出任何异常，包括它没有声明的受检异常。框架仍会注销该模块的命令和监听器、关闭它的容器并把它从已加载列表中移除，然后把钩子自己的异常原样重新抛给调用方，是同一个实例，不做包装。如果之后的清理步骤也失败，该失败会作为被抑制异常附加到钩子的异常上，而不会取代它。

<<< @/../examples/src/main/java/com/ultikits/docs/quickstart/MyPlugin.java

这样就已经完成了一个什么功能都没有的UltiTools模块。

### 重载结果

自 v6.3.0 起，`/ul reload` 与 `/ul reload <模块名>` 会如实报告每个模块的重载结果：

- 框架只在 `onReload()` 返回之后才记录该模块的重载日志行。如果某个重载步骤或 `onReload()` 抛出异常，框架改为记录一行错误日志，写明模块名称和原因，不会再记录成功日志行。
- `/ul reload <模块名>` 回复成功；重载抛出异常时回复失败及原因。
- `/ul reload` 在某个模块失败时仍会重载其余所有模块，最后回复一条汇总：全部模块已重载，或哪些模块失败。

只完成了一部分的重载，可以不抛异常而直接说明。改为重写 `onReload(ReloadReport report)`，用 `report.partial(...)` 记下每一个没有重载的部分：

```java
@Override
protected void onReload(ReloadReport report) {
    try {
        scoreboardService.restart();
    } catch (RuntimeException e) {
        getLogger().error(e, "计分板服务未能重启");
        report.partial("计分板服务未能重启：" + e.getMessage());
    }
}
```

框架随后会记录一条警告日志列出这些部分，代替成功日志行；`/ul reload <模块名>` 回复这些部分，代替成功回复；`/ul reload` 的汇总也会列出该模块及这些部分。框架自身重载步骤中未生效的部分也记在同一份报告里：自 v6.3.0 起，被拒绝并保留旧值的配置绑定 `@Scheduled` 或 `@CmdCD` 值也会列在其中（[#595](https://github.com/UltiKits/UltiTools-Reborn/issues/595)）。`onReload(ReloadReport)` 的默认实现调用 `onReload()`，因此只重写 `onReload()` 的模块行为不变。重载完全无法继续时，应当抛出异常。`reloadSelf()` 的签名不变；`reloadWithReport()` 执行同样的重载并返回 `ReloadReport`，供模块自己的重载命令使用。

框架 `config.yml` 中的 `language` 设置对整个服务器只有一个值，`/ul reload <模块名>` 不会把改动后的值只应用到一个模块上。磁盘上的值改变后，该模块继续使用框架当前运行的语言，重载被报告为部分完成，写明新旧两个值，并说明执行完整的 `/ul reload` 才会生效。

### 已加载模块列表

自 v6.3.0 起，`getPluginManager().getPluginList()` 返回已加载模块的不可修改快照，取自调用那一刻。在任何线程遍历它都是安全的，对它添加或删除元素会抛出 `UnsupportedOperationException`。`PluginManager.unregister(...)` 会自行把卸载的模块移出列表。

## 使用UltiTools-API

::: tip 自 v6.2.2 起
你可以使用更简单的外部插件 API：在你的插件 `onEnable()` 中调用 `UltiToolsAPI.connect(this)` 即可。详情请参阅[外部插件 API 指南](./advanced/external-plugin-api.md)。
:::

以下部分介绍的是旧版连接器方式，该方式仍受支持，但不再推荐用于新项目。自 v6.3.0 起，六参数构造器已移除，连接器使用显式接收 `resourceFolderPath` 的七参数构造器；新的集成应在自己的 `JavaPlugin` 中使用外部插件 API。

### 创建入口类（旧版）

新建一个类继承 `UltiToolsPlugin` ，这个类将会作为你的插件的入口类。

<<< @/../examples/src/main/java/com/ultikits/docs/quickstart/UltiToolsConnector.java

集成它的插件需要传入全部七个参数来构造连接器，包括自己的资源目录。标准模块则使用上文[创建一个UltiTools的模块](#创建一个ultitools的模块)中的无参主类。

### 将入口类注册到UltiTools插件管理器（旧版）

旧版集成先构造连接器，再把实例传给 `UltiToolsPlugin.getPluginManager().register(connector)`，并在使用前检查返回的布尔值。这使用的是 `register(UltiToolsPlugin)` 重载，不通过反射调用构造器。

自 v6.3.0 起，反射式 `register(Class, Object...)` 重载与六参数构造器均已移除，不要再向 `register(...)` 传入元数据实参。新的独立插件使用[外部插件 API](./advanced/external-plugin-api.md)，标准模块则使用上方的无参主类。

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
