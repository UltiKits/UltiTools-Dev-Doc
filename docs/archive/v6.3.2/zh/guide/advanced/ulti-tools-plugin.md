::: warning 🚧 本页尚待完善
`UltiToolsPlugin` 的完整类参考在 [Javadoc](/api/) 页面。
:::

::: tip 🐌 本页更新速度较慢
当前 API 以 [Javadoc](/api/) 为准。
:::

::: danger v6.3.0 起已移除
`getVersionWrapper()` 及其返回的 `VersionWrapper` 接口已在 v6.3.0 中被彻底删除，连同 `DefaultVersionWrapper` 一起。
v6.3.0 的 jar 里两者都不存在，下方的方法列表已相应移除该行。
请改用 `XVersionUtils` 的静态方法；已移除的 [`VersionWrapper` API](/api/version-wrapper) 仍可在 6.2.5 Javadoc 中查阅。
:::

# 类 `UltiToolsPlugin`

包 `com.ultikits.ultitools.abstracts`

- java.lang.Object
  - com.ultikits.ultitools.abstracts.UltiToolsPlugin

代表一个 UltiTools 模块及其主类. 其包含了模块正常加载并工作所需的基础方法和字段. 这是一个 IPlugin 的间接实现.

> 作者: wisdomme
>
> 自 6.0.0 可用
> 
> 版本: 1.0.0

已实现的接口: `IPlugin`, `Localized`, `Configurable`

public abstract class **UltiToolsPlugin** extends java.lang.Object implements IPlugin, Localized, Configurable

## 构造器概要

自 v6.3.0 起，六参数构造器已移除。标准模块使用无参构造器，连接器则使用七参数构造器并显式传入 `resourceFolderPath`。`reloadSelf()` 与 `unregisterSelf()` 为 `final`，自定义工作写在 `onReload()` 与 `onUnregister()` 中。

:::tabs
== 构造器
`protected UltiToolsPlugin()`<br>`public UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath)`
:::

## 方法概要

下表只列出部分公开 API。该类还提供 `getConfigs(Class)`、`getConfiguredLanguage()`、`reloadWithReport()`、`isNewerVersionThan(...)`，受保护的钩子 `onUnregister()`、`onReload()` 与 `onReload(ReloadReport)`，以及 `getPluginName()`、`getVersion()`、`getContext()` 等 getter。完整列表见 [Javadoc](/api/)。

:::tabs
== 所有方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | getCommandManager\()                                                        |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `final <T extends BaseDataEntity<String>> DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `final Language`                                | getLanguage\()                                                              |
| `final java.lang.String`                        | getLanguageCode()                                                           |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `final java.lang.String`                        | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
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
| `final <T extends BaseDataEntity<String>> DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `final Language`                                | getLanguage\()                                                              |
| `final java.lang.String`                        | getLanguageCode()                                                           |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `final java.lang.String`                        | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType) throws java.io.IOException |

== 具体方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | getCommandManager\()                                                        |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `final <T extends BaseDataEntity<String>> DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `final Language`                                | getLanguage\()                                                              |
| `final java.lang.String`                        | getLanguageCode()                                                           |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
| `java.lang.String`                              | i18n\(java.lang.String str)                                                 |
| `final java.lang.String`                        | i18n\(java.lang.String code, java.lang.String str)<br>通过指定的语言代码返回一个本地化的字符串。 |
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
`protected UltiToolsPlugin()`<br>`public UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath)`
:::