::: warning 🚧 本页尚待完善
本页面仍存在大量内容空缺，有待于维护人员补充完整，你也可以点击文章内容底部的链接来完善文章。
:::

::: tip 🐌 本页更新速度较慢
文章内容不一定是最新的，你可以前往 [Javadoc 文档](https://doc.dev.ultikits.com/javadoc) 来查看最新的内容
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

已实现的接口: `IPlugin`, `Localized`

public abstract class **UltiToolsPlugin** extends java.lang.Object implements IPlugin, Localized

## 构造器概要
:::tabs
== 构造器
`UltiToolsPlugin()`
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
| `static VersionWrapper`                         | getVersionWrapper\()                                                        |
| `static ViewManager`                            | getViewManager\()                                                           |
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
| `static VersionWrapper`                         | getVersionWrapper\()                                                        |
| `static ViewManager`                            | getViewManager\()                                                           |

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
| `static VersionWrapper`                         | getVersionWrapper\()                                                        |
| `static ViewManager`                            | getViewManager\()                                                           |
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
minUltiToolsVersion, pluginName, registerSelf, reloadSelf, unregisterSelf
:::

::: info com.ultikits.ultitools.interfaces.Localized
supported
:::

## 构造器详细资料
::: info UltiToolsPlugin
UltiToolsPlugin()
:::