::: warning 🚧 This page is under construction
The content of this page may not be the latest. You can go to [Javadoc](https://doc.dev.ultikits.com/javadoc) to see the latest content.
:::

::: tip 🐌 This page update slowly
The content of this page may be outdated. You can go to [Javadoc](https://doc.dev.ultikits.com/javadoc) to see the latest content.
:::

# 类 `UltiToolsPlugin`

包 `com.ultikits.ultitools.abstracts`

- java.lang.Object
  - com.ultikits.ultitools.abstracts.UltiToolsPlugin

代表一个 UltiTools 模块及其主类. 其包含了模块正常加载并工作所需的基础方法和字段. 这是一个 IPlugin 的间接实现.

> 作者: wisdomme, qianmo
>
> 自 6.0.0 可用
> 
> 版本: 1.0.0

已实现的接口: `IPlugin`, `Localized`, `Configurable`

public abstract class **UltiToolsPlugin** extends java.lang.Object implements IPlugin, Localized, Configurable

## 构造器概要
:::tabs
== 构造器
`protected UltiToolsPlugin()`<br>`UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass)` `@Deprecated`<br>`UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath)`
:::

## 方法概要
:::tabs
== 所有方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | static CommandManager                                                       |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `<T extends BaseDataEntity<String>>DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `Language`                                      | getLanguage\()                                                              |
| `java.lang.String`                              | getLanguageCode()                                                           |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `static VersionWrapper`                         | getVersionWrapper\() `@Deprecated`                                          |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `java.lang.String`                              | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType)          |

== 静态方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | static CommandManager                                                       |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `static VersionWrapper`                         | getVersionWrapper\() `@Deprecated`                                          |

== 实例方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `<T extends BaseDataEntity<String>>DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `Language`                                      | getLanguage\()                                                              |
| `java.lang.String`                              | getLanguageCode()                                                           |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `java.lang.String`                              | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType)          |

== 具体方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | static CommandManager                                                       |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `<T extends BaseDataEntity<String>>DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `Language`                                      | getLanguage\()                                                              |
| `java.lang.String`                              | getLanguageCode()                                                           |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `static VersionWrapper`                         | getVersionWrapper\() `@Deprecated`                                          |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `java.lang.String`                              | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType)          |

:::

### 从类继承的方法
::: info java.lang.Object
equals, getClass, hashCode, notify, notifyAll, toString, wait, wait, wait
:::

### 从接口继承的方法
::: info com.ultikits.ultitools.interfaces.IPlugin
registerSelf, reloadSelf, unregisterSelf
:::

::: info com.ultikits.ultitools.interfaces.Localized
supported
:::

::: info com.ultikits.ultitools.interfaces.Configurable
getAllConfigs, getConfig, saveConfig
:::

## 构造器详细资料
::: info UltiToolsPlugin
`protected UltiToolsPlugin()`<br>`UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass)` `@Deprecated`<br>`UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath)`
:::
