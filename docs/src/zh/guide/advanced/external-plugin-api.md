# 外部插件 API

::: info 自 v6.2.2 起
UltiTools-API 6.2.2 及更高版本可用。
:::

外部插件 API 允许**任何普通的 Bukkit/Spigot 插件**使用 UltiTools 框架功能，无需继承 `UltiToolsPlugin`。你的插件保持普通的 `JavaPlugin` 不变——只需调用 `UltiToolsAPI.connect(this)`，框架就会扫描你的包中的 `@Service`、`@CmdExecutor`、`@EventListener`、`@Scheduled` 等注解。

## 快速开始

### 1. 添加依赖

**Maven**
```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>6.2.4</version>
    <scope>provided</scope>
</dependency>
```

### 2. 在 plugin.yml 中声明依赖

```yaml
name: MyExternalPlugin
version: '1.0.0'
main: com.example.myplugin.MyExternalPlugin
depend: [UltiTools]
```

::: warning
`depend: [UltiTools]` 是**必须的**。UltiTools 必须在你的插件之前加载，这样调用 `connect()` 时框架才可用。
:::

### 3. 连接和断开

<<< @/../examples/src/main/java/com/ultikits/docs/external/MyExternalPlugin.java

就这样。框架会自动扫描 `com.example.myplugin`（从主类名推导出）中的注解类。

## 扫描内容

调用 `connect()` 时，框架扫描你插件的基础包并注册：

| 注解 | 功能 |
|------|------|
| `@Service` | 注册为 IoC 容器中的 Bean |
| `@CmdExecutor` | 命令类自动注册到 Bukkit |
| `@EventListener` | 监听器自动注册到 Bukkit |
| `@Scheduled` | 方法注册为 Bukkit 定时任务 |
| `@PlayerCache` | 字段按玩家跟踪，自动保存/加载 |
| `@ModuleEventHandler` | 订阅 UltiTools 事件总线 |

## 编写服务

服务的写法与 UltiTools 模块完全一样——使用 `@Service` 和 `@Autowired`：

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetingService.java

## 编写命令

像 UltiTools 模块一样使用 `@CmdExecutor` 和 `@CmdMapping`：

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetCommand.java

::: tip
命令描述使用 `@CmdExecutor` 的原始 `description` 属性。外部插件不支持 `i18n()` 方法——请使用纯字符串。
:::

## 编写事件监听器

<<< @/../examples/src/main/java/com/ultikits/docs/external/JoinListener.java

## 数据存储

使用 `UltiToolsAPI.getDataOperator()` 获取数据操作器。数据存储在**你插件自己的数据文件夹**中，而不是 UltiTools 的文件夹。

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsEntity.java

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsService.java

::: tip
存储后端（JSON、SQLite 或 MySQL）由 UltiTools 服务端配置决定，而非你的插件。你的代码无论使用哪种后端都一样。查询列名必须使用实体的 @Column 值，而不是 Java 字段名。
:::

## 事件总线

使用 `UltiToolsAPI.getEventBus()` 进行插件间通信：

```java
// 发布事件
UltiToolsAPI.getEventBus().publish(new MyCustomEvent(data));

// 在 @Service 类中通过注解订阅
@ModuleEventHandler
public void onCustomEvent(MyCustomEvent event) {
    // 处理来自任何模块或外部插件的事件
}
```

## API 参考

| 方法 | 描述 |
|------|------|
| `UltiToolsAPI.connect(JavaPlugin)` | 将插件连接到 UltiTools 框架 |
| `UltiToolsAPI.disconnect(JavaPlugin)` | 断开插件与框架的连接 |
| `UltiToolsAPI.isConnected(JavaPlugin)` | 检查插件是否已连接 |
| `UltiToolsAPI.getDataOperator(JavaPlugin, Class)` | 获取限定在插件数据文件夹的 DataOperator |
| `UltiToolsAPI.getEventBus()` | 获取共享的 EventBus 实例 |

## 生命周期

- **自动断开**：如果你的插件被禁用（服务器停止、`/reload`），UltiTools 会通过 `PluginDisableEvent` 监听器自动断开连接。你不一定需要在 `onDisable()` 中调用 `disconnect()`，但这是个好习惯。
- **UltiTools 关闭**：当 UltiTools 自身关闭时，所有外部插件会通过 `disconnectAll()` 自动断开。
- **清理**：断开连接时，你的插件注册的所有命令、监听器、定时任务、事件总线订阅和玩家缓存 Bean 都会被移除。

## 与 UltiTools 模块的区别

| 功能 | UltiTools 模块 | 外部插件 |
|------|---------------|---------|
| 基类 | `extends UltiToolsPlugin` | `extends JavaPlugin` |
| 注册方式 | `@UltiToolsModule` + `registerSelf()` | `UltiToolsAPI.connect(this)` |
| 国际化 | `plugin.i18n("key")` 可用 | 不可用——使用纯字符串 |
| 配置实体 | 完整支持（`@ConfigEntity`） | **不可用** — 请使用 Bukkit `getConfig()` |
| 数据存储 | `plugin.getDataOperator(Class)` | `UltiToolsAPI.getDataOperator(plugin, Class)` |
| 热重载 | 支持 `ul reload` | 不支持——需要重启服务器 |
| plugin.yml | `api-version: 620` | `depend: [UltiTools]` |

## 完整示例项目

查看 [UltiTools-External-Example](https://github.com/UltiKits/UltiTools-External-Example) 仓库，获取一个完整的示例项目，演示了在标准 Bukkit 插件中使用 `@Service`、`@CmdExecutor`、`@EventListener`、`@Autowired` 和 `DataOperator` CRUD。

::: tip
另见：[IoC 容器](/zh/guide/advanced/ioc-container) | [命令执行器](/zh/guide/essentials/cmd-executor) | [定时任务](/zh/guide/advanced/scheduled-tasks) | [模块事件总线](/zh/guide/advanced/module-eventbus)
:::
