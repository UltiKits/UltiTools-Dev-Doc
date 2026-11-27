# 命令执行器

UltiTools-API 7.0.0 尚未发布。本页介绍自 v7.0.0 起的命令行为。旧版 Bukkit 命令封装见 [6.4.0 归档指南](/zh/v6.4.0/guide/essentials/cmd-executor.html)。

## 基本用法

继承 `BaseCommandExecutor`，用 `@CmdExecutor` 声明命令，并实现 `handleHelp(CommandSender)`。`@CmdMapping` 方法接收已转换为声明类型的参数，不需要实现 Bukkit 的 `onCommand`。

<<< @/../examples/src/main/java/com/ultikits/docs/command/ExampleCommand.java

例如，在标注 `@CmdExecutor(alias = {"point"})` 的类中，下面的映射实现 `/point add <name>`。即使类允许非玩家调用，方法级的发送者限制也能保证这里取得 `Player`：

```java
@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdMapping(format = "add <name>", permission = "point.add")
public void addPoint(@CmdSender Player player, @CmdParam("name") String name) {
    player.sendMessage("Point: " + name);
}
```

### 注解参考

| 注解 | 属性与默认值 |
|---|---|
| `@CmdExecutor`（类） | 必填 `alias`，至少含一个标签。首个是主标签，其余是别名。`permission` 和 `description` 默认为 `""`，`requireOp` 和 `manualRegister` 默认为 `false`。 |
| `@CmdMapping`（方法） | 必填 `format`；`""` 映射只有根标签的调用。`permission` 默认为 `""`，`requireOp` 默认为 `false`。 |
| `@CmdParam`（参数） | 必填 `value`，对应 `format` 中的参数名。`suggest` 默认为 `""`。 |
| `@CmdSender`（参数） | 无属性。类型匹配时注入发送者，否则注入 `null`。未标注的 `CommandSender` 子类型参数也可接收发送者；参数类型本身不限制谁能调用。 |
| `@CmdTarget`（类或方法） | 必填 `value`：`PLAYER`、`CONSOLE`（所有非玩家发送者）或 `BOTH`。类未标注时默认 `BOTH`；方法未另设限制时使用类级目标。 |
| `@CmdSuggest` | 必填 `value`，即提供者类的数组。写在执行器类上：补全查找读取类上的标注，不读取映射方法上的标注。 |
| `@CmdCD`（类或方法） | `value` 默认为 `0` 秒，`key` 默认为 `""`，`config` 默认为 `AbstractConfigEntity.class`。 |
| `@UsageLimit`（类或方法） | 必填 `value`：`SENDER`、`ALL` 或 `NONE`。`ContainConsole` 默认为 `true`。 |
| `@RunAsync`（方法） | 无属性。 |
| `@AsyncCommand`（方法） | 默认 `showProcessing = true`、`processingMessageKey = ""`、`timeout = 30` 秒。 |

## 命令引擎

### 注册与归属

框架把注解编译成字面量节点和类型化参数节点，在 `LifecycleEvents.COMMANDS` 事件中把命令树交给 Paper。框架不再通过反射构造 `PluginCommand`，也不修改 Bukkit 的私有命令表。

- 模块扫描得到的执行器 Bean 会自动注册，除非设了 `manualRegister = true`。手动注册时，将执行器保留在模块容器中并设 `manualRegister = true`，在模块的 `registerSelf()` 中调用 `getCommandManager().register(this, ExampleCommand.class)`。管理器从容器中取 Bean；未标注 `@CmdExecutor` 的执行器不会注册。
- [外部 Paper 插件](/zh/guide/advanced/external-plugin-api)应声明依赖，让 UltiTools 先启用，再在 `JavaPlugin.onEnable()` 中调用 `UltiToolsAPI.connect(this)`。连接时的注册会将合格的 Bean 交给同一个 Paper 事件处理，正常启动时可赶上首次事件。不必在外部插件的 `plugin.yml` 中为这些注解命令声明 `commands`，也不要调用模块专用的手动注册方法。
- 两种所有者都可以提供实现 `com.ultikits.ultitools.command.BrigadierCommand` 的容器 Bean。`node()` 返回 `LiteralCommandNode<CommandSourceStack>`，每次注册调用一次；`aliases()` 和可返回 `null` 的 `description()` 可选。Bean 按实例去重。手写树需要自行检查权限和提供补全，不使用注解校验器、冷却或 `@CmdParam` 补全。指向所提供命令树以外的重定向目标不受卸载控制，也不会随实例替换而重新绑定；请通过下次命令事件或重启刷新。

