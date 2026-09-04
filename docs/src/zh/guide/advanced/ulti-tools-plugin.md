::: warning 🚧 本页尚待完善
本页面仍存在大量内容空缺，有待于维护人员补充完整，你也可以点击文章内容底部的链接来完善文章。
:::

::: tip 🐌 本页更新速度较慢
完整的类参考在 [Javadoc](/api/) 页面。
:::

::: danger v6.3.0 起已移除
`getVersionWrapper()` 及其返回的 `VersionWrapper` 接口已在 v6.3.0 中被彻底删除，连同 `DefaultVersionWrapper` 一起。
v6.3.0 的 jar 里两者都不存在，下方的方法列表已相应移除该行。
请改用 `XVersionUtils` 的静态方法——历史映射关系见 [`VersionWrapper`](/zh/api/version-wrapper)。
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
| `static CommandManager `                        | getCommandManager\()                                                        |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `<T extends BaseDataEntity<String>>DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `Language`                                      | getLanguage\()                                                              |
| `java.lang.String`                              | getLanguageCode()                                                           |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `java.lang.String`                              | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType) throws java.io.IOException |

== 静态方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | getCommandManager\()                                                        |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |

== 实例方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `<T extends BaseDataEntity<String>>DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `Language`                                      | getLanguage\()                                                              |
| `java.lang.String`                              | getLanguageCode()                                                           |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `java.lang.String`                              | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType) throws java.io.IOException |

== 具体方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | getCommandManager\()                                                        |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `<T extends BaseDataEntity<String>>DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `Language`                                      | getLanguage\()                                                              |
| `java.lang.String`                              | getLanguageCode()                                                           |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `java.lang.String`                              | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType) throws java.io.IOException |

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