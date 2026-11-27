# 外部插件 API

7.0.0 尚未发布。本指南说明自 v7.0.0 起在 Paper 26.3、Java 25 上使用的 API。已有 6.x 插件可先查阅[升级指南](./upgrading-to-7#external-paper-plugins)或 [6.4.0 归档指南](/zh/v6.4.0/guide/advanced/external-plugin-api.html)。

外部插件仍是普通 `JavaPlugin`，由 Paper 从 `plugins/` 目录加载，不由 UltiTools 作为模块加载。连接后，插件组件可以使用 UltiTools 的依赖注入、命令、数据等功能，无需继承 `UltiToolsPlugin`。

## 快速开始

### 1. 构建依赖

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>7.0.0-SNAPSHOT</version>
    <scope>provided</scope>
</dependency>
```

预览开发使用[快照仓库或对应的本地构建](/zh/guide/quick-start)。7.0.0 发布后改用 `7.0.0`。不要把 UltiTools-API 打进插件 JAR；Gradle 使用 `compileOnly`。

### 2. 服务端依赖

```yaml
name: MyExternalPlugin
version: '1.0.0'
main: com.ultikits.docs.external.MyExternalPlugin
api-version: '26.3'
depend: [UltiTools]
```

自 v7.0.0 起，UltiTools 自身是 Paper 插件，但 Paper 26.3 上使用普通 `plugin.yml` 的插件仍可声明 `depend: [UltiTools]`。如果启用时一定会调用 `connect`，就用这个写法，让 Paper 先加载并启用 UltiTools。只有可选集成才用 `softdepend: [UltiTools]`：没有 UltiTools，Paper 也可以启用你的插件。此时先检查 UltiTools 是否已启用，再进入使用其类型的代码，不要无条件调用 `connect`。

这里的 `api-version: '26.3'` 是 Paper API 版本，不是 UltiTools 模块等级 `700`。由 UltiTools 注册的命令无需在 `plugin.yml` 中声明 `commands:`。

### 3. 连接与断开

在 `onEnable()` 中调用 `connect`：先准备被扫描 Bean 在初始化时需要的插件状态，再连接并使用所需服务。框架会在返回前创建并刷新子容器。两个重载都返回 `void`。在 `onDisable()` 中调用 `disconnect`；没有适配器时不执行任何操作。UltiTools 也会在 `PluginDisableEvent` 和自身关闭时断开连接。

<<< @/../examples/src/main/java/com/ultikits/docs/external/MyExternalPlugin.java

连接成功后，控制台会出现 `[UltiTools-API] External plugin connected: <name> v<version>`。对同一个已连接实例重复调用 `connect` 会被忽略，控制台记录 `[UltiTools-API] Plugin <name> is already connected. Ignoring duplicate connect().`，不会重新扫描或给本次连接追加实体。

UltiTools 尚未加载时，`connect` 抛出 `IllegalStateException`。登记抛出 `Exception` 时，API 将它包装成 `IllegalStateException`，消息为 `Failed to connect plugin <name> to UltiTools`，请检查异常原因。从登记过程中抛出的 `Error`（例如 `NoClassDefFoundError`）不会被 `connect` 包装。登记过程失败后，框架撤销已尝试登记的资源（包括只完成一部分的失败阶段），再释放容器与数据作用域。重试前检查附带的清理异常；插件代码自身的副作用不会被回滚。只在连接调用之外用 `isConnected` 查询状态，不要在 Bean 初始化器中把它当作就绪信号。

## 组件扫描

默认扫描以 `main` 所在的包为起点，包含它的子包，不从 JAR 根目录开始，也不包括同级包。如果 `main` 位于默认包中，UltiTools 会跳过组件扫描。移走示例主类时，将示例组件放在新主类所在的包或子包内。`@Table` 使用独立扫描，搜索插件自己的 JAR，不限于这个组件包。

| 组件 | 登记方式 |
|---|---|
| `@Service` | 创建受管 Bean。可用构造器注入或 `@Autowired`，也可按 `JavaPlugin` 或具体主类类型注入插件实例。 |
| `@CmdExecutor` | 除非设置 `manualRegister = true`，否则会把带注解的 `BaseCommandExecutor` Bean 编译成 Brigadier 命令树。框架也会发现受管的 `BrigadierCommand` Bean。 |
| `@EventListener` | 自动注册实现 Bukkit `Listener` 的 Bean，除非设置 `manualRegister = true`。处理方法使用 Bukkit 的 `@EventHandler`。 |
| `@Scheduled` | 受管 Bean 上的定时方法由框架调度器执行，断开时取消。使用字面量 `delay` 和 `period`；异步的字面量周期按实际时间计时，每配置一 tick 等于 50 毫秒。 |
| `@PlayerCache` | 登记玩家缓存字段，在玩家退出时处理，包括已配置的保存回调。断开后停止跟踪这些字段。 |
| `@ModuleEventHandler` | 受管 Bean 的公开方法只接收一个 `ModuleEvent` 或其子类型参数时，可订阅共享事件总线。发布事件使用 `UltiToolsAPI.getEventBus().publish(event)`。 |

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetingService.java

<<< @/../examples/src/main/java/com/ultikits/docs/external/JoinListener.java

## 命令注册

自 v7.0.0 起，`connect` 发现并编译命令，UltiTools 在 `LifecycleEvents.COMMANDS` 事件中将命令树交给 Paper 的注册器。Paper 26.3 正常启动时，`POSTWORLD` 插件在首次命令事件之前完成启用，因此在 `onEnable()` 里连接来得及。使用 `@CmdExecutor` 和 `@CmdMapping`，不需要 `commands:` 或独立的 Bukkit `onCommand` 处理器。命令名称由 Paper 事件注册，别名、权限和描述取自 `@CmdExecutor`。

<<< @/../examples/src/main/java/com/ultikits/docs/external/GreetCommand.java

外部插件的 `description` 使用原文，即使插件有自己的消息目录也不查键。插件自行编写的回复可显式使用 `Messages`。参数解析与补全见[命令执行器](/zh/guide/essentials/cmd-executor)。

外部插件的注解执行器应保留 `manualRegister` 的默认值 `false`。`connect` 跳过设置了 `manualRegister = true` 的执行器，外部插件 API 不提供事后注册这些执行器的方法。如果执行器使用自定义 `TypeParser`，请在调用 `connect` 前通过 `TypeParserRegistry.getInstance().register(...)` 注册解析器，因为连接时会编译命令树。自定义解析器不会替换内置参数映射。

| 情况 | 控制台诊断 |
|---|---|
| 首次事件后才连接，新注册命令根或更改命令树 | `Command /<label> from <owner> was registered after start-up; it becomes available after /minecraft:reload or a restart.` |
| 名称与 UltiTools 已为另一归属方绑定的命令冲突 | `Command /<label> from <owner> (<class>) conflicts with <previous owner> (<previous class>); rejected.` |
| Paper 注册器未返回请求的名称 | `Command label /<label> from <owner> was not registered by Paper (label occupied).` |

无效的映射则可能使连接被拒绝。控制台可见 `Cannot load module <owner>: executor <class>: <reason>. Change @CmdMapping formats to use distinct literal prefixes, one parameter name/type per position, terminal <name...> arrays, and registered custom type parsers.` 这条诊断即便针对外部插件也写作 `module`。仅命令名称冲突不代表 `connect` 失败。

`/minecraft:reload` 重载数据包并再次触发命令事件，不会断开插件。`/ul reload` 不会重新连接插件、重新绑定命令，也不刷新其配置或消息覆盖文件。安装或更换 JAR 后应停服重启。不支持 Bukkit `/reload` 或用插件管理器热重载。

## 数据存储与事务

自 v7.0.0 起，`connect` 用该插件自己的类加载器发现本 JAR 中的 `@Table` 实体。如果实体属于你的插件，但放在类路径上的独立库中，可传入 `UltiToolsAPI.connect(this, LibraryEntity.class)`。显式传参只补充 JAR 扫描，不能认领其他插件的实体。用同一个插件实例调用 `UltiToolsAPI.getDataOperator(plugin, Entity.class)`。未登记到该插件的实体会被拒绝，错误码为 `ULTI-3010`（`ENTITY_NOT_OWNED`）。

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsEntity.java

<<< @/../examples/src/main/java/com/ultikits/docs/external/StatsService.java

[存储后端](/zh/guide/essentials/data-storage#entity-registration)由服务端选择。JSON 和 SQLite 使用外部插件的数据文件夹；MySQL 使用服务端配置的数据库和 `@Table` 表名，请避免与其他插件的表重名。查询使用实体映射的列名。

可在受管服务的方法上使用 `@Transactional`，通过注入的 Bean 调用，不要自行 `new` 服务。框架为外部插件的数据作用域接入事务管理器，适用与模块相同的[代理和事务规则](/zh/guide/advanced/transactions)。

## 外部插件自己的消息文件 {#external-plugin-messages}

自 v7.0.0 起，在插件自己的 JAR 根目录下的 `messages/` 直接放入至少一份 `messages/<语言>.yml`，例如 `messages/en.yml` 或 `messages/zh-CN.yml`。去掉 `.yml` 后的文件名须是文本引擎认可的语言标识。`messages/config.yml`、子目录中的文件以及 `.yaml` 文件不会启用消息目录；从解压的类目录运行也不会启用。文件格式和接收者语言选择与[模块消息](/zh/guide/essentials/messages)相同。在 `paper-plugin.yml` 中声明 `source-language`，如果没有该文件则用 `plugin.yml`；缺失或无效时用 `en`。

有随包消息目录时，注入的 `Messages` 绑定到插件名规范化后的命名空间。例如，`MyExternalPlugin` 中的 `messages.key("greet.welcome")` 得到 `myexternalplugin:greet.welcome`。命名空间被 UltiTools、已加载模块或另一个外部消息目录占用时，框架拒绝连接；后到的模块也不能接管已有的外部消息目录。没有合规的随包语言文件时，不为插件加载目录或创建消息文件夹，Bean 继承框架的 `Messages` 实例，但其命名空间不作保证。要渲染框架消息，应使用显式键，例如 `MessageKey.of("ultitools", "ul.help")`。

服主只把改动的键写到 `plugins/<插件名>/messages/<语言>.yml`（位于插件的数据文件夹中）。连接成功后，框架将随包文件的参考副本写入其中的 `messages/reference/`，修改副本不会生效。连接被拒绝时不写参考副本；断开时撤下内存中的消息目录，不删除磁盘文件。

在插件自己的重载命令中调用 `UltiToolsAPI.reloadMessages(this)` 可重读随包文件与覆盖文件。任何线程均可调用，但它会在文本引擎锁内同步读文件。请在 `connect` 成功返回后调用，不要放在 Bean 初始化中。未连接、正在登记或已断开时会抛出 `IllegalStateException`，消息为 `Plugin <name> is not connected to UltiTools`。没有随包消息目录的已连接插件调用此方法不会执行任何操作。无效的覆盖文件会被忽略，控制台记录警告，查找可回退到随包文本。`/ul reload` 不刷新外部插件的消息目录。

## 模块专属功能

| 功能 | 外部插件 |
|---|---|
| 模块生命周期 | 没有 `@UltiToolsModule` 生命周期、`registerSelf()` 或模块的 `onReload()` 钩子。使用 `JavaPlugin` 生命周期，并自行管理重载命令。 |
| 模块引导期 | `connect` 是启用阶段 API，不是 UltiTools 模块提前登记附魔、标签和数据包的入口。普通 `plugin.yml` 插件拿不到 `ModuleBootstrapContext`。 |
| 配置实体 | 不登记模块的 `@ConfigEntity`，没有类型化的 `UltiToolsPlugin.getConfig(Class)`；用 `JavaPlugin.getConfig()` 和 `reloadConfig()` 管理插件自己的配置。 |
| 配置绑定时间 | 被识别到的 Bean 使用配置绑定的 `@Scheduled` 或 `@CmdCD` 会使连接被拒绝。请使用字面量 `delay` / `period` / `value`，或自行管理调度和配置。 |
| 模块准入与更新 | 模块的 `api-version` 等级和 `/upm` 不适用。将 JAR 作为服务端插件安装。 |

## 命令测试

[UltiTools 外部插件示例仓库](https://github.com/UltiKits/UltiTools-External-Example)演示了 `JavaPlugin` 的接入方式。请选择与框架版本相符的示例版本。

UltiTools 7.0 没有为外部插件提供受支持的无服务器命令注册测试夹具。`LifecycleEvents.COMMANDS` 的处理器登记在 UltiTools 自己的生命周期管理器上，不在外部 `JavaPlugin` 上。在单元测试中，可以直接调用命令处理方法和补全提供方法，也可以通过反射检查注解声明的映射、别名和权限。直接调用会绕过框架分派，不能验证参数绑定或权限检查。

在 Paper 服务器上验证命令和别名实际注册、有权限和无权限的玩家看到预期的命令和补全建议，以及实际命令树能正确分派命令并给出语法错误提示。

如果测试使用 `org.mockbukkit.mockbukkit:mockbukkit-v26.3:4.123.0`，且在初始化注册表时失败，请检查夹具 `registries/registry_key_class_relation.json`。这个版本缺少 Paper 26.3 需要的 `minecraft:timeline` 和 `minecraft:world_clock` 映射。[UltiTools-Reborn](https://github.com/UltiKits/UltiTools-Reborn) 的对应夹具位于 `src/test/resources/registries/registry_key_class_relation.json`。请放在 `src/test/resources`，不要打入插件 JAR。