注册时可将模块描述作为消息目录中的路径解析；未解析时使用原文。外部执行器的描述直接使用原文。[外部插件消息 API](/zh/guide/advanced/external-plugin-api)不会让外部命令的描述或自动补全提示从外部目录解析。

### 启动后注册的命令

首次命令事件后，Paper 已收到命令树结构。注销所有者会隐藏其命令树并阻止执行。实际注册签名相同的替换实例时，可重新绑定到已有结构。新根命令或签名不同的替换命令要等到 `/minecraft:reload` 或重启才可用：

```text
Command /<label> from <owner> was registered after start-up; it becomes available after /minecraft:reload or a restart.
```

如果另一 UltiTools 所有者已使用相同根标签或别名，只拒绝冲突的绑定，不阻止该所有者的其他命令注册。如果 Paper 注册器未登记请求的标签，框架会另外记录警告：

```text
Command /<label> from <owner> (<executor class>) conflicts with <previous owner> (<previous class>); rejected.
Command label /<label> from <owner> was not registered by Paper (label occupied).
```

`/minecraft:reload` 重载数据包并重新触发命令事件。`/ul reload` 不重建执行器、不重新绑定命令树，也不应用条件注册配置的变动；这类变动需要重启。框架不会自行重载数据包。安装或更新模块 JAR 仍需重启：Paper 会保留参数类型实例，包括其中持有的自定义解析器。Bukkit 的插件 `/reload` 与热重载不受支持。

### 被拒绝的格式 {#被拒绝的格式}

以下格式会在编译时被拒绝：规范化后路径相同（包括同一类中的重复格式）、同一父节点下有不同名称或类型的参数、字面量与参数的节点名相同、`@CmdParam` 与占位符不匹配、类型不受支持，以及 `<name...>` 不在末尾或类型不合法。不同节点名的字面量和参数可以共用一个父节点。子类可以替换继承的映射。另一个映射不能与省略可变参数后得到的执行路径重合。

编译失败会回滚出错的模块或外部插件连接，不影响其他所有者的命令。格式诊断以 SEVERE 级别记录，原因例如 `competing parameter with <method>`、`duplicate path with <method>` 和 `greedy parameter must be last`：

```text
Cannot load module <module>: executor <class>: <class>#<method> [<format>]: <reason>. Change @CmdMapping formats to use distinct literal prefixes, one parameter name/type per position, terminal <name...> arrays, and registered custom type parsers.
```

### 从 6.x 迁移 {#从-6-x-迁移}

按[升级指南](/zh/guide/advanced/upgrading-to-7)针对 7.0 重新构建；仅修改 `api-version` 不够。

| 6.x API | 7.0 替代写法 |
|---|---|
| Bukkit `TabExecutor`、`onCommand`、`onTabComplete`；`matchMethod`、`parseParameters`、`validateParameterCount`、`parseParameterValue` | 使用 `BaseCommandExecutor` 的类型化映射；没有替代的字符串匹配器。 |
| `AbstractCommand`、`AbstractTabExecutor`、`AbstractPlayerCommandExecutor`、`AbstractConsoleCommandExecutor` | 使用带 `@CmdTarget` 的 `BaseCommandExecutor` 或 `BrigadierCommand`。 |
| `suggest(Player, Command, String[])`、`suggest(CommandSender, Command, String[])` | `suggest(CommandSender, String, String[])`。 |
| `CommandContext.getCommand()` 及构建器的 `command(...)` | `getCommandName()` 与 `commandName(String)`；`getParsedParams()` 现在返回 `Map<String, Object>`，`getParam` 与 `getParamValue` 返回 `Object`。 |
| 接收 `Class<? extends CommandExecutor>` 的 `CommandManager.register`；`registerCoreCommand(CommandExecutor)` | `Class<? extends BaseCommandExecutor>`；`registerCoreCommand(BaseCommandExecutor)`。 |
| `unregister(String)`；`getPluginByCommand(Command)` | 随模块或外部插件注销命令；`getPluginByLabel(String)` 通过主标签、别名或带命名空间的标签查询所属模块（框架或外部命令返回 `null`）。 |
| `CommandTabCompletionDispatch`；`TabCompletionManager.suggest(Player, Command, String[])`、`createContext(Player, Command, String[])`、`suggestFirstArgs` | Brigadier 补全字面量；使用基于上下文的提供者入口。`TabCompletionContext.getCommand()` 改为 `getCommandName()`。无候选即返回空结果，控制台与 RCON 也一样。 |
| `WorldParser`、`GameModeParser`、`LocationParser`、`EnchantmentParser` 与隐式内置注册项 | 使用原生参数映射；只对未映射的类型显式注册自定义 `TypeParser`。 |

