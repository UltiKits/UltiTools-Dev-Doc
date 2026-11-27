::: warning 🚧 本页尚待完善
`UltiToolsPlugin` 的完整类参考在 [Javadoc](/api/) 页面。
:::

::: tip 🐌 本页更新速度较慢
当前 API 以 [Javadoc](/api/) 为准。
:::

::: danger v6.3.0 起已移除
`getVersionWrapper()` 及其返回的 `VersionWrapper` 接口已在 v6.3.0 中被彻底删除，连同 `DefaultVersionWrapper` 一起。
v6.3.0 的 jar 里两者都不存在，下方的方法列表已相应移除该行。
在 6.x 中请改用 `XVersionUtils` 的静态方法；已移除的 [`VersionWrapper` API](/api/version-wrapper) 仍可在 6.2.5 Javadoc 中查阅。
:::

::: warning 未发布的 v7.0.0 迁移说明
自 v7.0.0 起，`XVersionUtils` 也已移除，请使用 Paper 原生的物品、音效、附魔和 Adventure API。
替代方式见 [7.0 原生物品与音效 API](/zh/guide/advanced/upgrading-to-7#items-and-sounds)。
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

已实现的接口: `IPlugin`, `Configurable`

public abstract class **UltiToolsPlugin** extends java.lang.Object implements IPlugin, Configurable

## 构造器概要

自 v6.3.0 起，六参数构造器已移除。标准模块使用无参构造器，连接器则使用七参数构造器并显式传入 `resourceFolderPath`。`reloadSelf()` 与 `unregisterSelf()` 为 `final`，自定义工作写在 `onReload()` 与 `onUnregister()` 中。

:::tabs
== 构造器
`protected UltiToolsPlugin()`<br>`public UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath)`
:::

## 方法概要

下表只列出部分公开 API。该类还提供 `getConfigs(Class)`、`reloadWithReport()`、`isNewerVersionThan(...)`，受保护的钩子 `onUnregister()`、`onReload()` 与 `onReload(ReloadReport)`，以及 `getPluginName()`、`getVersion()`、`getContext()` 等 getter。完整列表见 [Javadoc](/api/)。

::: tip 消息服务（自 v7.0.0 起）
模块通过注入的 `Messages` 服务渲染文本，见[消息与语言](/zh/guide/essentials/messages)。
:::

:::tabs
== 所有方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | getCommandManager\()                                                        |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `final <T extends BaseDataEntity<String>> DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
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
| `<T extends AbstractConfigEntity> void`         | saveConfig\(java.lang.String path, java.lang.Class\<T> configType) throws java.io.IOException |

== 具体方法

| 限定符和类型                                          | 方法和说明                                                                       |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| `static CommandManager `                        | getCommandManager\()                                                        |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.Class\<T> configType)                                  |
| `<T extends AbstractConfigEntity> T`            | getConfig\(java.lang.String path, java.lang.Class\<T> configType)           |
| `static ConfigManager `                         | getConfigManager\()                                                         |
| `final <T extends BaseDataEntity<String>> DataOperator<T>` | getDataOperator\(java.lang.Class\<T> dataClazz)                             |
| `static ListenerManager`                        | getListenerManager\()                                                       |
| `static PluginManager`                          | getPluginManager\()                                                         |
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

::: info com.ultikits.ultitools.interfaces.Configurable
getAllConfigs, getConfig, saveConfig
:::

## 构造器详细资料
::: info UltiToolsPlugin
`protected UltiToolsPlugin()`<br>`public UltiToolsPlugin(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath)`
:::