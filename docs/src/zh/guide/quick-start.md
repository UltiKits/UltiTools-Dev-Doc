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
  <version>6.2.5</version>
  <scope>provided</scope>
</dependency>
```

```groovy [Gradle]
dependencies {
  compileOnly 'com.ultikits:UltiTools-API:6.2.5'
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

```yaml
# 模块名称
name: TestPlugin
# 模块版本
version: '${project.version}'
# 模块主类
main: com.test.plugin.MyPlugin
# 模块用到的UltiTools-API版本，例如6.2.0就是620
api-version: 620
# 模块作者
authors: [ yourname ]
# UltiTools 检查更新时使用的唯一标识符
identify-string: test-plugin
```

### 编写模块主类

新建一个主类继承 `UltiToolsPlugin` ，类似传统的Paper插件，UltiTools模块也需要重写启动和关闭方法。
但是UltiToolsPlugin增加了一个可选的 `UltiToolsPlugin#reloadSelf()` 方法，用于模块重载时执行。

<<< @/../examples/src/main/java/com/ultikits/docs/quickstart/MyPlugin.java

这样就已经完成了一个什么功能都没有的UltiTools模块。

## 使用UltiTools-API

::: tip 自 v6.2.2 起
你可以使用更简单的外部插件 API：在你的插件 `onEnable()` 中调用 `UltiToolsAPI.connect(this)` 即可。详情请参阅[外部插件 API 指南](./advanced/external-plugin-api.md)。
:::

以下部分介绍的是旧版连接器方式，该方式仍然受支持，但不再推荐用于新项目。它的六参数构造器已标记为待移除，优先使用在你自己的 `JavaPlugin` 里调用的外部插件 API，或接收 `resourceFolderPath` 的七参数重载；替代签名仍在 [issue #217](https://github.com/UltiKits/UltiTools-Reborn/issues/217) 中讨论，移除动作跟踪于 [issue #213](https://github.com/UltiKits/UltiTools-Reborn/issues/213)。

### 创建入口类（旧版）

新建一个类继承 `UltiToolsPlugin` ，这个类将会作为你的插件的入口类。

<<< @/../examples/src/main/java/com/ultikits/docs/quickstart/UltiToolsConnector.java

这个类只有在你把模块打成 JAR、交由 UltiTools 走标准模块加载路径时才会起作用，见上文[创建一个 UltiTools 的模块](#创建一个ultitools的模块)。

### 将入口类注册到UltiTools插件管理器（旧版）

不由 UltiTools 加载的插件，过去要手动把入口类注册到 UltiTools 插件管理器。

::: warning 六参数手动注册在 v6.2.5 上必定失败
下面曾经展示的 `register(pluginClass, name, version, authors, loadAfter, minUltiToolsVersion, mainClass)` 调用在 v6.2.5 上必定抛出异常：`validateConstructorArgs` 按类名前缀校验每个实参类型，`Collections.singletonList(...)` 与 `Collections.emptyList()` 产出的 `Collections$SingletonList`/`Collections$EmptyList` 都不匹配任何白名单前缀，触发的 `SecurityException` 被外层 `catch (Exception | Error)` 吞掉，只打日志并返回 `false`。
改用模块 JAR 的标准加载方式：把这个类打进带有本页前文所述 `plugin.yml` 的 JAR，放进 `plugins/UltiTools/plugins`，UltiTools 会通过无参构造器加载它，完全不会走到 `validateConstructorArgs`，也不会碰到手工构造 `ArrayList` 之后仍会命中的 `int` 与 `Integer` 精确匹配失败。
`register(...)` 是否应该接受这些实参类型，与连接器的替代签名一起在 [issue #217](https://github.com/UltiKits/UltiTools-Reborn/issues/217) 中讨论，六参数构造器本身已列入 [issue #213](https://github.com/UltiKits/UltiTools-Reborn/issues/213) 的移除清单。
:::

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