`getMappings`、`handleHelp`、`getHelpCommand`、`createDefaultValidatorChain`、`executeCommand` 与 `buildMethodParams` 保留。详见框架的[兼容性说明](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#command-engine-as-of-700)。

## 参数

格式中各部分用空白分隔。字面量不区分大小写，包括参数后面的字面量，并且优先于同位置的参数。框架可把字面量规范化后重派发一次，不会把参数值改成小写。例如 `accept` 与 `<name>` 同级时，`/trade ACCEPT` 匹配 `accept`，而 `/trade "Accept"` 将 `Accept` 传给 `String` 参数。

| Java 类型 | 输入与取值 |
|---|---|
| `String` | 用空白分隔的一段文字，支持非 ASCII 字符；双引号可将 `"a b"` 合为一个参数。未闭合的引号无法解析。 |
| `int`、`long`、`float`、`double`、`boolean` 及其装箱类型 | Brigadier 对应的参数类型。布尔值只接受 `true` 和 `false`，不再像 6.x 那样把 `yes` 静默转为 `false`。 |
| `short`、`byte` 及其装箱类型 | 限定在 Java 类型取值范围内的整数。 |
| `Player` | Paper 玩家选择器，按命令来源解析。找不到玩家时拒绝，不再像 6.5.0 那样传入 `null`。 |
| `OfflinePlayer` | 由 Bukkit 解析的玩家名，补全在线玩家名。 |
| `World`、`GameMode`、`UUID`、`Enchantment` | Paper 的世界、游戏模式、UUID 与附魔注册表参数。 |
| `Material` | 小写资源键，例如 `minecraft:diamond`，不是 `DIAMOND`。 |
| `Location` | 命令来源所在世界的 Paper 精确坐标 `x y z`，支持相对坐标，不再是 `world,x,y,z`。 |
| 其他已注册 `TypeParser` 的类型 | 一段文字，可用双引号括起，由该解析器解析。 |

只在末尾使用 `<name...>`，对应 `String`（余下文字）或数组（`String[]` 按空白拆分，其他数组按元素类型逐个解析）。省略时收到 `""` 或空数组。普通 `<name>` 不能表示数组。

### 自定义类型解析器

实现 `TypeParser<T>`，并在编译使用它的命令前调用 `TypeParserRegistry.getInstance().register(new ColorParser())`（模块自动注册前会先执行 `registerSelf()`）。用 `<color>` 占位符和 `@CmdParam("color") Color color` 声明参数。用 `<colors...>` 搭配 `Color[]` 可逐个解析剩余参数；命令树不会调用你重写的 `parseArray`。

<<< @/../examples/src/main/java/com/ultikits/docs/command/ColorParser.java

下面的解析器接受 `1-100` 这样的范围。用 `<range>` 占位符与 `IntRange` 参数前，以同样的方式注册它：

<<< @/../examples/src/main/java/com/ultikits/docs/command/RangeParser.java

## Tab 补全

字面量由 Brigadier 补全。框架合并使用该参数节点的可用映射所指定的补全提供者（`@CmdParam(suggest = ...)`）。只有这些映射都未指定提供者时，`protected List<String> suggest(CommandSender sender, String label, String[] args)` 接收实际输入的标签和参数（包括当前未输完的部分）。返回 `null` 保留原生补全，返回列表则替换原生补全，空列表表示没有候选。

- `@players`、`@worlds`、`@materials`（也可写成 `@blocks` 或 `@items`）、`@boolean`（也可写成 `@toggle`）是内置键。自定义键用 `TabCompletionManager.register(String, TabCompleter)` 在校验命令声明前注册。未知 `@key` 会导致加载失败。`TabCompletionContext.getSender()` 返回请求者；对非玩家，`getPlayer()` 返回 `null`。
- 使用方法提供者时，将方法名填入 `suggest`。返回 `List<String>`，参数列表只能为 `()`、`(String)`、`(Player)`、`(Player, String)`、`(Player, Command, String[])`、`(CommandSender)`、`(CommandSender, String)` 或 `(CommandSender, Command, String[])`。`String` 是未输完的参数，`Command` 按标签从公开命令表查找，`String[]` 包含命令参数。非玩家请求会跳过只接受玩家的方法。不支持的参数签名会在加载时被拒绝。
- 方法优先在执行器中查找。模块可以用类级 `@CmdSuggest({PointSuggest.class})` 指定容器中的 Bean 来共享提供者。外部执行器应把方法写在执行器本身；共享提供者的 Bean 查找只支持模块。
- 如果没有匹配的方法，模块可用[模块消息路径](/zh/guide/essentials/messages#module-annotation-text)作为补全提示；路径无效或键不存在时使用原文。外部执行器在此分支不提供提示，即使外部插件有自己的消息目录。

## 权限与回复

类和映射分别声明权限时，两者都须满足；任一层设置 `requireOp = true`，发送者还必须是 OP。方法的 `@CmdTarget` 可以重复或收窄类级目标，但不能放宽，也不能在 `PLAYER` 与 `CONSOLE` 之间切换。这同样适用于继承来的映射。

<<< @/../examples/src/main/java/com/ultikits/docs/command/PlayerOnlyCommand.java

### 可见性

根节点的条件隐藏不可用的命令，映射的条件隐藏专属路径，共用的前缀仍然可见。框架会过滤用法和参数补全提供者，补全时不运行会改变状态的校验器。如果真实的补全参数与隐藏字面量同级，服务端分派器仍可能把同级字面量合并进补全结果。需要保密命令名时请避免这种结构。看到名称不代表能执行。

在可用的根节点下，手动输入不可用的子命令通常与输入未知子命令走同一回复路径，包括 Brigadier 在回调前拒绝大小写完全匹配的隐藏字面量的情况。根级的任意文字参数与受限字面量同级时，名称不能完全隐藏：输入隐藏名得到未知指令回复和受限帮助，两个映射都不执行；其他词仍交给任意文字参数处理。如果根命令本身不可用，不应期待框架的权限或发送者类型提示。在线修改权限不会自动刷新客户端命令树，可重新登录或执行 `/minecraft:reload`；执行时始终检查当前权限。

### 框架回复

框架在非贪婪节点下增加接收余下整行的兜底参数 `args`（重名时用 `args_`，需要时继续追加下划线），该参数不向服务端请求补全。这可能让错误输入在客户端看起来有效，但不代表它会匹配到业务方法。输入到达框架恢复逻辑时：

- 首段无法匹配时发送 `command.reply.unknown` 并调用受限帮助。更深位置匹配失败时，可能用 `command.reply.usage` 列出已匹配的最深节点下可用的映射。例如子命令之后应输入 `int` 却输入 `abc`，会收到用法而非自定义解析器错误；找不到玩家的选择器也可能走用法路径。
- 自定义参数解析器抛出 `TypeParseException` 时，自定义解析错误路径通过 `command.reply.argument_error` 显示其未经翻译的详情。回复收到原生可翻译组件时会保留该组件。这不保证所有原生语法错误都能恢复：Paper 可能在框架回调前拒绝输入。
- 恢复逻辑可规范化连续或末尾空白，并保留引号内容与接收余下整行的参数内容。原生字面量末尾恰好有一个空格（例如 `ul reload `）时，可能在回调前失败。控制台或面板分派前应去除末尾空白。

框架回复中的 `<label>` 是主标签。帮助字面量默认为 `help`（`getHelpCommand()`）。默认帮助路径（包括没有对应映射时只输入根命令）受根节点条件约束，在调用 `handleHelp` 前运行链中适用的发送者类型与权限校验器，不运行冷却或执行锁校验器。

### 回复语言与消息键

`language: auto` 时，框架提示使用玩家的客户端语言；控制台、命令方块和面板发送者等非玩家使用 `fallback-language`。下表列出随框架发布的 13 个 `ultitools:` 键的文字。可在 `plugins/UltiTools/messages/<locale>.yml` 用点分或嵌套 YAML 键和 MiniMessage 值覆盖。完整的 `/ul reload` 会重读框架消息覆盖。插入的文本（如格式中的 `<words...>`）不会被当作 MiniMessage 解析；冷却秒数是不分组的整数。模块帮助和处理器自行发送的回复仍由你负责。

| 键 | 英文 | 中文 |
|---|---|---|
| `command.reply.unknown` | `Unknown command, please enter /<label> <help> for help` | `未知指令，请使用/<label> <help>获取帮助` |
| `command.reply.usage` | `Correct Usage: /<label> <format>` | `正确用法: /<label> <format>` |
| `command.reply.argument_error` | `<error>` | `<error>` |
| `command.error.op_required` | `You don't have permission to run this command!` | `你没有权限执行这个指令！` |
| `command.error.no_permission` | `Executing this command requires <permission> permission` | `执行此命令需要 <permission> 权限` |
| `command.error.player_only` | `This command can only be performed in GAME!` | `只有游戏内可以执行这个指令！` |
| `command.error.console_only` | `This command can only be performed in CONSOLE!` | `只可以在后台执行这个指令！` |
| `command.error.sender_locked` | `Please wait for last Command Processing!` | `请先等待上一条命令执行完毕！` |
| `command.error.server_locked` | `Please wait for last Command Processing which sent by other players!` | `请先等待其他玩家发送的命令执行完毕！` |
| `command.error.cooldown` | `Frequent operations, please try again in <seconds> seconds` | `操作频繁，请 <seconds> 秒后再试` |
| `command.error.execution_failed` | `Command execution failed: <error>` | `命令执行出错: <error>` |
| `command.async.processing` | `Processing...` | `处理中...` |
| `command.async.timeout` | `Command execution timed out; no longer waiting. The command continues running in the background.` | `命令执行超时，已停止等待，命令仍在后台继续执行` |

默认的未知指令与参数错误回复是红色。用法前缀是黄色，命令格式是灰色。命令树可能先于校验器拒绝分派，此时不会发出校验器的拒绝提示。

## 校验、冷却与执行锁

`CommandContext` 提供发送者、主命令名（`getCommandName()`）、实际输入的标签（`getAlias()`）、原始参数（`getRawArgs()`）以及匹配的方法与格式。用 `getParsedParams()` 或 `getParam(name)` 读取类型化参数；参数为数组时，`getParamValue(name)` 返回首个元素。读取解析结果，不要重新解析 `getRawArgs()`。

参数解析后，框架按 `getOrder()` 从小到大执行校验器。默认有 `SenderTypeValidator`（100）、`PermissionValidator`（200）、`UsageLockValidator`（250）和 `CooldownValidator`（300）。自定义校验器的默认顺序值为 `0`。用 `addValidator(...)` 可保留默认链；`super(chain)` 会替换默认链，但不会绕过命令树的条件。声明了 `@CmdCD` 或启用了 `@UsageLimit` 而没有相应校验器时，加载会被拒绝。

<<< @/../examples/src/main/java/com/ultikits/docs/command/WorldRestrictionValidator.java

在标注 `@CmdExecutor(alias = {"worldcheck"})` 的类中，可在构造器中注册校验器：

```java
public WorldCheckCommand() {
    addValidator(new WorldRestrictionValidator("world", "world_nether"));
}
```

这里的类名是 `WorldCheckCommand`。要使用自定义链，可用 `ValidatorChain.builder().add(...).build()` 构造后传给 `super(...)`。如果依赖权限和发送者注解在执行时生效，请保留 `PermissionValidator` 和 `SenderTypeValidator`；命令树上的共用节点不能替代对实际映射的校验。若校验器取得了资源，方法体结束时在 `onComplete` 中释放；校验通过后分派仍失败时，在 `onRefused` 中释放。

`ValidationResult.failure(Text, String)` 接收延迟渲染的文本和诊断键。先读取 `getErrorText()`；由 `Text` 构造的失败，其 `getErrorMessage()` 为 `null`。现有的 `failure(String)` 与 `failure(String, String)` 通过 `getErrorMessage()` 读取。校验链返回首个失败。自定义字符串失败原样发送，不做消息目录翻译。

### 冷却与执行锁

`@CmdCD(60)` 对玩家启用 60 秒冷却，按执行器实例与映射区分。方法注解优先于类级默认值（包括声明该映射的基类默认值）。方法体抛出异常仍开始冷却，未进入方法体的拒绝不开始冷却。显示的剩余时间是剩余整秒数加一，因此 `@CmdCD(5)` 可能显示 6 秒。要查询默认校验器上某个映射的冷却，用 `getCooldownValidator().getRemainingCooldown(playerId, this, method.toString())`；若替换了校验链，查询链中实际使用的校验器。

`@UsageLimit(UsageLimit.LimitType.SENDER)` 按玩家锁定映射。`ALL` 为每个映射在所有玩家之间共用一把锁；`ContainConsole = true` 时，非玩家发送者会被玩家持有的锁拦截，但不能取锁。非玩家也不会取得 `SENDER` 锁。`NONE` 不限；`ContainConsole = false` 排除非玩家发送者。方法级注解优先于类级默认值。取锁不等待；方法体结束（包括抛出异常）或后续校验拒绝调用时释放锁。因此外层调用持锁时，嵌套分派同一映射可能被拒绝。卸载时，共用的内置校验器状态保留至最后一个执行器释放它。

### 配置项绑定的冷却时间 {#配置项绑定的冷却时间}

模块用 `config` 指定配置实体类，用 `key` 指定 `@ConfigEntry` 路径（路径为空时用字段名）。不设置 `value`，将默认值写在配置字段上：

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownCommand.java

文件型配置必须恰好注册一次。缺失键、同时指定冲突的字面量、字段不是 `int` 或 `long`（可用装箱类型），或取值不在 `0..Integer.MAX_VALUE` 内（包括 `null`），都会使绑定在加载时被拒绝。目录实体与外部执行器不能使用该绑定。绑定值为 `0` 时不再开始新的冷却；字面量小于或等于零也关闭冷却。

`/ul reload` 后，合法的新值用于后续冷却，不改变已开始的冷却。绑定更新无效时保留运行中的值，记录警告并报告为部分重载。面板拒绝写入超范围值。避免对同一字段加 `@Range`，它的校验可能使配置重载本身失败。相同的绑定方式也适用于[配置绑定的定时任务](/zh/guide/advanced/scheduled-tasks#绑定到配置项的时间)。

## 执行线程与卸载

没有异步注解时，方法体在全局 tick 线程上立即执行；由其他线程调用时则提交给 `global().run(...)`。立即执行可能阻塞服务器，嵌套的同步命令可以在外层调用返回前运行。如果 GUI 点击回调要分派会打开或关闭物品栏的命令，应把分派推迟到点击事件之后。使用面板的捕获式发送者时，分派返回前发送的回复可随命令结果返回；之后的回复进入控制台日志流。见[面板集成](/zh/guide/advanced/panel-integration#远程命令的结果)。

`@RunAsync` 和 `@AsyncCommand` 的方法体由框架的 `Scheduler.async()` 执行，不使用模块调度器，也不是玩家实体任务。CPU 或 I/O 工作可以在异步方法体运行；世界、实体、方块、区块和物品栏的访问应提交到适当的[调度器上下文](/zh/guide/advanced/scheduled-tasks#调度器-api)，例如用模块注入的 `Scheduler` 调用 `scheduler.entity(player).run(...)`。玩家离线不会跳过已经接受的方法体或其完成钩子。方法体的失败提示可能由工作线程发送。

`@AsyncCommand` 可显示处理中提示。`processingMessageKey` 使用 `<namespace>:<path>`（例如 `my-module:backup.processing`），颜色由相应目录定义。值为空或无效时使用 `ultitools:command.async.processing`；无效值按每个执行器和取值记录一次警告：

```text
Invalid processingMessageKey on <executor class>: <value>; using the default processing message
```

`timeout` 小于或等于零时不启动监视器。否则监视器只报告一次：玩家通过 `entity(player)` 接收，其他发送者通过 `global()` 接收；若方法体先结束，监视器会被取消。超时不取消或中断方法体。卸载中的执行器拒绝新异步提交；已接受的方法体及其完成钩子共用约十秒的等待时间。单个模块卸载有各自的额度；停服时，所有执行器共用一份，先在关闭服务前等待框架命令。只计实际等待时间。额度用完后继续卸载，仍有任务的执行器记录：

```text
Async command unload wait expired for <executor class>: <n> invocation(s); work continues in the background
```

卸载在 tick 线程上等待时，不要让异步方法体阻塞等待全局或实体回调。卸载后仍在运行的工作不得依赖已释放的资源；调度器退役后提交工作可能被拒绝。命令等待与界面存储等待的额度相互独立。详见[运行中卸载等待与 Paper 看门狗警告](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#live-unload-waits-and-paper-watchdog-warnings)。

## 命令测试

不启动服务器也可以测试注册与分派：捕获 `LifecycleEvents.COMMANDS` 的处理器，传入测试注册器，再通过 Brigadier 分派器运行所收到的命令树。直接将树加入 Brigadier 能测试解析和回调，但不能证明 Paper 的注册时机、客户端命令树过滤或 Paper 语法事件的恢复行为。这些行为应另在 Paper 上验证。
