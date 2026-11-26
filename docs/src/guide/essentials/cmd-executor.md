# Command Executor

In traditional Bukkit plugin development, we usually use the `CommandExecutor` interface of Bukkit to handle commands.

However, in some cases, we need to determine whether the sender of the command is a player, whether it has certain
permissions, and determine the parameters, etc.

If a plugin has multiple commands, then these judgment logic will be repeated in the processing method of each command,
such code is very redundant.

In addition, we may also need to handle command errors, output help information, etc.

UltiTools-API offers a more concise way to handle commands: you declare commands with annotations and the framework does the matching, checking and replying. As of v7.0.0 the framework compiles those annotations into a Brigadier command tree and registers it through Paper; it no longer wraps Bukkit's `CommandExecutor` interface. See [Command engine](#command-engine) below.

## Create a command executor

Starting with v6.2.0, you should inherit the `BaseCommandExecutor` class and override the `handleHelp` method. The `@CmdTarget`
and `@CmdExecutor` annotations here represent the target type and executor information of the command.

::: danger Removed in v6.3.0
`AbstractCommandExecutor` (and the empty `AbstractCommendExecutor` shim) was deprecated since v6.2.0 and deleted outright in v6.3.0.
Use `BaseCommandExecutor` instead — same annotation-driven features, plus a pluggable validation chain and custom type parsers.
See [the migration guide](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#migrating-off-abstractcommandexecutor) in `COMPATIBILITY.md`.
:::

::: tip `/cmd help` is gated the same as any other invocation <Badge type="tip" text="v6.3.0+" />
Before v6.3.0, the help subcommand ran ahead of the validator chain, so `handleHelp` could still run for a console sender on a `@CmdTarget(PLAYER)` command, or for a sender missing the required permission. As of v6.3.0, `handleGatedHelp` runs `SenderTypeValidator` and `PermissionValidator` first, so a wrong sender type or a missing permission is refused before your `handleHelp` implementation ever runs. A custom validator subclass whose `shouldValidate` reports the context does not apply is skipped here too, the same as during normal command dispatch.
:::

<<< @/../examples/src/main/java/com/ultikits/docs/command/ExampleCommand.java

You have completed an empty command executor that does nothing! The `@CmdTarget` and `@CmdExecutor` annotations here
represent the sender type and executor information of the command. We will introduce these two annotations in detail in
the next section.

## Register command

::: info Connector constructor as of v6.3.0
The six-parameter constructor has been removed. The connector below uses the seven-parameter constructor and receives `resourceFolderPath` from its caller.
For a new standalone Bukkit plugin, prefer `UltiToolsAPI.connect(this)` in your own `JavaPlugin`; see the [External Plugin API](/guide/advanced/external-plugin-api).
:::

The same as spigot development, with the executor, you need to register it. We can use
the `getCommandManager().register()` method to register the command in the `registerSelf` method.

If your module has a large number of command executors and you don't want to register them manually, you can also use
the automatic registration provided by UltiTools, for details, please refer
to [this article](/guide/advanced/auto-register).

<<< @/../examples/src/main/java/com/ultikits/docs/command/UltiToolsConnector.java

As of v7.0.0, `register(UltiToolsPlugin, Class<? extends BaseCommandExecutor>)` takes the executor from the module's container, and the class must carry `@CmdExecutor`; an executor class without it is refused, with no fallback registration.

## Command engine <Badge type="tip" text="v7.0.0+" />

::: info As of v7.0.0
Annotated command classes are compiled into Brigadier command trees and handed to Paper. This is unreleased 7.0 behaviour; every module must be rebuilt against 7.0.
:::

### How a command is registered

When a module registers a `BaseCommandExecutor`, the framework reads `@CmdExecutor`, every `@CmdMapping` format and the `@CmdParam` parameters, and builds one Brigadier node tree per command: each literal of a format becomes a literal node, each `<name>` an argument node with a native argument type (see [Argument types](#argument-types)), and the mapped method becomes the node's execute callback. The tree is handed to Paper only during Paper's `LifecycleEvents.COMMANDS` event. The framework no longer builds `PluginCommand` objects reflectively or edits Bukkit's private command map.

Parsing and Tab completion therefore come from Brigadier: the client receives the command tree, checks the input against it and completes from it. The framework still runs its validator chain (sender type, permission, execution lock, cooldown, custom validators) before the mapped method, and still sends its own replies to input that matches no mapping (see [Framework replies](#framework-replies)).

What a module author writes stays the same: a class that extends `BaseCommandExecutor`, carries `@CmdExecutor`, and maps methods with `@CmdMapping`, `@CmdParam`, `@CmdSender`, `@CmdTarget`, `@CmdSuggest`, `@CmdCD`, `@UsageLimit`, `@RunAsync` and `@AsyncCommand`. A module that needs a tree the annotations cannot express can register a container bean (for example with `@Service`) that implements `com.ultikits.ultitools.command.BrigadierCommand`: `node()` returns the root `LiteralCommandNode<CommandSourceStack>`, and `aliases()` and `description()` are optional. Such a hand-written tree gets no annotation validators, cooldowns or `@CmdParam` completion.

### Migrating from 6.x

Code written against 6.x has to be recompiled; it does not run on 7.0 unchanged. The changes that affect command code:

| Removed or changed in 7.0 | Use instead |
|---|---|
| `BaseCommandExecutor` implementing Bukkit's `TabExecutor`, with `onCommand` and `onTabComplete` | Keep extending `BaseCommandExecutor`; the framework invokes the mapped methods through Brigadier |
| `matchMethod`, `parseParameters`, `validateParameterCount`, `parseParameterValue` | No replacement; the compiled tree and its argument types do the matching and parsing |
| `suggest(Player, Command, String[])` and `suggest(CommandSender, Command, String[])` | `suggest(CommandSender sender, String label, String[] args)`; see [Executor fallback](#executor-fallback) |
| `CommandContext.getCommand()` | `getCommandName()`; `getParsedParams()` is now `Map<String, Object>` of typed values, and `getParam` / `getParamValue` return `Object` |
| `AbstractCommand`, `AbstractTabExecutor`, `AbstractPlayerCommandExecutor`, `AbstractConsoleCommandExecutor` | `BaseCommandExecutor` (with `@CmdTarget` for player-only or console-only commands) or `BrigadierCommand` |
| The built-in `WorldParser`, `GameModeParser`, `LocationParser` and `EnchantmentParser` | Paper's native argument types; see [Argument types](#argument-types) |
| `CommandManager.unregister(String)` | Unregister the owning module |
| `CommandManager.getPluginByCommand(Command)` | `getPluginByLabel(String)` |
| `registerCoreCommand(CommandExecutor)` | `registerCoreCommand(BaseCommandExecutor)` |

`getMappings`, custom validators, `handleHelp`, `getHelpCommand`, `createDefaultValidatorChain`, `executeCommand` and `buildMethodParams` remain. The full table is in the "Command engine (as of 7.0.0)" section of the framework's [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md).

### Rejected formats

The tree has to be unambiguous, so the framework checks every executor when it compiles it. These declarations are refused:

- two different parameters at the same position after the same literals (for example `give <player>` and `give <amount>` on one command);
- two mappings that end at the same path, including two methods with the same format on one class (a subclass may still override an inherited mapping);
- a `<name...>` parameter that is not the last part of the format, a `<name...>` parameter whose type is not `String` or an array, and an array parameter without `...`;
- a parameter type with no argument mapping and no registered `TypeParser`;
- a `@CmdParam` name that does not appear in the format, or a `<name>` without a matching `@CmdParam`.

A literal and an argument may share a position. When an executor is refused, only that module is not loaded: its commands, listeners and container are rolled back, and other modules and the framework's commands keep working. The console shows one SEVERE line of this form:

```text
Cannot load module <module>: executor <class>: <class>#<method> [<format>]: <reason>. Change @CmdMapping formats to use distinct literal prefixes, one parameter name/type per position, terminal <name...> arrays, and registered custom type parsers.
```

The reason is, for example, `competing parameter with <method>`, `duplicate path with <method>` or `greedy parameter must be last`.

### Registration after start-up

Paper builds its command tree during start-up. A command whose root is first registered after that, or whose tree changes, is not usable at once. The console logs one warning:

```text
Command /<label> from <owner> was registered after start-up; it becomes available after /minecraft:reload or a restart.
```

The command becomes usable after `/minecraft:reload` or a server restart. The framework never reloads data packs by itself. `/ul reload` reloads configuration only: it does not register or rebind commands, so it does not make such a command available. Installing or updating a module JAR still needs a restart.

## Mapping-based command executor

### Quick start

Assuming that your plugin has a function to set the teleport point, you want the player to enter a command with the
teleport point name, so as to set up a teleport point.

Then this command should look like this: `/point add name`

If you use the traditional method, you need to judge the legality of the parameter input, the sender and permissions,
etc. If there are other functions, you also need to write a lot of `switch ... case` and `if ... else` statements, crazy
nesting.

However, with UltiTools, you only need to write the main logic, and the rest will be handled by UltiTools.

First, you need to create an executor class that inherits `BaseCommandExecutor`.

Then create a method named `addPoint` and add the parameters you want:

```java
public void addPoint(@CmdSender Player player, String name) {
  ...
}
```

Yes, each of your functions uses a separate function without extra judgment.

If you want to get the `Player` object instead of the `CommandSender` object, then you get the `Player`, you don't need
to judge and convert at all. You only need to add the `@CmdSender` annotation in front of the parameter you want to get
the sender object.

Then, you only need to add the `@CmdMapping` annotation so that UltiTools can match your method according to the input
command:

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, String name) {
  ...
}
```

Finally, use `@CmdParam` to bind command parameters:

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, @CmdParam("name") String name) {
  ...
}
``` 

Till now, you only need to register the command executor to complete all the work.

### Tab completion

::: tip Completion comes from the command tree <Badge type="tip" text="v7.0.0+" />
As of v7.0.0, Brigadier suggests literals from the compiled tree, and each argument uses its `@CmdParam(suggest = ...)` provider, then the executor's `suggest` fallback, then the native suggestions of its argument type.
:::

A subcommand the sender may not use is not in that sender's tree, so it is never suggested; see [Visibility](#visibility). A provider of a mapping the sender may not use is not called.

Need Tab suggestion for each command parameter, but don't want to write a lot of code?

It is a disaster to generate a completion list by judging the length of each command and the previous parameters.

Now you only need to write a method for each parameter to return a completion list! This method can be reused, and all
the complicated parameter quantity judgments are left to UltiTools to complete.

What you need to do is just add the `suggest` attribute in the `@CmdParam` annotation and specify a method name.

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, @CmdParam(value = "name", suggest = "listName") String name) {
  ...
}

public List<String> listName(Player player, Command command, String[] args) {
  ...
}
```

UltiTools will first search for matching method names in the current class and try to call this method.

A provider returns `List<String>`. The existing supported parameter lists are exactly `()`, `(Player)`, `(String)`, `(Player, String)` and `(Player, Command, String[])`; parameter order is not arbitrary. `Player` is the requesting player, `String` is the current partial token, `Command` is the current command, and `String[]` is its argument array. As of v7.0.0 the `Command` is looked up by label in the server's public command map.

#### Sender-aware completion <Badge type="tip" text="v6.3.2+" />

As of v6.3.2, console, RCON and other `CommandSender` implementations use the same completion dispatch as players. Providers also accept exactly `(CommandSender)`, `(CommandSender, String)` and `(CommandSender, Command, String[])`. Use the exact `CommandSender` type, not a sender subclass. These forms work both in the executor and in a class named by `@CmdSuggest`.

The same class-level and mapping-level permission and OP checks, and the effective `@CmdTarget`, filter candidates before literals or providers contribute results. `CONSOLE` means any non-player sender, not only `ConsoleCommandSender`. A denied request returns no candidates silently. As of v7.0.0, no candidates means an empty result for every kind of sender; the 6.x fallback that gave a console or RCON sender the server's online player names is gone. Completion does not execute validators with side effects, cooldowns or usage locks, and does not emit command-denial messages.

A registered custom completer receives the requester through `TabCompletionContext.getSender()`. `getPlayer()` returns that player for a player request and `null` for every non-player request; custom completers must check for `null` before using player-only APIs. Player-only provider methods are skipped for non-player requests, never called with a null player. Zero-argument and String-only providers, built-in completers and registered `@key` completers remain available to both kinds of sender.

In 6.3.2 the protected `suggest(Player, Command, String[])` and `suggest(CommandSender, Command, String[])` hooks handled the executor's own completion. As of v7.0.0 both are removed and replaced by one hook, described in [Executor fallback](#executor-fallback). A context built with a player also exposes that player as its sender.

#### Built-in completers (`@key` notation) <Badge type="tip" text="v6.3.0+" />

As of v6.3.0, a `suggest` value starting with `@` resolves through a registered completer instead of a method name — no method to write at all:

```java
@CmdMapping(format = "tp <target>")
public void tp(@CmdSender Player player, @CmdParam(value = "target", suggest = "@players") String target) {
  ...
}
```

Four built-in keys are available: `@players` (online players), `@worlds` (loaded worlds), `@materials` (also `@blocks`/`@items`), and `@boolean` (also `@toggle`). A module can also register its own key at runtime via `TabCompletionManager.register(String, TabCompleter)`.

`@` is not a legal Java identifier start, so this notation can never collide with a method-name value — every example on this page using a plain method name needs no change. An **unknown** `@key` refuses the declaring module to load, naming the class, the method and the key; it does not fall through to the plain-string prompt behaviour described next.

::: tip A fixed string can be given in suggest

As of v7.0.0, if no completion method matches `suggest`, the framework looks up a lowercase dotted path in the module's message catalogue. A missing key or any other spelling is shown as written. See [Module annotation text](/guide/essentials/messages#module-annotation-text) for the path rules, including single-segment keys.

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player,
                     @CmdParam(value = "name", suggest = "[name]") String name) {
  ...
}

```

:::

#### Executor fallback <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, an executor can override one completion hook. It is called for an argument whose `@CmdParam` names no `suggest` provider:

```java
@Override
protected List<String> suggest(CommandSender sender, String label, String[] args) {
    // return null to keep the argument type's native suggestions
    return null;
}
```

`label` is the command label as typed and `args` the input after it, including the partial token. Returning `null` keeps the native suggestions of the argument type (online players for a `Player`, loaded worlds for a `World`, and so on); returning a list replaces them, and an empty list means no candidates. Literal suggestions always come from the tree and cannot be changed here.

#### @CmdSuggest

::: tip @CmdSuggest is read on BaseCommandExecutor <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, the class in the example below is read through the shared `commands/tabcomplete/` dispatch, so the methods in `PointSuggest` are looked up and called exactly as shown.
:::

If you want a completion method to be shared with other command classes, you can create a class and write methods which
you want to reuse in other class.

Add the `@CmdSuggest` annotation to the class which need to use suggestion method, and specify the suggestion class.

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

### Parameters

#### Command without Parameters

If a command does not require any parameters, simply leave the `format` value empty.

```java
@CmdMapping(format="")
```

This type of command can have at most one occurrence. As of v7.0.0, two mappings with the same format on one class refuse the module at load; see [Rejected formats](#rejected-formats).

#### Format syntax

A format is a space-separated list of parts. A part written as a plain word is a literal (a subcommand name); a part written as `<name>` is an argument bound to the method parameter whose `@CmdParam` value is `name`; `<name...>` takes the rest of the line. As of v7.0.0:

- An argument is one token separated by spaces. A `String` argument also accepts a double-quoted value, so `"a b"` is one argument; an unterminated quote is a syntax error.
- A literal and an argument may sit at the same position, but two different arguments may not; see [Rejected formats](#rejected-formats).

#### Variable Parameters

For the last parameter in a method, you can use an array type by adding `...` to the last parameter in the `format`. Here's an example:

```java
@CmdMapping(format = "add <name...>")
public void addPoint(@CmdSender Player player, @CmdParam("name") String[] name) {
  ...
}
```

In this example, when a player enters `/somecmd add aa bb cc`, the `name` will be `['aa', 'bb', 'cc']`.

As of v7.0.0, `<name...>` must be the last part of the format, and its parameter must be a `String` (the remaining text as one string) or an array (the remaining text split at spaces, each element parsed with the component type's mapping). When the tail is omitted, the method receives an empty value. An array parameter written as `<name>` without `...` is refused.

#### Argument types <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, each parameter type maps to a Brigadier argument type, so the client checks and completes the value:

| Java type | Argument |
|---|---|
| `String` | One token, non-ASCII text included; a double-quoted value is one argument |
| `int` / `Integer`, `long` / `Long`, `double` / `Double`, `float` / `Float`, `boolean` / `Boolean` | Brigadier's matching typed argument |
| `short` / `Short`, `byte` / `Byte` | Integer argument limited to the Java type's range |
| `Player` | Paper's player selector, resolved against the sender |
| `OfflinePlayer` | A player name, looked up by Bukkit when the method runs; suggests online player names |
| `World`, `GameMode`, `UUID` | Paper's native world, game-mode and UUID arguments |
| `Enchantment` | Paper's enchantment registry argument |
| `Material` | A namespaced material key such as `minecraft:diamond` |
| `Location` | Paper's fine position `x y z` in the sender's world; relative coordinates work |
| Any other type with a registered `TypeParser` | One token parsed by that parser; see [Custom Type Parsers](#custom-type-parsers) |

Differences from 6.x that change what a player can type:

- `Boolean` accepts only `true` and `false`; 6.x converted any other input, `yes` included, to `false`.
- `Material` needs the lower-case namespaced key (`minecraft:diamond`), not the enum spelling `DIAMOND`.
- `Location` is `x y z`, not the 6.x `world,x,y,z` string.
- A `Player` argument rejects a player who cannot be found instead of passing `null` to the method.

The built-in `WorldParser`, `GameModeParser`, `LocationParser` and `EnchantmentParser`, and the implicit built-in registry entries, are removed. `TypeParserRegistry` keeps only parsers that a module registers explicitly, and a registered parser is used only for a type the table above does not map.

#### Subcommand case <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, every literal matches regardless of case, including a literal after an argument (`/x <player> ADD`). Where a literal and an argument share a position, the literal wins in any case: with `<player>` beside `accept`, `/trade ACCEPT` runs the `accept` mapping. A double-quoted token is always an argument value: if that argument is a `String`, `/trade "Accept"` passes the string `Accept` to it instead of running `accept`. Argument values keep the case the sender typed.

### Permission

#### Method permission

If you need to specify permissions for a method, you need to add the `permission` attribute in the `@CmdMapping`
annotation.

```java
@CmdMapping(..., permission = "point.set.add")
```

::: tip Class-level and method-level permissions are both required
The permissions from `@CmdExecutor` and `@CmdMapping` are **additive** — both are checked independently. The player must have **both** the class-level `@CmdExecutor(permission=...)` and the method-level `@CmdMapping(permission=...)` to execute the command.
:::

#### OP Required

If you want all methods to be executed by OP only, you need to set the `requireOp` attribute in `@CmdExecutor` to `true`

```java
@CmdExecutor(..., requireOp = true)
```

If you want a method to be executed by OP only, you need to set the `requireOp` attribute in `@CmdMapping` to `true`

```java
@CmdMapping(..., requireOp = true)
```

### Sender Limitation

If you want to specify the sender for all methods, you need to add the `@CmdTarget` annotation in front of your
class.

If you want to specify the sender for a method, just add it in front of the method.

```java
@CmdTarget(CmdTarget.CmdTargetType.BOTH)
```

::: warning A method-level `@CmdTarget` may only narrow the class-level one
A method-level `@CmdTarget` may only narrow the class-level one (`BOTH` to `PLAYER` or `CONSOLE`). A widening (`PLAYER` or `CONSOLE` to `BOTH`) or a lateral switch (`PLAYER` to `CONSOLE` or back) refuses the command class at load, naming the class and method.
As of v6.3.0 this includes mappings the class inherits from a base executor class: a `@CmdTarget(CONSOLE)` class that inherits a `@CmdTarget(BOTH)` mapping is refused, and the log also names the class that declared the mapping.
:::

### Visibility <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, a command or subcommand the sender may not use is not part of that sender's command tree. This covers a missing `permission` on `@CmdExecutor` or `@CmdMapping`, `requireOp` for a sender who is not OP, and a `@CmdTarget` that excludes the sender (a console-only subcommand for a player, a player-only one for the console). Such a subcommand is not offered in Tab completion and cannot be run, and the usage reply does not list it. A literal shared with a mapping the sender may use stays visible.

A hidden subcommand behaves as if it did not exist. Typed anyway, in any case, it gets exactly the reply that a nonexistent subcommand at the same position gets (for a first word, the unknown-command line followed by the command's help; see [Framework replies](#framework-replies)), and no business code runs. Execution still checks permission, sender type, cooldown and lock on every dispatch.

::: warning Known limitation: catch-all argument beside a hidden subcommand
When the same position also has a single-word or rest-of-line argument (for example `<name>` beside a permission-gated `admin`), typing the hidden name gets the unknown-command reply while every other word goes to the argument, so the command does not fully hide that the name is special.
Do not put a catch-all argument and a permission-gated subcommand at the same level when the subcommand's name must stay secret.
:::

A permission change while a player stays online does not refresh that player's command tree; it refreshes after the player reconnects or after `/minecraft:reload`. Execution always checks permissions live.

### Framework replies <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, input that matches no mapping still gets the framework's own reply instead of Minecraft's syntax error. Every position accepts a fallback argument, shown to players as `args`; as a consequence the client no longer marks mistyped input red. There are two replies:

| When | English | Chinese |
|---|---|---|
| The first word after the label is not a subcommand the sender may use | `Unknown command, please enter /<label> <help> for help` in red, followed by the command's help | `未知指令，请使用/<label> <help>获取帮助` in red |
| The input goes wrong after the first word | `Correct Usage: ` in yellow, then `/<label> <format>` in grey; one line for each mapping the sender may use below the deepest part that matched | `正确用法: ` 黄色，其后 `/<label> <format>` 灰色 |

In the first reply `<label>` is the command label and `<help>` the help subcommand (`help` unless `getHelpCommand()` is overridden); in the second `<format>` is a mapping's format. A value rejected by a module's own argument parser gets that parser's message in red instead (key `command.reply.argument_error`); the message is shown as the parser wrote it, untranslated. A value that Minecraft's native integer argument rejects, such as `abc` where an `int` is expected, keeps the usage reply. The help shown after the first reply goes through the same sender-type and permission checks as `/<label> help`. The label alone, with no `format = ""` mapping, shows the help.

The unknown-command reply for a nonexistent subcommand and for a subcommand the sender may not use is produced by the same code, and both are rendered for the same recipient in the same way, so a hidden subcommand stays indistinguishable (see [Visibility](#visibility)).

### Reply language and message keys <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, every reply the command package sends goes through the framework's message service (see [Messages and Languages](/guide/essentials/messages)), not through legacy `§` colour codes and not through the server language. With `language: auto`, a player receives each reply in their own Minecraft client language; the console, command blocks and panel feedback get the `fallback-language` from `config.yml`. A command run on behalf of a non-player sender gets the fallback language even when a player triggered it. The framework's thirteen reply texts are the `command.*` keys of the `ultitools` namespace, shipped in `messages/en.yml` and `messages/zh.yml`:

| Key | English | Chinese |
|---|---|---|
| `command.reply.unknown` | `Unknown command, please enter /<label> <help> for help` | `未知指令，请使用/<label> <help>获取帮助` |
| `command.reply.usage` | `Correct Usage: /<label> <format>` | `正确用法: /<label> <format>` |
| `command.reply.argument_error` | a module argument parser's error message, in red | 模块参数解析器的错误信息（红色） |
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

Operators override these texts in `plugins/UltiTools/messages/<locale>.yml` with dotted or nested keys and MiniMessage values; overrides of framework keys need a restart. Arguments are inserted as literal text, so `<format>` pieces such as `<target>` or `<words...>` in a usage line stay visible. The cooldown seconds are a plain integer (`<seconds:'0'>`).

::: warning The old reply texts changed form
Before v7.0.0 these replies were English or Chinese sentences with embedded legacy colour codes, chosen by the server language. The wording and colours are the same, but they are now components in the recipient's language, and overrides use the message files above. Module help (`handleHelp`) and the texts a module's own code sends remain the module's own.
:::

### Validation failures <Badge type="tip" text="v7.0.0+" />

A validator reports a failure with `CommandValidator.ValidationResult`. Besides the `String` factories `failure(String)` and `failure(String, String)`, as of v7.0.0 there is `ValidationResult.failure(Text, String)`: the first argument is deferred text (`com.ultikits.ultitools.text.Text`) rendered in the recipient's language, the second a diagnostic key. The framework's own validators use it for the refusals listed above.

- `getErrorText()` returns the deferred text, or `null` for a success and for a failure built with a `String`.
- `getErrorMessage()` returns the legacy string, and returns `null` for a failure built with `Text`. Code that reads a result must check `getErrorText()` first; `ChainValidationResult.getErrorText()` reads the first failure, as `getErrorMessage()` does.
- A `String` failure of your own validator is sent unchanged: it is not translated and not passed through a catalogue.
- A module's own `TypeParser` that throws `TypeParseException` shows its message as written, untranslated; the fixed English sentences of the framework's parser helpers are not translated either.

```java
return ValidationResult.failure(Text.of(MessageKey.of("my-module", "world.denied")), "world.denied");
```

Repeated or trailing spaces in console or panel input are normalised when the input reaches a fallback. A console or panel command whose last word is a subcommand followed by exactly one trailing space (for example `ul reload `) can be rejected before the framework sees it; trim such input before dispatching it.

### Asynchronous Execution

If a command needs to execute a task that takes a long time, you need to add `@RunAsync` in front of the corresponding

```java
@CmdMapping(format = "list")
@RunAsync
public void listPoint(@CmdSender Player player) {
    //do query
}
```

This will create a new asynchronous thread to execute the method, avoiding blocking in the Bukkit main thread.

Since the Bukkit API does not allow asynchronous calls, if you need to call the Bukkit API, you need to schedule that part back onto the server thread. As of v7.0.0, inject the module's `Scheduler` (see [Scheduler API](/guide/advanced/scheduled-tasks#scheduler-api)) and submit the Bukkit work to the context that owns the data, here the player's:

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

An `@RunAsync` body runs off the server's main thread. It may do CPU work, file and database I/O and network calls. It must not read or change worlds, entities, blocks, chunks or inventories directly; submit that part as shown above. On the current 7.0 development line the async body itself is still started on the Bukkit scheduler, not on the module's `Scheduler`.

::: danger An `@RunAsync` body must not touch world, entity, block or chunk state directly. <Badge type="danger" text="v6.3.0+" />
Asynchrony here is reserved for pure-CPU or I/O work. Any world, entity, block or chunk access an async body needs must be submitted to a server-thread context, `scheduler.entity(player).run(...)` as in the example above or `global()` / `region(...)` for world state; the annotation never grants safe access to those APIs by itself. A handler whose body consists only of such state access has no reason to carry the annotation at all.
:::

An unannotated command body runs on the main thread. As of v6.3.0 it runs at the moment the command is dispatched when that happens on the main thread, and is handed to the `global()` context of the framework scheduler only when the dispatch comes from another thread (before v6.3.0 every such body was deferred by one tick; see [When a command body runs](#when-a-command-body-runs) below). Either way the timing only changes when the body starts, not whether it can block the server: the whole body (including any expensive CPU or I/O work inside it) still runs synchronously on the main thread. Removing `@RunAsync` restores safe dispatch only for a handler that was never doing expensive work in the first place; a handler that mixes expensive work with Bukkit access keeps the expensive part off-thread and submits only the Bukkit-touching part to a server-thread context of the module's `Scheduler`, the pattern shown above, rather than simply removing the annotation. Paper also does not guard every world, entity, block or chunk access from an async body: its asynchronous-operation checks cover a limited set of unsafe operations, so breaking the rule above can leave a handler running on unsafe or inconsistent state instead of crashing outright, and the absence of an exception is not evidence the code is safe. `@RunAsync` remains the right tool for a body that genuinely belongs off-thread and needs nothing more; when that body also needs a processing message, a timeout, or configurable behaviour around the boundary, use `@AsyncCommand` instead.

### When a command body runs <Badge type="tip" text="v6.3.0+" />

As of v6.3.0, a command body without `@RunAsync` or `@AsyncCommand` runs at the moment the command is dispatched, inside the dispatch, whenever that happens on the server's main thread. That is where Bukkit dispatches every command a player, the console, a command block, a command minecart, RCON or the panel's remote command sends. The body is deferred to the main thread only when the dispatch comes from another thread, as Bukkit's own commands behave. Before v6.3.0 every such body ran one tick after the dispatch, so its replies to a command block, a command minecart and RCON were lost: those senders read their output when the dispatch returns. In v6.3.0 the panel's remote command was not one of them: it ran as the server console, so its replies reached the panel through the log stream. As of v6.3.1 it runs with Paper's capturing command sender, which has the console's permissions but is not the console sender, so it is one of them: what the body prints before the dispatch returns comes back in the command's result, and what it prints later, from `@RunAsync`, `@AsyncCommand` or a scheduled task, is written to the server console and reaches the panel through the log stream (see [Panel Integration](/guide/advanced/panel-integration#remote-command-results)). This applies to every module, including third-party ones.

What to check in your module:

- **Code that relied on the one-tick delay** must schedule that work itself; as of v7.0.0 submit it with the module's `Scheduler`, for example `scheduler.entity(player).run(...)`.
- **An `InventoryClickEvent` handler**, including a GUI library's click callback, must not open or close an inventory directly, and must not call `performCommand` or `Bukkit.dispatchCommand` directly either. A module command dispatched there now runs its body, which may open or close an inventory, inside the click event, which Paper does not allow. Defer the call:

```java
icon.onClick(event -> {
    event.setCancelled(true);
    scheduler.entity(player).run(() -> player.performCommand("menu open shop"));
});
```

- **A body that dispatches another command** runs the nested body on the same thread before its own has finished. The audit user that `AuditableDataEntity` writes into `created_by` and `updated_by` is saved before each body and restored after it: the nested body sees its own sender (none for a sender that is not a player), and the outer body sees its own sender again afterwards.
- **A body that dispatches its own command** while it holds its `@UsageLimit` lock gets the nested dispatch refused; see [Execution lock](#execution-lock).
- **Two dispatches of a `@CmdCD` command in the same tick** meet the cooldown: the second is refused, because the cooldown is recorded before the first dispatch returns.

### Command cooldown

If you don't want a command to be executed in large quantities and consume server resources, then you can add
`@CmdCD` in front of the corresponding method:

```java
@CmdCD(60)
```

Parameter type is integer, in second.

If the command is executed before the cooldown ends, the message `command.error.cooldown` is sent: `Frequent operations, please try again in <seconds> seconds` in English, `操作频繁，请 <seconds> 秒后再试` in Chinese. As of v7.0.0 it is rendered in the player's own client language (see [Reply language and message keys](#reply-language-and-message-keys)), and the remaining seconds are shown as a plain integer; before v7.0.0 the text depended on the server language (`en.json` carried a `%d` key as of v6.3.0). A partly elapsed second is rounded up, so a command with `@CmdCD(5)` can show 6 seconds.

This restriction only takes effect on **players**.

**The cooldown applies after every invocation attempt, not only after a successful one.** A mapped
method that throws still starts the cooldown, exactly as if it had returned normally — the validator
does not distinguish success from failure. This is intentional: a command that errors out is still a
server-resource cost, and a caller retrying an erroring command in a tight loop is exactly the pattern
the cooldown exists to prevent.

As of v6.3.0 an active cooldown is kept per executor instance as well as per mapping. One
`CooldownValidator` shared by two executors of the same class, which happens when module code passes
one `ValidatorChain` to both, no longer makes a player wait on executor B after using executor A. A
dispatch refused before the method runs, for example by a wrong argument count, starts no cooldown.

As of v6.3.0, a class-level `@CmdCD` on a shared base executor class applies to the mappings that base class declares, including mappings intercepted by AOP annotations such as `@ExceptionCatch`. A mapping overridden in a subclass follows the subclass's annotations.

As of v6.3.0, when a module unloads, the `CooldownValidator` and `UsageLockValidator` in the chain its executors used are released, whether that chain came from `super(chain)` or from an overridden `createDefaultValidatorChain()`. A validator that another loaded executor still uses keeps its cooldowns, locks and quit cleanup until the last such executor unloads.

::: tip A `@CmdCD` your validator chain cannot enforce now refuses to load <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, a class or method carrying `@CmdCD` whose validator chain has no `CooldownValidator` — most commonly a custom `ValidatorChain` that omits it, see [Creating Custom Validators](#creating-custom-validators) below — is refused at plugin load, naming the offending class and method. This closes the gap where the annotation looked declared but enforced nothing.
:::

#### Binding the cooldown to a config key <Badge type="tip" text="v6.3.0+" />

::: info As of v6.3.0
Instead of a literal, `@CmdCD` can read the cooldown from a key in your module's own config file, so a server owner can tune it.
:::

Name a `@ConfigEntry` path with `key` and give the config entity class with `config`. The value is in seconds, like `value`, and the default lives only in the config field:

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownCommand.java

A bound value of `0` means no cooldown, the same as `value = 0`. The key is matched against `@ConfigEntry(path = ...)` as declared, or against the field name when `path` is empty. Like a literal `@CmdCD`, a bound one may sit on the executor class or on a mapping method, and the most-derived declaration wins.

The binding is checked at load. The module alone is refused, and the log names the key and the value, when:

- `value` is set together with `key`;
- the config class is not registered exactly once for the module;
- the key matches no `@ConfigEntry` path;
- the bound field is not an `int`, `long`, `Integer` or `Long`;
- the value is negative, `null` or above `Integer.MAX_VALUE`.

A negative bound value refuses the module, while a literal `@CmdCD` value of 0 or less still disables the cooldown for that mapping.

A changed value takes effect at `/ul reload`. The resolved seconds are cached per executor and refreshed only after a successful configuration reload, so a panel edit also waits for the next `/ul reload`. An invalid value on reload keeps the running one, logs a WARNING and, as of v6.3.0, reports the reload as partial, naming the key, the refused value and the value kept ([#595](https://github.com/UltiKits/UltiTools-Reborn/issues/595)). A cooldown that is already running keeps the end time it was stamped with, whatever the new value is: a reload to `0` stamps no new cooldown, and the running ones expire on their own. A panel write that sets the bound key outside its range, such as a negative value, is refused like a `@Range` violation, and nothing is written.

Do not put a module `@Range` on a bound field; the binding's range is the field's range. With a `@Range` on the same field, an out-of-range reload makes the configuration reload itself fail, which stops the rest of that module's reload and reports it as failed (since [#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509), fixed in 6.3.0, a full `/ul reload` still continues with the next module), instead of keeping the running value.

A binding in an [External Plugin API](/guide/advanced/external-plugin-api) executor is refused. In 6.x, a module using a binding must declare at least `630` in its `plugin.yml` (`api-version: 630` for 6.3.0): a 6.2.x framework silently ignores the new attributes and would enforce no cooldown at all, and 6.3.0 refuses a module that uses a binding while declaring a lower `api-version`. `@Scheduled` accepts the same kind of binding, see [Config-Bound Timing](/guide/advanced/scheduled-tasks#config-bound-timing).

As of v7.0.0, every module must be rebuilt against 7.0 and declare at least `api-version: 700`; the binding floor of `630` does not replace the 7.0 admission requirement. See [Modules from 6.x to 7.0](/guide/advanced/module-versioning#modules-6x-to-7).

### Execution lock

If you want a command to be executed only one by one, you can add `@UsageLimit` in front of the corresponding method:

```java
@UsageLimit(ContainConsole = false, value = LimitType.SENDER)
```

`ContainConsole` is whether the restriction is applied to the console, and `value` is the restriction type. As of v6.3.0, `ContainConsole` defaults to `true` — a console sender is now subject to a limit unless a mapping opts out explicitly with `ContainConsole = false` as shown above.

Available types are:

- `LimitType.SENDER` limits that each sender can only have one command of this type executed at a time
- `LimitType.ALL` limits that only one command of this type can be executed in the whole server
- `LimitType.NONE` no limit

As of v6.3.0, `@UsageLimit` may also be placed on the executor class, or on the base class that declares the mappings. A mapping without its own `@UsageLimit` uses the class-level one; a method-level annotation governs its own mapping.

Under the `LimitType.SENDER` strategy, the player will receive a prompt (`command.error.sender_locked`): `Please wait for last Command Processing!` (Chinese: `请先等待上一条命令执行完毕！`)

Under the `LimitType.ALL` strategy, the player will receive a
prompt (`command.error.server_locked`): `Please wait for last Command Processing which sent by other players!` (Chinese: `请先等待其他玩家发送的命令执行完毕！`). As of v7.0.0 both prompts are rendered in the recipient's client language.

As of v6.3.0 a command body runs at dispatch on the main thread, so a body that dispatches its own
command while holding its lock gets the nested dispatch refused with the message above (`SENDER`: from
the same sender; `ALL`: from any sender). Acquiring the lock never waits, so nothing blocks, and the
outer body's lock is released when it returns, normally or by throwing. Schedule the nested call with
the module's `Scheduler` (for example `scheduler.entity(player).run(...)`) if it must run. Also as of v6.3.0, a lock taken during validation is released when the
dispatch is then refused before the method runs: by the cooldown, which is checked after the lock, by
a wrong argument count, by a parameter that does not parse, or by an exception thrown from a later validator's `shouldValidate` or `validate` or from a module's parameter parser; such an exception then propagates unchanged. Before v6.3.0 the lock stayed held until
the player quit, and every later call of that mapping was refused.

::: tip @UsageLimit now genuinely serialises <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, acquisition is the gate: the lock is taken inside validation itself, so a blocked sender's invocation is rejected before the method runs, and an `ALL`-scope lock is released only by the sender who acquired it — a different sender's completion can no longer free it. Like `@CmdCD` above, a `@UsageLimit(SENDER|ALL)` whose chain has no `UsageLockValidator` refuses to load, naming the offending class and method; `LimitType.NONE` is exempt.
:::

## Command Context <Badge type="tip" text="v6.2.0+" />

The `CommandContext` is an immutable object that encapsulates all information about a command invocation. It is passed to validators and is useful for accessing command metadata during execution.

As of v7.0.0, `getParsedParams()` returns `Map<String, Object>` holding the parsed values, and `getParam` and `getParamValue` return `Object`: cast the result to the declared parameter type, or for `getParamValue` on an array parameter to its component type.

### Accessing Context Information

```java
// Check if sender is a player
boolean isPlayer = context.isPlayer();

// Get the player (returns null if sender is not a player)
Player player = context.getPlayer();

// Get the raw command sender
CommandSender sender = context.getSender();

// Get the command name and its alias (getCommand() before v7.0.0)
String commandName = context.getCommandName();
String alias = context.getAlias();

// Get raw arguments
String[] args = context.getRawArgs();
int argCount = context.getArgCount();
String firstArg = context.getArg(0);

// Get parsed parameters by name; as of v7.0.0 they are typed values
Object nameValue = context.getParam("name");
Object singleValue = context.getParamValue("name");

// Get the matched method and format
Method method = context.getMatchedMethod();
String format = context.getMatchedFormat();

// Get command invocation timestamp
long timestamp = context.getTimestamp();
```

## Command Validation Chain <Badge type="tip" text="v6.2.0+" />

The validation chain implements the Chain of Responsibility pattern, allowing you to compose multiple validators that execute in order. Built-in validators handle common requirements like permissions, sender type, cooldowns, and execution locks.

### Built-in Validators

#### SenderTypeValidator

Validates that the command sender matches the expected target type (player, console, or both):

<<< @/../examples/src/main/java/com/ultikits/docs/command/PlayerOnlyCommand.java

#### PermissionValidator

Validates that the sender has required permissions:

```java
@CmdExecutor(
    alias = {"admin"},
    permission = "myadmin.use",  // Base permission for all commands
    requireOp = false
)
@CmdMapping(format = "reload", permission = "myadmin.reload")  // Method-specific permission
public void reload(@CmdSender CommandSender sender) {
    // Only users with "myadmin.reload" can execute this
}
```

#### CooldownValidator

Manages per-player command cooldowns using `@CmdCD`:

```java
@CmdMapping(format = "expensive")
@CmdCD(30)  // 30 second cooldown
public void expensiveOperation(@CmdSender Player player) {
    // Performs expensive operation
    // Player must wait 30 seconds before executing again
}
```

Access cooldown state programmatically:

```java
public void checkCooldown(UUID playerId, String methodKey) {
    long remaining = getCooldownValidator().getRemainingCooldown(playerId, methodKey);
    if (remaining > 0) {
        // Player is on cooldown
    }
}
```

The cooldown validator is obtained through `getCooldownValidator()`, an instance field on `BaseCommandExecutor`. Each command executor holds its own instance, so this call only reports cooldown state for the current executor. `methodKey` is `method.toString()` of the mapping method. With a custom chain passed to `super(...)`, `getCooldownValidator()` returns an instance that is not in the chain and always reports no cooldown; keep a reference to the `CooldownValidator` you put in the chain and query that. When you pass one validator to several executors through a custom `ValidatorChain`, the string-keyed `getRemainingCooldown(UUID, String)` and `clearCooldown(UUID, String)` span all of them; as of v6.3.0 the overloads `getRemainingCooldown(UUID, Object executor, String methodKey)` and `clearCooldown(UUID, Object executor, String methodKey)` address one executor.

#### UsageLockValidator

Prevents concurrent execution using `@UsageLimit`:

```java
@CmdMapping(format = "backup")
@UsageLimit(value = UsageLimit.LimitType.ALL)  // Only one per server
public void backup(@CmdSender CommandSender sender) {
    // Only one player can run this at a time
}

@CmdMapping(format = "download")
@UsageLimit(value = UsageLimit.LimitType.SENDER)  // One per player
public void download(@CmdSender Player player) {
    // Each player can only run one at a time
}
```

### Creating Custom Validators

Implement `CommandValidator` to create custom validation logic. As of v6.3.0, a validator that acquires something in `validate` should release it in `onRefused`, which also runs when a later validator throws:

<<< @/../examples/src/main/java/com/ultikits/docs/command/WorldRestrictionValidator.java

Register the validator in your command executor:

<<< @/../examples/src/main/java/com/ultikits/docs/command/ValidatorCommand.java

::: warning A custom chain replaces all four default validators
Passing a `ValidatorChain` to `super(...)` skips `createDefaultValidatorChain()`, so `SenderTypeValidator` (the class-level `@CmdTarget`), `PermissionValidator` (`requireOp` and the method-level `@CmdMapping` permissions, though the class-level `permission` is still enforced, as of v7.0.0 by the root of the command tree rather than by Bukkit), `UsageLockValidator` (`@UsageLimit`) and `CooldownValidator` (`@CmdCD`) are all absent from the chain unless you add them yourself.
Use the form shown just above instead: call `super()` and register your validator with `addValidator(...)`, which keeps the four defaults and orders yours by `getOrder()`.
As of v6.3.0, a class or method whose `@CmdCD`/`@UsageLimit` has no matching validator in the custom chain is refused at plugin load rather than silently recording state without enforcing anything — see the tips under [Command cooldown](#command-cooldown) and [Execution lock](#execution-lock) above.
:::

Or use a custom validator chain:

<<< @/../examples/src/main/java/com/ultikits/docs/command/ChainCommand.java

### Validator Execution Order

Validators execute in order by their `getOrder()` value (lower values first):

1. **100** - SenderTypeValidator (ensure right user type)
2. **200** - PermissionValidator (check permissions)
3. **250** - UsageLockValidator (prevent concurrent execution)
4. **300** - CooldownValidator (check cooldown state)
5. Custom validators, at the value their `getOrder()` returns. The default is `0`, which runs before all built-ins, so return a value above 300 (the example uses 400) to run after them

## Async Commands <Badge type="tip" text="v6.2.0+" />

Use `@AsyncCommand` to execute commands asynchronously without blocking the server thread. It offers more configuration options than `@RunAsync`:

```java
@CmdMapping(format = "backup")
@AsyncCommand
public void backupWorld(@CmdSender Player player) {
    // Runs asynchronously - safe for I/O operations
    performBackupLogic();

    // Back to the player's thread for Bukkit operations (as of v7.0.0)
    scheduler.entity(player).run(() -> {
        player.sendMessage("Backup completed!");
    });
}
```

### Async Command Options

::: tip timeout on @AsyncCommand is now honoured <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, `timeout()` is a deadline on how long the framework *waits*, not a cancellation of the method body: when the configured duration elapses with the body still running, the framework stops waiting and sends the sender one timeout message, but the body itself is never interrupted and keeps running to completion. `timeout = 0` disables the watcher entirely — the framework waits indefinitely and never reports a timeout.
:::

```java
@AsyncCommand(
    showProcessing = true,                      // Show "Processing..." message
    processingMessageKey = "my-module:backup.processing",  // Namespaced message key (as of v7.0.0)
    timeout = 60                                // 60 second timeout (0 = no timeout, defaults to 30 if omitted)
)
@CmdMapping(format = "backup")
public void backupWorld(@CmdSender Player player) {
    // Configuration above:
    // - Shows the text of my-module:backup.processing while executing
    //   (the default ultitools:command.async.processing is used when the key is empty or invalid)
    // - Uses the module's own message instead of the default
}
```

### Processing message key <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, `processingMessageKey` is a namespaced message key in the form `<namespace>:<path>`, for example `my-module:backup.processing`. The text lives in the module's own language files (`messages/en.yml`, `messages/zh.yml`; see [Messages and Languages](/guide/essentials/messages)), where the namespace is the module's `plugin.yml` name in lower case, and the colour comes from that catalogue. Each player sees it in their own client language. An empty value uses the framework's `ultitools:command.async.processing` (`Processing...`). A value that is not a valid key logs one warning per executor and value and also uses the default:

```text
Invalid processingMessageKey on <executor class>: <value>; using the default processing message
```

```yaml
# src/main/resources/messages/en.yml of the module "my-module"
backup:
  processing: "<yellow>Backing up the world..."
```

::: info Processing notices as of v7.0.0
Replace the old processing-notice key with `<namespace>:<path>` and define the text and MiniMessage colour in `messages/<locale>.yml`; leave `showProcessing` unchanged.
An old key without a namespace falls back to the default notice.
:::

### Scheduling, timeout and unload <Badge type="tip" text="v7.0.0+" />

As of v7.0.0, command bodies are run by the framework's own `Scheduler` (see [Framework-scheduled work](/guide/advanced/scheduled-tasks#framework-scheduled-work)), not by the Bukkit scheduler, and no direct use of the Bukkit scheduler remains in the command package:

- **Bodies.** A `@RunAsync` or `@AsyncCommand` body runs on the framework scheduler's `async()` context, once. It is not an entity task, so a player leaving does not skip the body or its completion hooks (such as lock release). The failure reply (`command.error.execution_failed`) of an asynchronous body is sent from the worker thread that ran it.
- **Timeout watcher.** The timeout of `@AsyncCommand` is a watcher scheduled on the framework scheduler. The `command.async.timeout` notice is delivered in the player's `entity(player)` context, and to any other sender in the `global()` context. It is sent once, and the watcher is cancelled when the body finishes first. Reporting a timeout only stops waiting: the body is **not** interrupted and keeps running to completion.
- **Unload and server stop.** Before a module's resources are released, the framework waits for asynchronous command bodies that are still running, without interrupting them; new asynchronous submissions to an unloading executor are refused. The wait shares one deadline of about 10 seconds: a single module unload gives that module's executors one fresh allowance, and a whole server stop shares one allowance across all executors, the framework's own commands first and before any framework service is closed. Only time actually spent waiting is charged. When the allowance runs out, each executor that still has running bodies logs one warning and the unload continues:

```text
Async command unload wait expired for <executor class>: <n> invocation(s); work continues in the background
```

- **What a body must not rely on after that warning.** The body keeps running in the background after the module's resources are gone: do not touch the module's services, data, listeners or scheduler (a retired scheduler refuses new submissions with `RejectedExecutionException`), and do not block a body waiting for a `global()` or `entity()` callback, because the unloading thread cannot run that callback while it waits.
- **Watchdog.** On a running server the wait happens on the server thread, so a full wait coincides with Paper's default watchdog early warning (10 seconds) and prints a thread dump; it is not a crash. The command wait is independent of the UI storage wait, so the worst case is about 20 seconds. See [Live-unload waits](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#live-unload-waits-and-paper-watchdog-warnings) in `COMPATIBILITY.md`.

::: warning Known limitations
A `@CmdCD(5)` command can display 6 seconds of cooldown because a partly elapsed second is rounded up. An asynchronous body that is still running after the unload wait is not interrupted; it finishes on its own after the module's resources are gone, so write long bodies to stop on their own when their module is no longer enabled.
:::

## Custom Type Parsers <Badge type="tip" text="v6.2.0+" />

Type parsers convert command argument strings into the types your methods require. UltiTools provides built-in parsers for primitive types, Bukkit entities, and arrays.

### Built-in Parsers

As of v7.0.0, the built-in types are handled by native argument types instead of parsers; the list is in [Argument types](#argument-types). In 6.x the built-in parsers were:

- **Primitive types**: String, Integer, Double, Float, Long, Short, Byte, Boolean
- **Bukkit entities**: Player, OfflinePlayer, Material, World
- **Other types**: UUID, Location, GameMode, Enchantment
- **Arrays**: All types above support array syntax

As of v7.0.0, a registered `TypeParser` reads one token (a double-quoted value counts as one token) and is used for a type that has no native mapping. When `parse` throws `TypeParseException`, the sender sees its message. The parser must already be registered when the module's commands are compiled; otherwise the type has no mapping and the module is refused (see [Rejected formats](#rejected-formats)). An array of that type works in a `<name...>` parameter. Paper keeps the registered argument types, a module's custom parser included, so replacing a module JAR needs a restart.

### Creating Custom Parsers

Implement `TypeParser<T>`:

<<< @/../examples/src/main/java/com/ultikits/docs/command/ColorParser.java

Register the parser:

```java
@Autowired
private UltiToolsPlugin plugin;

@PostConstruct
public void init() {
    TypeParserRegistry.getInstance().register(new ColorParser());
}
```

Use in your command:

```java
@CmdMapping(format = "setcolor <color>")
public void setColor(@CmdSender Player player, @CmdParam("color") Color color) {
    // color is parsed automatically
}
```

Advanced parser with array support:

<<< @/../examples/src/main/java/com/ultikits/docs/command/RangeParser.java

```java
// Usage
@CmdMapping(format = "random <range>")
public void randomNumber(@CmdSender Player player,
                         @CmdParam("range") IntRange range) {
    int value = ThreadLocalRandom.current().nextInt(range.min, range.max + 1);
    player.sendMessage("Random: " + value);
}
```

## Vanilla Bukkit Command Executor Wrapper

::: danger Removed in v7.0.0
`AbstractCommand`, `AbstractPlayerCommandExecutor`, `AbstractTabExecutor` and `AbstractConsoleCommandExecutor` are removed in v7.0.0. This section describes 6.x; for 7.0, use `BaseCommandExecutor` with `@CmdTarget`, as in the blocks marked "As of v7.0.0" below.
:::

### Player Command

If you want a command to be executed only in the game (executed by the player), you can inherit the
`AbstractPlayerCommandExecutor` class and override the `onPlayerCommand` method.

<<< @/../examples/src/main/java/com/ultikits/docs/command/PlayerCommandExample.java

It receives the command, its arguments and the player; unlike `CommandExecutor#onCommand`, there is no alias (label) parameter.

As of v7.0.0, the same player-only command is a `BaseCommandExecutor` limited with `@CmdTarget`:

```java
@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(alias = {"mycmd"})
public class PlayerCommandExample extends BaseCommandExecutor {
    @CmdMapping(format = "")
    public void run(@CmdSender Player player) {
        // your code
    }

    @Override
    protected void handleHelp(CommandSender sender) {
        // send help message
    }
}
```

A console sender does not see this command in its tree; see [Visibility](#visibility).

If you try to execute this command in the console, you will receive an error
message: `This command can only be performed in GAME!`

If you want this command to use Tab completion, please see the next section.

### Command Completion

The Bukkit API provides the `TabCompleter` interface for command completion.

UltiTools has encapsulated this interface to provide a more concise way of command completion.

You need to inherit the `AbstractTabExecutor` class and override the `onPlayerTabComplete` method.

```java
@Override
protected List<String> onPlayerTabComplete(Command command, String[] strings, Player player) {
    // your code
    return null;
}
```

It receives the command, its arguments and the player; unlike `TabCompleter#onTabComplete`, there is no alias (label) parameter.

The rest of the usage is the same as the `AbstractPlayerCommandExecutor` class.

### Console Command

If you want a command to be executed only in the console, you can inherit the `AbstractConsoleCommandExecutor` class and
override the `onConsoleCommand` method.

<<< @/../examples/src/main/java/com/ultikits/docs/command/ConsoleCommandExample.java

It receives the sender, the command and its arguments; unlike `CommandExecutor#onCommand`, there is no alias (label) parameter.

As of v7.0.0, write the console-only command as a `BaseCommandExecutor` with `@CmdTarget(CmdTarget.CmdTargetType.CONSOLE)` on the class, in the same form as the player example above; completion for it is described in [Tab completion](#tab-completion).

If you try to execute this command in the game, you will receive an error
message: `This command can only be performed in CONSOLE!`

### Help Message

All three classes above inherit `sendHelpMessage` from `AbstractCommand`, where it is declared
`protected abstract`. It is **not** provided for you — every subclass has to implement it, which is why
both examples above override it:

```java
@Override
protected void sendHelpMessage(CommandSender sender) {
    // send help message
}
```

When sending the `/somecommand help` command, this method will be called.

### Error Message

You may find that the `onCommand` method of the three classes above returns a `boolean` type value.

It is the same as the native `CommandExecutor` interface, this value is used to indicate whether the command was
executed successfully.

When the command execution returns `false`, the command sender will be automatically prompted with an error message.
