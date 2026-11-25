# 命令执行器

在传统的 Bukkit 插件开发中，我们通常会使用 Bukkit 的 `CommandExecutor` 接口来处理命令。

但在某些情况下，我们需要判断命令的发送者是否为玩家，是否拥有某些权限，判断参数等等。

如果一个插件存在多个命令，那么这些判断逻辑就会重复出现在每个命令的处理方法中，这样的代码是非常冗余的。

除此之外，我们也可能还需要处理命令错误，输出帮助信息等等。

UltiTools-API 提供了一个更加简洁的命令处理方式：你用注解声明命令，匹配、检查与回复由框架完成。自 v7.0.0 起，框架把这些注解编译成 Brigadier 命令树并通过 Paper 注册，不再封装 Bukkit 的 `CommandExecutor` 接口，见下方[命令引擎](#命令引擎)。

## 创建命令执行器

从 v6.2.0 开始，你应该继承 `BaseCommandExecutor` 类，并重写 `handleHelp` 方法。这里的 `@CmdTarget` 和 `@CmdExecutor` 注解是代表了该命令的目标类型和执行器信息。

::: danger v6.3.0 起已移除
`AbstractCommandExecutor`（以及空壳 `AbstractCommendExecutor`）自 v6.2.0 起已弃用，并在 **v6.3.0 中被彻底删除**——不是不可达，而是这个类在 jar 里已经不存在了。请使用 `BaseCommandExecutor`，它提供了相同的注解驱动功能，同时支持可插拔的验证链、改进的上下文管理和自定义类型解析器支持。完整迁移指南见
`COMPATIBILITY.md` 的 [Migrating off `AbstractCommandExecutor`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#migrating-off-abstractcommandexecutor)（该文件为英文，是仓库的权威版本对照文档）一节。
:::

::: tip `/命令 help` 现在与其他调用一样受同一套校验 <Badge type="tip" text="v6.3.0+" />
v6.3.0 之前，help 子命令会在校验链之前执行，导致在 `@CmdTarget(PLAYER)` 命令上用控制台调用、或发送者缺少所需权限时，`handleHelp` 仍然会被调用。v6.3.0 起，`handleGatedHelp` 会先跑 `SenderTypeValidator` 和 `PermissionValidator`，发送者类型不匹配或权限缺失都会在你的 `handleHelp` 实现被调用之前被拒绝。自定义校验器子类若 `shouldValidate` 判定当前上下文不适用，同样会在这里被跳过，与正常命令派发时一致。
:::

<<< @/../examples/src/main/java/com/ultikits/docs/command/ExampleCommand.java

这样你就完成了一个空的什么都不做的命令执行器。这里的 `@CmdTarget` 和 `@CmdExecutor` 注解是代表了该命令的发送者类型和执行器信息。我们将在下一节详细介绍这两个注解。

## 注册命令

::: info 自 v6.3.0 起的连接器构造器
六参数构造器已移除。下面的连接器使用七参数构造器，由调用方传入 `resourceFolderPath`。
新的独立 Bukkit 插件优先在自己的 `JavaPlugin` 中调用 `UltiToolsAPI.connect(this)`，见[外部插件 API](/zh/guide/advanced/external-plugin-api)。
:::

和spigot开发一样，有了执行器，就需要去注册它。我们可以在 `registerSelf` 方法中使用 `getCommandManager().register()` 方法来注册命令。

如果你的模块存在大量的命令执行器而不想手动注册，也可以使用 UltiTools 提供的自动注册功能，详情可以查看[这篇文章](/zh/guide/advanced/auto-register)。

<<< @/../examples/src/main/java/com/ultikits/docs/command/UltiToolsConnector.java

自 v7.0.0 起，`register(UltiToolsPlugin, Class<? extends BaseCommandExecutor>)` 从模块容器中取得执行器，该类必须标注 `@CmdExecutor`；没有该注解的执行器类会被拒绝，不再有兜底注册。

## 命令引擎 <Badge type="tip" text="v7.0.0+" />

::: info 自 v7.0.0 起
带注解的命令类会被编译成 Brigadier 命令树交给 Paper。这是尚未发布的 7.0 行为；所有模块都必须针对 7.0 重新构建。
:::

### 命令的注册方式

模块注册一个 `BaseCommandExecutor` 时，框架读取 `@CmdExecutor`、每个 `@CmdMapping` 的 format 与 `@CmdParam` 参数，为每个命令构建一棵 Brigadier 节点树：format 中的每个字面量成为字面量节点，每个 `<name>` 成为带原生参数类型的参数节点（见[参数类型](#参数类型)），映射的方法成为该节点的执行回调。这棵树只在 Paper 的 `LifecycleEvents.COMMANDS` 事件中交给 Paper。框架不再通过反射构造 `PluginCommand` 对象，也不再修改 Bukkit 私有的命令表。

因此解析与 Tab 补全都由 Brigadier 完成：客户端收到命令树，按它校验输入并据此补全。框架仍会在映射方法之前运行它的验证链（发送者类型、权限、执行锁、冷却、自定义验证器），对不匹配任何映射的输入仍发送框架自己的回复（见[框架回复](#框架回复)）。

模块作者的写法不变：一个继承 `BaseCommandExecutor`、标注 `@CmdExecutor` 的类，用 `@CmdMapping`、`@CmdParam`、`@CmdSender`、`@CmdTarget`、`@CmdSuggest`、`@CmdCD`、`@UsageLimit`、`@RunAsync` 与 `@AsyncCommand` 映射方法。注解表达不了的命令树，模块可以注册一个实现 `com.ultikits.ultitools.command.BrigadierCommand` 的容器 Bean（例如用 `@Service`）：`node()` 返回根节点 `LiteralCommandNode<CommandSourceStack>`，`aliases()` 与 `description()` 可选。这类手写树没有注解验证器、冷却和 `@CmdParam` 补全。

### 从 6.x 迁移

针对 6.x 编写的代码必须重新编译，不能原样在 7.0 上运行。影响命令代码的变化如下：

| 7.0 中删除或变化的部分 | 替代 |
|---|---|
| `BaseCommandExecutor` 实现 Bukkit 的 `TabExecutor`，以及 `onCommand`、`onTabComplete` | 继续继承 `BaseCommandExecutor`；框架通过 Brigadier 调用映射方法 |
| `matchMethod`、`parseParameters`、`validateParameterCount`、`parseParameterValue` | 无替代；匹配与解析由编译出的命令树及其参数类型完成 |
| `suggest(Player, Command, String[])` 与 `suggest(CommandSender, Command, String[])` | `suggest(CommandSender sender, String label, String[] args)`，见[执行器兜底补全](#执行器兜底补全) |
| `CommandContext.getCommand()` | `getCommandName()`；`getParsedParams()` 改为保存类型化值的 `Map<String, Object>`，`getParam` / `getParamValue` 返回 `Object` |
| `AbstractCommand`、`AbstractTabExecutor`、`AbstractPlayerCommandExecutor`、`AbstractConsoleCommandExecutor` | `BaseCommandExecutor`（只限玩家或只限控制台的命令配合 `@CmdTarget`）或 `BrigadierCommand` |
| 内置的 `WorldParser`、`GameModeParser`、`LocationParser` 与 `EnchantmentParser` | Paper 的原生参数类型，见[参数类型](#参数类型) |
| `CommandManager.unregister(String)` | 注销所属模块 |
| `CommandManager.getPluginByCommand(Command)` | `getPluginByLabel(String)` |
| `registerCoreCommand(CommandExecutor)` | `registerCoreCommand(BaseCommandExecutor)` |

`getMappings`、自定义验证器、`handleHelp`、`getHelpCommand`、`createDefaultValidatorChain`、`executeCommand` 与 `buildMethodParams` 保留。完整的对照表见框架 [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md) 的「Command engine (as of 7.0.0)」一节。

### 被拒绝的格式

命令树必须没有歧义，因此框架在编译每个执行器时都会检查。下列声明会被拒绝：

- 同样的字面量之后、同一位置上有两个不同的参数（例如同一个命令里的 `give <player>` 与 `give <amount>`）；
- 两个映射落在同一路径上，包括同一个类里两个 format 相同的方法（子类仍可覆盖继承来的映射）；
- `<name...>` 参数不是 format 的最后一段、`<name...>` 参数的类型既不是 `String` 也不是数组，以及没有写 `...` 的数组参数；
- 参数类型既没有参数映射，也没有注册 `TypeParser`；
- `@CmdParam` 的名字没有出现在 format 中，或 `<name>` 没有对应的 `@CmdParam`。

字面量与参数可以位于同一位置。一个执行器被拒绝时，只有该模块不被加载：它的命令、监听器和容器会被回滚，其他模块和框架自己的命令照常工作。控制台输出一行如下形式的 SEVERE 日志：

```text
Cannot load module <module>: executor <class>: <class>#<method> [<format>]: <reason>. Change @CmdMapping formats to use distinct literal prefixes, one parameter name/type per position, terminal <name...> arrays, and registered custom type parsers.
```

其中的原因例如 `competing parameter with <method>`、`duplicate path with <method>` 或 `greedy parameter must be last`。

### 启动后注册的命令

Paper 在启动期间构建命令树。根命令在那之后才首次注册，或者命令树发生变化时，命令不会立即可用，控制台输出一行警告：

```text
Command /<label> from <owner> was registered after start-up; it becomes available after /minecraft:reload or a restart.
```

该命令在 `/minecraft:reload` 或重启服务器之后可用。框架从不自行重载数据包。`/ul reload` 只重载配置，不注册也不重新绑定命令，因此不会让这类命令可用。安装或更新模块 JAR 仍需重启。

## 基于映射的命令执行器

### 快速上手

假如你的插件拥有一个设置传送点的功能，你希望玩家输入一个带有传送点名称的命令，以此来设立一个传送点。

那么这个命令应该会长这样：`/point add name`

如果是使用传统的方法，你需要判断参数输入的合法性，发送者以及权限等，如果还有其他功能，你还需要编写一大堆的 `switch ... case` 和 `if ... else` 语句，疯狂嵌套。
使得代码可读性变差，提高了维护的难度。~~（还容易烧干你的脑子）~~

使用这个方法，你只需要编写最主要的逻辑即可，剩下的交给 UltiTools。

首先你需要创建一个继承了 `BaseCommandExecutor` 的执行器类。

接着创建一个名为 `addPoint` 的方法，并添加你想要的参数：

```java
public void addPoint(@CmdSender Player player, String name) {
  ...
}
```

是的，你的每一个功能都使用一个独立的函数，没有多余的判断。

如果你希望拿到的是 `Player` 对象而不是 `CommandSender` 对象，那你拿到的就是 `Player`，完全不需要判断与转换。你只需要在希望获取发送者对象的参数前面添加 `@CmdSender` 注解即可。

然后，你只需要添加 `@CmdMapping` 注解，以便 UltiTools 能够根据输入的命令匹配你的方法：

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, String name) {
  ...
}
```

最后，使用 `@CmdParam` 来绑定命令参数：

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, @CmdParam("name") String name) {
  ...
}
``` 

至此，你只需要注册命令执行器即可完成所有工作。

### 参数Tab提示补全

::: tip 补全来自命令树 <Badge type="tip" text="v7.0.0+" />
自 v7.0.0 起，字面量由 Brigadier 从编译出的命令树补全；每个参数依次使用它的 `@CmdParam(suggest = ...)` 提供者、执行器的 `suggest` 兜底，最后是参数类型自带的原生补全。
:::

发送者无权使用的子命令不在该发送者的命令树里，因此永远不会被补全，见[可见性](#可见性)。发送者无权使用的映射，其补全提供者不会被调用。

每次写完一个命令之后希望给自己的命令添加Tab提示补全，但是又不想写一大堆的代码？

为Tab补全绞尽脑汁判断每个命令的长度和之前的参数来生成一个补全List，这非常容易把人累死。

现在你只需要简单的为每一个参数写一个方法返回补全List即可！这个方法可以被反复利用，所有繁杂的参数数量判断都交给 UltiTools 来完成。

你所需要做的只是在 `@CmdParam` 注解中添加 `suggest` 属性，指定一个方法名即可。


```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, @CmdParam(value = "name", suggest = "listName") String name) {
  ...
}

public List<String> listName(Player player, Command command, String[] args) {
  ...
}
```

UltiTools会首先在当前类中搜索匹配的方法名，并尝试调用此方法。

提供补全的方法返回 `List<String>`。原有参数列表只支持 `()`、`(Player)`、`(String)`、`(Player, String)` 和 `(Player, Command, String[])`，参数顺序不能任意改变。`Player` 是请求补全的玩家，`String` 是当前尚未输完的参数，`Command` 是当前命令，`String[]` 是其参数数组。自 v7.0.0 起，`Command` 按标签从服务器公开的命令表中查找。

#### 发送者感知补全 <Badge type="tip" text="v6.3.2+" />

自 v6.3.2 起，控制台、RCON 和其他 `CommandSender` 实现与玩家使用同一套补全分发。提供补全的方法还支持三个精确的参数列表：`(CommandSender)`、`(CommandSender, String)` 和 `(CommandSender, Command, String[])`。类型必须是 `CommandSender` 本身，而不是某种发送者子类。这些形式既可写在命令执行器中，也可写在 `@CmdSuggest` 指定的类中。

候选字面量或补全方法产生结果之前，会先经过同样的类级与映射级权限、OP 检查及生效的 `@CmdTarget` 限制。`CONSOLE` 指所有非玩家发送者，不限于 `ConsoleCommandSender`。请求被拒绝时静默返回空候选。自 v7.0.0 起，没有候选对所有发送者都意味着空结果；6.x 中控制台或 RCON 发送者回退到服务器在线玩家名的做法已取消。补全过程不执行带副作用的验证器、冷却或使用锁，也不发送命令拒绝消息。

注册的自定义补全器通过 `TabCompletionContext.getSender()` 取得请求者。玩家请求的 `getPlayer()` 返回该玩家，所有非玩家请求均返回 `null`；使用玩家专属 API 前，自定义补全器必须检查是否为 `null`。只接收 Player 的补全方法会跳过非玩家请求，绝不会收到 null 玩家。无参、仅 String 参数的方法、内置补全器和注册的 `@key` 补全器对两类发送者都可用。

在 6.3.2 中，执行器自己的补全由受保护的 `suggest(Player, Command, String[])` 与 `suggest(CommandSender, Command, String[])` 处理。自 v7.0.0 起二者都被删除，由一个入口取代，见[执行器兜底补全](#执行器兜底补全)。以玩家构造的 context 也会将该玩家作为 sender 返回。

#### 内置补全器（`@key` 记法） <Badge type="tip" text="v6.3.0+" />

自 v6.3.0 起，以 `@` 开头的 `suggest` 值会通过一个已注册的补全器解析，而不是当作方法名——完全不需要写方法：

```java
@CmdMapping(format = "tp <target>")
public void tp(@CmdSender Player player, @CmdParam(value = "target", suggest = "@players") String target) {
  ...
}
```

框架内置四个键：`@players`（在线玩家）、`@worlds`（已加载世界）、`@materials`（也支持 `@blocks`/`@items`）、`@boolean`（也支持 `@toggle`）。模块也可以通过 `TabCompletionManager.register(String, TabCompleter)` 在运行时注册自己的键。

`@` 不是合法的 Java 标识符起始字符，因此这种记法永远不会与方法名值冲突——本页其他用普通方法名的示例都不需要改动。**未知**的 `@key` 会拒绝声明它的模块加载，并指明类、方法与键；它不会退回到下面介绍的纯字符串提示行为。

::: tip suggest 可以直接填写固定字符串

如果你仅仅只是想返回一个简单的提示字符串，那么你只需要在 `suggest` 字段中写上你想要的字符串即可。这里的字符串也支持i18n国际化。

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player,
                     @CmdParam(value = "name", suggest = "[名称]") String name) {
  ...
}

```
:::

#### 执行器兜底补全 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，执行器可以重写一个补全入口。`@CmdParam` 没有指定 `suggest` 提供者的参数会调用它：

```java
@Override
protected List<String> suggest(CommandSender sender, String label, String[] args) {
    // 返回 null 保留参数类型的原生补全
    return null;
}
```

`label` 是输入的命令标签，`args` 是其后的输入，包括尚未输完的那一段。返回 `null` 保留参数类型的原生补全（`Player` 是在线玩家，`World` 是已加载的世界，依此类推）；返回列表则替换它们，空列表表示没有候选。字面量补全始终来自命令树，不能在这里修改。

#### @CmdSuggest 注解

::: tip @CmdSuggest 在 BaseCommandExecutor 上已可读取 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，下面示例中的类会通过共享的 `commands/tabcomplete/` 分发被读取，因此 `PointSuggest` 中的方法会按预期被查找并调用。
:::

如果你希望你的这个补全方法与其他命令类共享，那么你可以创建一个类，将想要复用的方法写在此类下。

在需要使用此类中的方法的类上添加 `@CmdSuggest` 注解，指定此类的类名即可。

```java
@CmdSuggest({PointSuggest.class})
public class PointCommand extends BaseCommandExecutor {

    @CmdMapping(format = "add <name>")
    public void addPoint(@CmdSender Player player, @CmdParam(value = "name", suggest = "listName") String name) {
        ...
    }
}
```
```java
public class PointSuggest {
    public List<String> listName(Player player, Command command, String[] args) {
        ...
    }
}
```

### 参数

#### 无参命令

如果该命令无需任何参数，那么只需要将 ` format` 值留空即可

```java
@CmdMapping(format="")
```

该种命令最多存在一个。自 v7.0.0 起，同一个类里两个 format 相同的映射会使模块在加载时被拒绝，见[被拒绝的格式](#被拒绝的格式)。

#### format 语法

format 是用空格分隔的若干段。写成普通单词的一段是字面量（子命令名）；写成 `<name>` 的一段是参数，绑定到 `@CmdParam` 值为 `name` 的方法参数；`<name...>` 接收该行余下的全部内容。自 v7.0.0 起：

- 参数是以空格分隔的一段。`String` 参数也接受双引号括起的值，因此 `"a b"` 是一个参数；引号未闭合是语法错误。
- 字面量与参数可以位于同一位置，但两个不同的参数不可以，见[被拒绝的格式](#被拒绝的格式)。

#### 不定参数

在一个方法的最后一个参数，允许使用数组类型，你需要在 `format` 中的最后一个参数添加 `...`, 下面是一个示例：

```java
@CmdMapping(format = "add <name...>")
public void addPoint(@CmdSender Player player, @CmdParam("name") String[] name) {
  ...
}
```

这样在玩家输入 `/somecmd add aa bb cc` 时，`name` 就为 `['aa', 'bb', 'cc']`

自 v7.0.0 起，`<name...>` 必须是 format 的最后一段，对应参数必须是 `String`（余下的文字作为一个字符串）或数组（余下的文字按空格拆开，每个元素按数组元素类型的映射解析）。省略这一段时，方法收到空值。写成 `<name>`、没有 `...` 的数组参数会被拒绝。

#### 参数类型 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，每种参数类型对应一种 Brigadier 参数类型，由客户端校验并补全取值：

| Java 类型 | 参数 |
|---|---|
| `String` | 一段文字，包括非 ASCII 文字；双引号括起的值算一个参数 |
| `int` / `Integer`、`long` / `Long`、`double` / `Double`、`float` / `Float`、`boolean` / `Boolean` | Brigadier 对应的类型化参数 |
| `short` / `Short`、`byte` / `Byte` | 限定在该 Java 类型范围内的整数参数 |
| `Player` | Paper 的玩家选择器，按发送者解析 |
| `OfflinePlayer` | 玩家名，方法执行时由 Bukkit 查找；补全在线玩家名 |
| `World`、`GameMode`、`UUID` | Paper 原生的世界、游戏模式与 UUID 参数 |
| `Enchantment` | Paper 的附魔注册表参数 |
| `Material` | 命名空间物品键，例如 `minecraft:diamond` |
| `Location` | Paper 的精确坐标 `x y z`，位于发送者所在世界；支持相对坐标 |
| 其他注册了 `TypeParser` 的类型 | 一段文字，交给该解析器解析，见[自定义类型解析器](#自定义类型解析器) |

与 6.x 相比，玩家可输入的内容有这些变化：

- `Boolean` 只接受 `true` 与 `false`；6.x 会把其他输入（包括 `yes`）转成 `false`。
- `Material` 需要全小写的命名空间键（`minecraft:diamond`），不接受枚举写法 `DIAMOND`。
- `Location` 是 `x y z`，不再是 6.x 的 `world,x,y,z` 字符串。
- `Player` 参数找不到玩家时直接拒绝，不再把 `null` 传给方法。

内置的 `WorldParser`、`GameModeParser`、`LocationParser`、`EnchantmentParser` 以及隐式的内置注册项已删除。`TypeParserRegistry` 只保留模块显式注册的解析器，且注册的解析器只用于上表没有映射的类型。

#### 子命令大小写 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，每个字面量都不区分大小写，包括参数之后的字面量（`/x <player> ADD`）。字面量与参数位于同一位置时，无论大小写都优先匹配字面量：`<player>` 旁有 `accept` 时，`/trade ACCEPT` 执行 `accept` 映射。双引号括起的一段始终是参数值：如果该参数是 `String`，`/trade "Accept"` 把字符串 `Accept` 传给它，而不是执行 `accept`。参数值保留发送者输入的大小写。

### 权限

#### 方法权限

如果你需要为某一个方法指定权限，你只需要在 `@CmdMapping` 添加 `permission` 属性即可

```java
@CmdMapping(..., permission = "point.set.add")
```

::: tip 类级别和方法级别的权限需要同时满足
`@CmdExecutor` 和 `@CmdMapping` 中定义的权限是**叠加**的——两者会被独立检查。命令发送者必须**同时拥有**类级别 `@CmdExecutor(permission=...)` 和方法级别 `@CmdMapping(permission=...)` 指定的权限才能执行该命令。
:::

#### OP 限定
如果你希望全部方法只能由OP执行，你只需要在 `@CmdExecutor` 中设置 `requireOp` 属性为 `true` 即可

```java
@CmdExecutor(..., requireOp = true)
```

如果你希望某一个方法只能由OP执行，你只需要在 `@CmdMapping` 中设置 `requireOp` 属性为 `true` 即可

```java
@CmdMapping(..., requireOp = true)
```

### 限定发送者

如果你希望为全部方法指定发送者，你只需要在你的类前面添加 `@CmdTarget` 注解即可。

如果为某一个方法，则在该方法前面添加即可。

```java
@CmdTarget(CmdTarget.CmdTargetType.BOTH)
```

::: warning 方法级 `@CmdTarget` 只能收窄类级注解
方法级 `@CmdTarget` 只能收窄类级 `@CmdTarget`（`BOTH` 收窄为 `PLAYER` 或 `CONSOLE`）。放宽（`PLAYER` 或 `CONSOLE` 改为 `BOTH`）或横向切换（`PLAYER` 与 `CONSOLE` 互换）会使该命令类在加载时被拒绝，并指出类名与方法名。
自 v6.3.0 起，这也适用于该类从基类继承的映射：标注 `@CmdTarget(CONSOLE)` 的类若继承了 `@CmdTarget(BOTH)` 的映射，会被拒绝，日志中同时会指出声明该映射的类。
:::

### 可见性 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，发送者无权使用的命令或子命令不在该发送者的命令树里。这包括缺少 `@CmdExecutor` 或 `@CmdMapping` 上的 `permission`、非 OP 发送者遇到 `requireOp`，以及 `@CmdTarget` 排除了该发送者（玩家遇到只限控制台的子命令，控制台遇到只限玩家的子命令）。这样的子命令不会出现在 Tab 补全中，无法执行，用法回复也不会列出它。与发送者可用的映射共用的字面量仍然可见。

被隐藏的子命令表现得如同不存在。即使硬输入（任意大小写），它得到的回复也与同一位置上不存在的子命令完全相同（第一个词时是未知指令提示加该命令的帮助，见[框架回复](#框架回复)），不会执行任何业务代码。每次分派时仍会检查权限、发送者类型、冷却与执行锁。

::: warning 已知限制：任意文字参数旁的隐藏子命令
同一位置还有单词参数或接收余下整行的参数时（例如受权限限制的 `admin` 旁有 `<name>`），输入被隐藏的名字会得到未知指令回复，而其他词都交给参数处理，因此该命令无法完全隐藏这个名字的特殊性。
子命令名必须保密时，不要把任意文字参数与受权限限制的子命令放在同一层。
:::

玩家在线期间权限变化不会刷新该玩家的命令树，要等玩家重新登录或执行 `/minecraft:reload` 后才刷新。执行时始终实时检查权限。

### 框架回复 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，不匹配任何映射的输入仍得到框架自己的回复，而不是 Minecraft 的语法错误。每个位置都接受一个兜底参数，玩家看到的名字是 `args`；因此客户端不再把输错的输入标红。回复有两种：

| 何时 | 英文 | 中文 |
|---|---|---|
| 标签后的第一个词不是发送者可用的子命令 | `Unknown command, please enter /<label> <help> for help`（红色），随后是该命令的帮助 | `未知指令，请使用/<label> <help>获取帮助`（红色） |
| 第一个词之后的输入出错 | `Correct Usage: ` 黄色，其后 `/<label> <format>` 灰色；已匹配的最深一段之下、发送者可用的每个映射一行 | `正确用法: ` 黄色，其后 `/<label> <format>` 灰色 |

第一种回复中的 `<label>` 是命令标签，`<help>` 是帮助子命令（除非重写了 `getHelpCommand()`，否则为 `help`）；第二种中的 `<format>` 是一个映射的 format。被模块自己的参数解析器拒绝的值，改为得到该解析器给出的红色错误消息（键 `command.reply.argument_error`），消息按解析器写的原样显示，不翻译。被 Minecraft 原生整数参数拒绝的值（例如需要 `int` 时输入 `abc`）仍得到用法回复。第一种回复之后显示的帮助与 `/<标签> help` 经过同样的发送者类型与权限检查。只输入命令标签、且没有 `format = ""` 映射时显示帮助。

不存在的子命令与发送者无权使用的子命令，其未知指令回复由同一段代码生成、以同样方式渲染给同一接收者，因此被隐藏的子命令与不存在的子命令无法区分（见[可见性](#可见性)）。

### 回复语言与消息键 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，命令包发出的每一条回复都经过框架的消息服务（见[消息与语言](/zh/guide/essentials/messages)），不再使用传统 `§` 颜色码，也不再按服务器语言选择。`language: auto` 时，玩家按自己的 Minecraft 客户端语言收到回复；控制台、命令方块和面板反馈使用 `config.yml` 中的 `fallback-language`。代非玩家发送者执行的命令，即使由玩家触发，也使用后备语言。框架的 13 条回复文本是 `ultitools` 命名空间下的 `command.*` 键，随框架发布在 `messages/en.yml` 与 `messages/zh.yml` 中：

| 键 | 英文 | 中文 |
|---|---|---|
| `command.reply.unknown` | `Unknown command, please enter /<label> <help> for help` | `未知指令，请使用/<label> <help>获取帮助` |
| `command.reply.usage` | `Correct Usage: /<label> <format>` | `正确用法: /<label> <format>` |
| `command.reply.argument_error` | 模块参数解析器的错误信息（红色） | 模块参数解析器的错误信息（红色） |
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

服主在 `plugins/UltiTools/messages/<locale>.yml` 中用点分或嵌套键与 MiniMessage 值覆盖这些文本；框架键的覆盖需要重启才生效。参数按字面文本插入，因此用法行里的 `<target>`、`<words...>` 这类片段会原样显示。冷却秒数显示为普通整数（`<seconds:'0'>`）。

::: warning 旧回复文本的形式变了
v7.0.0 之前，这些回复是带内嵌传统颜色码的英文或中文句子，按服务器语言选择。现在措辞与颜色含义不变，但它们是按接收者语言渲染的组件，覆盖请用上面的消息文件。模块自己的帮助（`handleHelp`）以及模块代码自己发送的文本仍归模块所有。
:::

### 验证失败 <Badge type="tip" text="v7.0.0+" />

验证器用 `CommandValidator.ValidationResult` 报告失败。除 `String` 工厂 `failure(String)` 与 `failure(String, String)` 外，自 v7.0.0 起还有 `ValidationResult.failure(Text, String)`：第一个参数是延迟渲染、按接收者语言显示的文本（`com.ultikits.ultitools.text.Text`），第二个是诊断用的键。框架自带的验证器用它给出上面列出的拒绝回复。

- `getErrorText()` 返回延迟文本；成功以及用 `String` 构造的失败返回 `null`。
- `getErrorMessage()` 返回传统字符串；用 `Text` 构造的失败返回 `null`。读取结果的代码必须先检查 `getErrorText()`；`ChainValidationResult.getErrorText()` 与 `getErrorMessage()` 一样读取第一个失败。
- 你自己验证器的 `String` 失败原样发送：不翻译，也不经过任何语言目录。
- 模块自己的 `TypeParser` 抛出 `TypeParseException` 时，其消息原样显示、不翻译；框架解析器辅助方法里固定的英文句子同样不翻译。

```java
return ValidationResult.failure(Text.of(MessageKey.of("my-module", "world.denied")), "world.denied");
```

控制台或面板输入中连续或行尾的空格，在输入到达兜底时会被规范化。最后一个词是子命令、其后恰好跟一个空格的控制台或面板命令（例如 `ul reload `）可能在框架看到之前就被拒绝；分派前请去掉这类行尾空格。

### 异步执行
如果一个命令需要执行比较耗时的任务，你需要在相应的方法前面添加 `@RunAsync`:

```java
@CmdMapping(format = "list")
@RunAsync
public void listPoint(@CmdSender Player player) {
    //do query
}
```

这将会创建一个新的异步线程来执行该方法，避免在Bukkit主线程中执行而造成阻塞。

由于 Bukkit API 不允许被异步调用，因此如果你需要调用 Bukkit API，需要把这一部分调度回服务器线程。自 v7.0.0 起，注入模块的 `Scheduler`（见[调度器 API](/zh/guide/advanced/scheduled-tasks#调度器-api)），把 Bukkit 操作提交给拥有该数据的上下文，这里是玩家的上下文：

```java
@Autowired
private Scheduler scheduler;

@CmdMapping(format = "list")
@RunAsync
public void listPoint(@CmdSender Player player) {
    //do query
    scheduler.entity(player).run(() -> {
        //call bukkit api
    });
}
```

`@RunAsync` 方法体在服务器主线程之外运行。它可以做 CPU 计算、文件与数据库 I/O 以及网络调用；不得直接读取或修改世界、实体、方块、区块或背包，这部分要像上面那样提交出去。在当前的 7.0 开发线上，异步方法体本身仍由 Bukkit 调度器启动，而不是由模块的 `Scheduler` 启动。

::: danger `@RunAsync` 方法体不得直接访问世界、实体、方块或区块状态。 <Badge type="danger" text="v6.3.0+" />
这里的异步只留给纯 CPU 或 I/O 工作。异步方法体里任何对世界、实体、方块或区块的访问，都必须提交给服务器线程上的上下文：像上面示例那样用 `scheduler.entity(player).run(...)`，世界状态则用 `global()` / `region(...)`；注解本身从不授予对这些 API 的安全访问。方法体只做这类状态访问的处理器根本没有理由标注它。
:::

未标注 `@RunAsync` 的命令方法体在主线程上执行。自 v6.3.0 起，命令在主线程上被分派时，方法体就在分派的当下执行；只有分派来自其他线程时，才交给框架调度器的 `global()` 上下文（v6.3.0 之前一律推迟一个 tick，见下方[命令方法体何时执行](#命令方法体何时执行)）。无论哪种时序，都只改变方法体何时开始，不改变它是否会阻塞：整个方法体（包括其中任何耗时的 CPU 或 I/O 工作）依然会在主线程上同步执行。去掉 `@RunAsync` 只对本来就不做耗时工作的方法体是安全的，恢复的是其他命令同样使用的这套调度；如果方法体同时包含耗时工作与 Bukkit 访问，需要做的是把耗时部分留在异步线程，只把触碰 Bukkit 状态的那一段提交给模块 `Scheduler` 的服务器线程上下文（就像上面示例那样），而不是简单去掉注解。Paper 也不会拦截异步方法体里全部对世界、实体、方块或区块的访问：它的异步操作检查只覆盖一部分不安全的操作，因此违反上面这条规则时，方法体可能在不安全或不一致的状态下继续运行，而不是直接崩溃；没有抛出异常并不能证明代码是安全的。对确实应该异步执行、且不需要更多控制的方法体，`@RunAsync` 仍然是正确的选择；如果它还需要处理中提示、超时或可配置的边界行为，就改用 `@AsyncCommand`。

### 命令方法体何时执行 <Badge type="tip" text="v6.3.0+" />

自 v6.3.0 起，没有 `@RunAsync` 或 `@AsyncCommand` 的命令方法体，只要命令是在服务器主线程上分派的，就在分派的当下、在分派过程之中执行。玩家、控制台、命令方块、命令矿车、RCON 以及面板的远程命令发出的每一条命令，Bukkit 都在主线程上分派。只有分派来自其他线程时，方法体才会推迟到主线程，这与 Bukkit 自带命令的行为一致。v6.3.0 之前，这类方法体一律在分派后晚一个 tick 执行，于是它发给命令方块、命令矿车和 RCON 的回复全部丢失：这些发送者在分派返回时就读取输出。在 v6.3.0 中，面板的远程命令不在其中：它以服务器控制台的身份运行，回复通过日志流到达面板。自 v6.3.1 起，它以 Paper 的捕获式命令发送者运行，这个发送者拥有控制台的权限，但不是控制台发送者，因此它也在其中：方法体在分派返回之前打印的内容随命令结果返回，之后（在 `@RunAsync`、`@AsyncCommand` 或调度任务中）打印的内容写入服务器控制台，经日志流到达面板（见[面板集成](/zh/guide/advanced/panel-integration#远程命令的结果)）。本变化适用于所有模块，包括第三方模块。

模块需要检查的地方：

- **依赖「晚一个 tick」的代码**，需要自己调度那部分工作；自 v7.0.0 起用模块的 `Scheduler` 提交，例如 `scheduler.entity(player).run(...)`。
- **`InventoryClickEvent` 处理器**（包括 GUI 库的点击回调）不得直接打开或关闭背包，也不得直接调用 `performCommand` 或 `Bukkit.dispatchCommand`。在那里分派的模块命令，现在会在点击事件之中执行它的方法体，而方法体可能开关背包，这是 Paper 不允许的。请推迟调用：

```java
icon.onClick(event -> {
    event.setCancelled(true);
    scheduler.entity(player).run(() -> player.performCommand("menu open shop"));
});
```

- **分派了另一条命令的方法体**，会在自己尚未结束时，在同一线程上执行嵌套命令的方法体。`AuditableDataEntity` 写入 `created_by`、`updated_by` 的审计用户，会在每个方法体之前保存、之后恢复：嵌套方法体看到的是它自己的发送者（发送者不是玩家时为空），外层方法体之后看到的仍是它自己的发送者。
- **分派自身命令的方法体**，在持有 `@UsageLimit` 锁时，嵌套的那次分派会被拒绝，见[执行锁](#执行锁)。
- **同一 tick 内两次分派同一条 `@CmdCD` 命令**会受冷却约束：第二次被拒绝，因为冷却在第一次分派返回之前就已记录。

### 命令冷却

如果你不希望一个指令被大量执行而消耗服务器资源，那么你可以在相应的方法前面添加 `@CmdCD`:

```java
@CmdCD(60)
```

参数类型为整数，单位为秒。

冷却结束之前执行该指令将会发送消息 `command.error.cooldown`：英文 `Frequent operations, please try again in <seconds> seconds`，中文 `操作频繁，请 <seconds> 秒后再试`。自 v7.0.0 起它按玩家自己的客户端语言渲染（见[回复语言与消息键](#回复语言与消息键)），剩余秒数显示为普通整数；v7.0.0 之前文本取决于服务器语言（v6.3.0 起 `en.json` 含带 `%d` 的键）。未走完的一秒向上取整，因此 `@CmdCD(5)` 的命令可能显示 6 秒。

此限制仅对**玩家**生效。

**冷却在每一次执行尝试之后都会生效，不只是在执行成功之后。** 即使映射的方法抛出异常，冷却依然会像正常返回一样开始计时——校验器不区分成功与失败。这是有意为之：报错的指令同样消耗服务器资源，而在紧密循环里反复重试一个报错指令，正是冷却机制要防止的模式。

自 v6.3.0 起，进行中的冷却按执行器实例和映射分别记录。同一个 `CooldownValidator` 被同一个类的两个执行器共用时（模块代码把同一个 `ValidatorChain` 传给两者时就会如此），玩家用过执行器 A 之后，不再需要在执行器 B 上等待。在方法执行之前就被拒绝的分派（例如参数个数不对）不会开始冷却。

自 v6.3.0 起，共享基类执行器上的类级 `@CmdCD` 对该基类所声明的映射生效，包括被 `@ExceptionCatch` 等 AOP 注解拦截的映射；在子类中被重写的映射以子类的注解为准。

自 v6.3.0 起，模块卸载时，其执行器实际使用的校验链中的 `CooldownValidator` 与 `UsageLockValidator` 会被释放（无论该链来自 `super(chain)` 还是重写的 `createDefaultValidatorChain()`）；仍被另一个已加载执行器使用的验证器会保留其冷却、锁与退出清理，直到最后一个使用它的执行器卸载。

::: tip 校验链无法强制执行的 @CmdCD 现在会拒绝加载 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，标注了 `@CmdCD`、而其校验链中缺少 `CooldownValidator` 的类或方法——最常见的情形是省略了它的自定义 `ValidatorChain`，见下方[创建自定义验证器](#创建自定义验证器)一节——会在插件加载时被拒绝，并指出问题类与方法。这关闭了此前「看似已声明，实则拦不住任何调用」的缺口。
:::

#### 配置项绑定的冷却时间 <Badge type="tip" text="v6.3.0+" />

::: info 自 v6.3.0 起
`@CmdCD` 可以不写字面量，改为从模块自己的配置文件中读取冷却时间，服主因此可以直接调整它。
:::

用 `key` 指定一个 `@ConfigEntry` 路径，并用 `config` 指定配置实体类。值的单位与 `value` 相同，都是秒，默认值只写在配置字段上：

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownCommand.java

绑定的值为 `0` 表示没有冷却，与 `value = 0` 相同。键按 `@ConfigEntry(path = ...)` 声明的路径匹配；`path` 为空时按字段名匹配。与字面量的 `@CmdCD` 一样，绑定的 `@CmdCD` 可以写在执行器类上，也可以写在映射方法上，以最具体的声明为准。

绑定在加载时检查。以下情况只有该模块被拒绝加载，日志中会给出键名和值：

- `value` 与 `key` 同时设置；
- 该配置类没有为模块恰好注册一次；
- 键没有匹配到任何 `@ConfigEntry` 路径；
- 被绑定字段的类型不是 `int`、`long`、`Integer` 或 `Long`；
- 值为负数、`null`，或大于 `Integer.MAX_VALUE`。

绑定的值为负数会导致模块被拒绝加载，而字面量的 `@CmdCD` 值小于等于 0 时仍然只是关闭该映射的冷却。

修改后的值在执行 `/ul reload` 时生效。解析出的秒数按执行器缓存，只在配置重载成功后刷新，因此通过面板所做的修改同样要等到下一次 `/ul reload`。重载时读到无效的值会保留当前正在使用的值，输出一条 WARNING，并且自 v6.3.0 起把这次重载报告为部分重载，写明该键、被拒绝的值和继续使用的值（[#595](https://github.com/UltiKits/UltiTools-Reborn/issues/595)）。已经在计时的冷却保持它开始计时时确定的结束时间，与新值无关：重载为 `0` 只是不再开始新的冷却，正在计时的冷却会自然到期。面板写入如果把被绑定的键设为范围之外的值（例如负数），会像违反 `@Range` 一样被拒绝，不会写入任何内容。

被绑定的字段不要加模块自己的 `@Range`，绑定范围就是该字段的范围。如果同一字段上有 `@Range`，重载时超出范围的值会让配置重载本身失败，停止该模块其余的重载步骤并报告为失败（[#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509) 已在 6.3.0 修复：完整的 `/ul reload` 仍会继续重载下一个模块），而不是保留当前正在使用的值。

[外部插件 API](/zh/guide/advanced/external-plugin-api) 执行器中的绑定会被拒绝。在 6.x 中，使用绑定的模块须在 `plugin.yml` 中声明至少 `630`（面向 6.3.0 时为 `api-version: 630`）：6.2.x 框架会静默忽略这些新属性，完全不会执行冷却；6.3.0 则会拒绝使用了绑定、却声明了更低 `api-version` 的模块。`@Scheduled` 也支持同样的绑定方式，见[绑定到配置项的时间](/zh/guide/advanced/scheduled-tasks#绑定到配置项的时间)。

自 v7.0.0 起，所有模块都须针对 7.0 重新构建并声明至少 `api-version: 700`；配置绑定的 `630` 下限不能替代 7.0 的模块准入要求，见[6.x 模块升到 7.0](/zh/guide/advanced/module-versioning#modules-6x-to-7)。

### 执行锁

如果你希望一个命令只能被一条一条地执行，那么可以在相应的方法前面添加 `@UsageLimit` 注解：

```java
@UsageLimit(ContainConsole = false, value = LimitType.SENDER)
```
其中 `ContainConsole` 为是否将限制应用于控制台，`value` 为限制类型。自 v6.3.0 起，`ContainConsole` 默认值为 `true`——除非像上面这样显式设为 `false`，否则控制台发送者现在也受此限制约束。

可用的类型有：

- `LimitType.SENDER` 限制每个发送者每次只能有一条该指令在执行
- `LimitType.ALL` 限制全服只能有一条该指令在执行
- `LimitType.NONE` 不作限制

自 v6.3.0 起，`@UsageLimit` 也可以写在执行器类上，或写在声明这些映射的基类上。没有自带 `@UsageLimit` 的映射使用类级注解；方法级注解只管辖它自己的映射。

在 `LimitType.SENDER` 策略下，玩家在上一条该指令执行完毕之前重复执行前将会收到提示（`command.error.sender_locked`）：`请先等待上一条命令执行完毕！`（英文 `Please wait for last Command Processing!`）

自 v6.3.0 起，命令方法体在主线程上于分派时执行，因此持有锁的方法体再分派自身命令时，嵌套的那次分派会以上面的提示被拒绝（`SENDER`：同一发送者；`ALL`：任何发送者）。获取锁从不等待，因此不会阻塞；外层方法体返回时（无论正常返回还是抛出异常）会释放它的锁。如果嵌套调用必须执行，请用模块的 `Scheduler` 调度（例如 `scheduler.entity(player).run(...)`）。同样自 v6.3.0 起，校验时已获取的锁，在分派随后于方法执行前被拒绝时会被释放：被冷却拒绝（冷却在锁之后检查）、参数个数不对、参数无法解析，或者后续验证器的 `shouldValidate` / `validate`、模块的参数解析器抛出异常（该异常随后原样抛出）。v6.3.0 之前，这种情况下锁会一直保留到玩家退出，此后该映射的每一次调用都会被拒绝。

::: tip @UsageLimit 现在真正实现了串行化 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，获取即为门槛：锁在验证本身内部被获取，被拦截的发送者在方法执行前就会被拒绝；`ALL` 范围的锁只能由获取它的发送者释放，其他发送者的完成不再能释放它。与上面的 `@CmdCD` 一样，链中缺少 `UsageLockValidator` 的 `@UsageLimit(SENDER|ALL)` 会在加载时拒绝，并指出问题类与方法；`LimitType.NONE` 不受此约束。
:::

在 `LimitType.ALL` 策略下，玩家在服内上一条该指令执行完毕之前重复执行前将会收到提示（`command.error.server_locked`）：`请先等待其他玩家发送的命令执行完毕！`（英文 `Please wait for last Command Processing which sent by other players!`）。自 v7.0.0 起这两条提示都按接收者的客户端语言渲染。

## 命令上下文 <Badge type="tip" text="v6.2.0+" />

`CommandContext` 是一个不可变的对象，它封装了命令调用的所有信息。它被传递给验证器，并在执行期间可用于访问命令元数据。

自 v7.0.0 起，`getParsedParams()` 返回保存解析结果的 `Map<String, Object>`，`getParam` 与 `getParamValue` 返回 `Object`：请把结果转换成声明的参数类型；对数组参数调用 `getParamValue` 时，转换成数组元素类型。

### 访问上下文信息

```java
// 检查发送者是否是玩家
boolean isPlayer = context.isPlayer();

// 获取玩家（如果发送者不是玩家则返回 null）
Player player = context.getPlayer();

// 获取原始命令发送者
CommandSender sender = context.getSender();

// 获取命令名及其别名（v7.0.0 之前为 getCommand()）
String commandName = context.getCommandName();
String alias = context.getAlias();

// 获取原始参数
String[] args = context.getRawArgs();
int argCount = context.getArgCount();
String firstArg = context.getArg(0);

// 按名称获取已解析的参数；自 v7.0.0 起是类型化的值
Object nameValue = context.getParam("name");
Object singleValue = context.getParamValue("name");

// 获取匹配的方法和格式
Method method = context.getMatchedMethod();
String format = context.getMatchedFormat();

// 获取命令调用时间戳
long timestamp = context.getTimestamp();
```

## 命令验证链 <Badge type="tip" text="v6.2.0+" />

验证链实现了责任链模式，允许你组合多个按顺序执行的验证器。内置验证器处理常见需求，如权限、发送者类型、冷却和执行锁。

### 内置验证器

#### SenderTypeValidator

验证命令发送者是否与预期的目标类型匹配（玩家、控制台或两者）：

<<< @/../examples/src/main/java/com/ultikits/docs/command/PlayerOnlyCommand.java

#### PermissionValidator

验证发送者是否具有所需权限：

```java
@CmdExecutor(
    alias = {"admin"},
    permission = "myadmin.use",  // 所有命令的基本权限
    requireOp = false
)
@CmdMapping(format = "reload", permission = "myadmin.reload")  // 方法特定权限
public void reload(@CmdSender CommandSender sender) {
    // 只有拥有 "myadmin.reload" 权限的用户才能执行此命令
}
```

#### CooldownValidator

使用 `@CmdCD` 管理每个玩家的命令冷却：

```java
@CmdMapping(format = "expensive")
@CmdCD(30)  // 30 秒冷却
public void expensiveOperation(@CmdSender Player player) {
    // 执行昂贵的操作
    // 玩家必须等待 30 秒后才能再次执行
}
```

以编程方式访问冷却状态：

```java
public void checkCooldown(UUID playerId, String methodKey) {
    long remaining = getCooldownValidator().getRemainingCooldown(playerId, methodKey);
    if (remaining > 0) {
        // 玩家仍在冷却中
    }
}
```

冷却校验器通过 `getCooldownValidator()` 获取，它是 `BaseCommandExecutor` 上的一个实例字段。每个命令执行器各持有自己的一份，因此该调用只能取到当前执行器的冷却状态。`methodKey` 是映射方法的 `method.toString()`。向 `super(...)` 传入自定义验证链时，`getCooldownValidator()` 返回的实例不在链中，始终报告没有冷却；请保留你放进链中的 `CooldownValidator` 的引用并查询它。通过自定义 `ValidatorChain` 把同一个校验器交给多个执行器时，以字符串为键的 `getRemainingCooldown(UUID, String)` 与 `clearCooldown(UUID, String)` 作用于其中全部执行器；自 v6.3.0 起，重载 `getRemainingCooldown(UUID, Object executor, String methodKey)` 与 `clearCooldown(UUID, Object executor, String methodKey)` 只作用于一个执行器。

#### UsageLockValidator

使用 `@UsageLimit` 防止并发执行：

```java
@CmdMapping(format = "backup")
@UsageLimit(value = UsageLimit.LimitType.ALL)  // 仅限服务器执行一个
public void backup(@CmdSender CommandSender sender) {
    // 同时只有一个玩家可以运行此命令
}

@CmdMapping(format = "download")
@UsageLimit(value = UsageLimit.LimitType.SENDER)  // 每个玩家仅一个
public void download(@CmdSender Player player) {
    // 每个玩家同时只能运行一个
}
```

### 创建自定义验证器

实现 `CommandValidator` 来创建自定义验证逻辑。自 v6.3.0 起，在 `validate` 中获取了资源的验证器应在 `onRefused` 中释放它；后续验证器抛出异常时，`onRefused` 同样会被调用：

<<< @/../examples/src/main/java/com/ultikits/docs/command/WorldRestrictionValidator.java

在你的命令执行器中注册验证器：

<<< @/../examples/src/main/java/com/ultikits/docs/command/ValidatorCommand.java

::: warning 自定义验证链会替换掉全部四个默认验证器
把 `ValidatorChain` 传给 `super(...)` 会跳过 `createDefaultValidatorChain()`，因此 `SenderTypeValidator`（类上的 `@CmdTarget`）、`PermissionValidator`（`requireOp` 与方法级 `@CmdMapping` 的权限，类级 `permission` 仍会强制，自 v7.0.0 起由命令树的根节点而不是 Bukkit 强制）、`UsageLockValidator`（`@UsageLimit`）与 `CooldownValidator`（`@CmdCD`）都不在链里，除非你自己把它们加进去。
改用上面那种写法：调用 `super()` 后用 `addValidator(...)` 注册自己的验证器，四个默认验证器保留，你的验证器按 `getOrder()` 排序。
自 v6.3.0 起，链中缺少匹配验证器的 `@CmdCD`/`@UsageLimit` 会在插件加载时被拒绝，而不再是静默记录状态却不强制执行——见上方[命令冷却](#命令冷却)与[执行锁](#执行锁)小节的提示。
:::

或使用自定义验证链：

<<< @/../examples/src/main/java/com/ultikits/docs/command/ChainCommand.java

### 验证器执行顺序

验证器按其 `getOrder()` 值的顺序执行（较低的值优先）：

1. **100** - SenderTypeValidator（确保正确的用户类型）
2. **200** - PermissionValidator（检查权限）
3. **250** - UsageLockValidator（防止并发执行）
4. **300** - CooldownValidator（检查冷却状态）
5. 自定义验证器按其 `getOrder()` 返回值排序；默认值为 `0`，会排在所有内置验证器之前，如需在其后执行请返回大于 300 的值（示例用 400）

## 异步命令 <Badge type="tip" text="v6.2.0+" />

使用 `@AsyncCommand` 以异步方式执行命令而不阻塞服务器线程。它比 `@RunAsync` 提供更多配置选项：

```java
@CmdMapping(format = "backup")
@AsyncCommand
public void backupWorld(@CmdSender Player player) {
    // 异步运行 - 适合 I/O 操作
    performBackupLogic();

    // 回到玩家的线程进行 Bukkit 操作（自 v7.0.0 起）
    scheduler.entity(player).run(() -> {
        player.sendMessage("备份已完成！");
    });
}
```

### 异步命令选项

::: tip @AsyncCommand 的 timeout 现在真正生效 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，`timeout()` 是框架"等待多久"的截止时间，不是对方法体的取消：配置的时长耗尽而命令体仍在运行时，框架停止等待并向发送者发送一条超时消息，但命令体本身永远不会被中断，会自行运行至完成。`timeout = 0` 会完全禁用该监视器——框架会无限期等待，永远不会报告超时。
:::

```java
@AsyncCommand(
    showProcessing = true,                      // 显示"处理中..."消息
    processingMessageKey = "my-module:backup.processing",  // 带命名空间的消息键（v7.0.0 起）
    timeout = 60                                // 60 秒超时（0 = 无超时，不设置时默认 30 秒）
)
@CmdMapping(format = "backup")
public void backupWorld(@CmdSender Player player) {
    // 上述配置的作用：
    // - 执行时显示 my-module:backup.processing 对应的文本
    //   （键为空或无效时使用默认的 ultitools:command.async.processing）
    // - 使用模块自己的消息而不是默认值
}
```

### 处理中提示的消息键 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，`processingMessageKey` 是形如 `<namespace>:<path>` 的带命名空间消息键，例如 `my-module:backup.processing`。文本放在模块自己的语言文件里（`messages/en.yml`、`messages/zh.yml`，见[消息与语言](/zh/guide/essentials/messages)），命名空间是模块 `plugin.yml` 中 name 的小写形式，颜色来自该目录；每个玩家按自己的客户端语言看到它。留空使用框架的 `ultitools:command.async.processing`（`处理中...`）。不是合法键的值会按执行器与取值各记录一次警告，并同样使用默认文本：

```text
Invalid processingMessageKey on <executor class>: <value>; using the default processing message
```

```yaml
# 模块 "my-module" 的 src/main/resources/messages/zh.yml
backup:
  processing: "<yellow>正在备份世界..."
```

迁移 6.x 的代码：6.x 的取值是 `i18n(...)` 键（旧示例用 `command.backup.processing`），框架会把文本以黄色发送。把键改成 `<namespace>:<path>`，把文本移到模块的 `messages/<locale>.yml`，颜色用 MiniMessage 写在文本里，`showProcessing` 不变。不含冒号的 6.x 取值在 7.0 下无效，会退回默认文本。

### 调度、超时与卸载 <Badge type="tip" text="v7.0.0+" />

自 v7.0.0 起，命令方法体由框架自己的 `Scheduler` 运行（见[框架自己调度的工作](/zh/guide/advanced/scheduled-tasks#框架调度的工作)），不再用 Bukkit 调度器，命令包中也不再直接使用 Bukkit 调度器：

- **方法体。** `@RunAsync` 或 `@AsyncCommand` 的方法体在框架调度器的 `async()` 上下文中运行一次。它不是实体任务，因此玩家离线不会跳过方法体及其完成钩子（例如释放锁）。异步方法体的失败回复（`command.error.execution_failed`）由运行它的工作线程发送。
- **超时监视器。** `@AsyncCommand` 的超时是调度在框架调度器上的监视器。`command.async.timeout` 通知对玩家在其 `entity(player)` 上下文中送达，对其他发送者在 `global()` 上下文中送达；只发送一次，方法体先结束时监视器被取消。报告超时只表示停止等待：方法体**不会**被中断，会继续运行至完成。
- **卸载与停服。** 释放模块资源之前，框架会等待仍在运行的异步命令方法体，且不中断它们；正在卸载的执行器会拒绝新的异步提交。这段等待共用约 10 秒的期限：单个模块卸载时，该模块的各执行器共用一份新的额度；整个服务器停止时，所有执行器共用一份额度，框架自己的命令最先，且早于任何框架服务关闭。只有实际等待的时间才计入。额度用完后，每个仍有方法体在运行的执行器记录一条警告，卸载继续：

```text
Async command unload wait expired for <executor class>: <n> invocation(s); work continues in the background
```

- **出现该警告后，方法体不能依赖什么。** 方法体在模块资源被释放之后仍会在后台继续运行：不要再触碰模块的服务、数据、监听器或调度器（已退役的调度器会以 `RejectedExecutionException` 拒绝新的提交），也不要让方法体阻塞等待 `global()` 或 `entity()` 的回调，因为正在卸载的线程在等待期间无法运行该回调。
- **看门狗。** 在运行中的服务器上，等待发生在服务器线程上，所以等满时会与 Paper 默认的看门狗早期预警（10 秒）同时出现并打印线程转储；这不是崩溃。命令等待与界面存储等待相互独立，因此最坏约 20 秒。详见 `COMPATIBILITY.md` 中的 [Live-unload waits](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#live-unload-waits-and-paper-watchdog-warnings)。

::: warning 已知限制
`@CmdCD(5)` 的命令可能显示 6 秒冷却，因为未走完的一秒向上取整。卸载等待之后仍在运行的异步方法体不会被中断；它在模块资源消失之后自行结束，因此请让耗时较长的方法体在模块不再启用时自行停止。
:::

## 自定义类型解析器 <Badge type="tip" text="v6.2.0+" />

类型解析器将命令参数字符串转换为你的方法所需的类型。UltiTools 为原始类型、Bukkit 实体和数组提供了内置解析器。

### 内置解析器

自 v7.0.0 起，内置类型由原生参数类型处理，不再使用解析器，清单见[参数类型](#参数类型)。6.x 的内置解析器如下：

- **原始类型**: String、Integer、Double、Float、Long、Short、Byte、Boolean
- **Bukkit 实体**: Player、OfflinePlayer、Material、World
- **其他类型**: UUID、Location、GameMode、Enchantment
- **数组**: 上述所有类型都支持数组语法

自 v7.0.0 起，注册的 `TypeParser` 读取一段文字（双引号括起的值算一段），只用于没有原生映射的类型。`parse` 抛出 `TypeParseException` 时，发送者看到它的消息。模块的命令编译时解析器必须已经注册，否则该类型没有映射，模块会被拒绝（见[被拒绝的格式](#被拒绝的格式)）。该类型的数组可用于 `<name...>` 参数。Paper 会保留已注册的参数类型，包括模块自定义的解析器，因此替换模块 JAR 需要重启。

### 创建自定义解析器

实现 `TypeParser<T>`：

<<< @/../examples/src/main/java/com/ultikits/docs/command/ColorParser.java

注册解析器：

```java
@Autowired
private UltiToolsPlugin plugin;

@PostConstruct
public void init() {
    TypeParserRegistry.getInstance().register(new ColorParser());
}
```

在你的命令中使用：

```java
@CmdMapping(format = "setcolor <color>")
public void setColor(@CmdSender Player player, @CmdParam("color") Color color) {
    // color 自动解析
}
```

支持数组的高级解析器：

<<< @/../examples/src/main/java/com/ultikits/docs/command/RangeParser.java

```java
// 使用方式
@CmdMapping(format = "random <range>")
public void randomNumber(@CmdSender Player player,
                         @CmdParam("range") IntRange range) {
    int value = ThreadLocalRandom.current().nextInt(range.min, range.max + 1);
    player.sendMessage("随机值: " + value);
}
```

## 传统命令执行器

::: danger v7.0.0 起已移除
`AbstractCommand`、`AbstractPlayerCommandExecutor`、`AbstractTabExecutor` 与 `AbstractConsoleCommandExecutor` 在 v7.0.0 中已删除。本节描述的是 6.x；在 7.0 中请改用带 `@CmdTarget` 的 `BaseCommandExecutor`，写法见下方标注「自 v7.0.0 起」的代码。
:::

### 游戏内命令

如果你希望一个指令只能在游戏内使用（由玩家执行），那么可以继承 `AbstractPlayerCommandExecutor` 类，并重写 `onPlayerCommand` 方法。

<<< @/../examples/src/main/java/com/ultikits/docs/command/PlayerCommandExample.java

该方法接收命令、参数和玩家；与 `CommandExecutor#onCommand` 不同，没有别名（label）参数。

自 v7.0.0 起，同样的只限玩家的命令写成用 `@CmdTarget` 限定的 `BaseCommandExecutor`：

```java
@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(alias = {"mycmd"})
public class PlayerCommandExample extends BaseCommandExecutor {
    @CmdMapping(format = "")
    public void run(@CmdSender Player player) {
        // 你的代码
    }

    @Override
    protected void handleHelp(CommandSender sender) {
        // 发送帮助信息
    }
}
```

控制台发送者的命令树里看不到这个命令，见[可见性](#可见性)。

如果尝试在控制台执行该命令，将会收到一条错误消息：`只有游戏内可以执行这个指令！`

如果你希望该指令能够使用 Tab 补全，请看下一节。

### 命令补全

Bukkit API 提供了 `TabCompleter` 接口用于命令补全。

UltiTools 对该接口进行了封装，提供了一个更加简洁的命令补全方式。

你只需要继承 `AbstractTabExecutor` 类，并重写 `onPlayerTabComplete` 方法。

```java
@Override
protected List<String> onPlayerTabComplete(Command command, String[] strings, Player player) {
    // 你的代码
    return null;
}
```

该方法接收命令、参数和玩家；与 `TabCompleter#onTabComplete` 不同，没有别名（label）参数。

其余的用法与 `AbstractPlayerCommandExecutor` 类相同。

### 控制台指令

如果你希望一个指令只能在控制台使用，那么可以继承 `AbstractConsoleCommandExecutor` 类，并重写 `onConsoleCommand` 方法。

<<< @/../examples/src/main/java/com/ultikits/docs/command/ConsoleCommandExample.java

该方法接收发送者、命令和参数；与 `CommandExecutor#onCommand` 不同，没有别名（label）参数。

自 v7.0.0 起，只限控制台的命令写成在类上标注 `@CmdTarget(CmdTarget.CmdTargetType.CONSOLE)` 的 `BaseCommandExecutor`，写法与上面的玩家示例相同；它的补全见[参数Tab提示补全](#参数tab提示补全)。

如果尝试在游戏内执行该命令，将会收到一条错误消息：`只可以在后台执行这个指令！`

### 指令帮助

上述三个类都从 `AbstractCommand` 继承了 `sendHelpMessage`，它在那里声明为 `protected abstract`。
它**不是框架替你提供的**，每个子类都必须自己实现——上面两个示例里的那个 override 就是因为这个：

```java
@Override
protected void sendHelpMessage(CommandSender sender) {
    // 你的代码，向玩家发送信息
}
```

当发送 `/somecommand help` 指令时，将会调用该方法。

### 错误处理

你可能会发现，上述三个类的 onCommand 方法都返回了一个 `boolean` 类型的值。

与原生的 `CommandExecutor` 接口相同，该值用于表示命令是否执行成功。

当命令执行返回 `false` 时，将自动向命令发送者提示信息。
