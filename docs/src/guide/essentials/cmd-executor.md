# Command Executor

UltiTools-API 7.0.0 has not been released. This page describes command behavior as of v7.0.0. For the old Bukkit wrappers, see the [archived 6.4.0 guide](/v6.4.0/guide/essentials/cmd-executor.html).

## Basic usage

Extend `BaseCommandExecutor`, declare the command with `@CmdExecutor`, and implement `handleHelp(CommandSender)`. A `@CmdMapping` method receives arguments already converted to the declared types; it does not implement Bukkit's `onCommand`.

<<< @/../examples/src/main/java/com/ultikits/docs/command/ExampleCommand.java

For example, the following mapping inside a `@CmdExecutor(alias = {"point"})` class implements `/point add <name>`. The method-level target ensures that the `Player` parameter is available even if the class allows non-player senders:

```java
@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdMapping(format = "add <name>", permission = "point.add")
public void addPoint(@CmdSender Player player, @CmdParam("name") String name) {
    player.sendMessage("Point: " + name);
}
```

### Annotation reference

| Annotation | Attributes and defaults |
|---|---|
| `@CmdExecutor` (class) | `alias` is required and must contain at least one label. The first is the primary label; the rest are aliases. `permission` and `description` default to `""`; `requireOp` and `manualRegister` default to `false`. |
| `@CmdMapping` (method) | `format` is required; `""` maps the bare root. `permission` defaults to `""` and `requireOp` to `false`. |
| `@CmdParam` (parameter) | `value` is the required argument name in `format`. `suggest` defaults to `""`. |
| `@CmdSender` (parameter) | No attributes. Injects the sender if its type matches, otherwise `null`. An unannotated `CommandSender` subtype can also receive the sender; parameter type alone does not limit who can invoke the method. |
| `@CmdTarget` (class or method) | Required `value`: `PLAYER`, `CONSOLE` (any non-player sender), or `BOTH`. If absent at class level, the effective default is `BOTH`; a method without its own restriction uses the class target. |
| `@CmdSuggest` | Required `value` array of provider classes. Put it on the executor class: the completion lookup reads it there, not on the mapped method. |
| `@CmdCD` (class or method) | `value` defaults to `0` seconds, `key` to `""`, `config` to `AbstractConfigEntity.class`. |
| `@UsageLimit` (class or method) | Required `value`: `SENDER`, `ALL`, or `NONE`. `ContainConsole` defaults to `true`. |
| `@RunAsync` (method) | No attributes. |
| `@AsyncCommand` (method) | `showProcessing = true`, `processingMessageKey = ""`, `timeout = 30` seconds by default. |

## Command engine

### Registration and ownership

The framework compiles literal and typed argument nodes from the annotations and hands the tree to Paper during `LifecycleEvents.COMMANDS`. It does not create `PluginCommand` by reflection or edit Bukkit's private command map.

- A module's scanned executor beans register automatically unless `manualRegister = true`. For a manually managed executor, keep it in the module container and use `getCommandManager().register(this, ExampleCommand.class)` in the module's `registerSelf()`; set `manualRegister = true` on that executor. The manager retrieves the bean from the container. An executor without `@CmdExecutor` is not registered.
- For an [external Paper plugin](/guide/advanced/external-plugin-api), call `UltiToolsAPI.connect(this)` in `JavaPlugin.onEnable()`, with the dependency declared so UltiTools is already enabled. The connection registers eligible beans for the same Paper event, including the initial event in normal startup. Do not declare these annotation commands under `commands` in the external plugin's `plugin.yml` or use the module-only manual registration method.
- Either owner can supply a container bean implementing `com.ultikits.ultitools.command.BrigadierCommand`. Implement `node()` to return a `LiteralCommandNode<CommandSourceStack>`; it is called once per registration. `aliases()` and nullable `description()` are optional. Beans are deduplicated by identity. Supply your own access checks and completion: handwritten trees do not receive annotation validators, cooldowns or `@CmdParam` completion. Redirect targets outside the supplied tree are not controlled by unload and do not rebind with a replacement; use the next commands event or restart to refresh them.

For a module, a description path can resolve through its message catalogue at registration; otherwise the description is used as written. An external executor's description is used as written. The [external plugin message API](/guide/advanced/external-plugin-api) does not make external descriptions or automatic completion hints resolve through an external catalogue.

### Registration after start-up

Paper has already received the tree shape after the initial commands event. Unregistering the owner hides its tree and blocks execution. A genuinely registered replacement with the same signature can rebind the existing shape. A new root or a replacement with a different signature waits for `/minecraft:reload` or a restart:

```text
Command /<label> from <owner> was registered after start-up; it becomes available after /minecraft:reload or a restart.
```

If another UltiTools owner already claims the same root or alias, that binding is rejected without blocking the owner's other commands. If the Paper registrar does not register a requested label, the framework logs a separate warning:

```text
Command /<label> from <owner> (<executor class>) conflicts with <previous owner> (<previous class>); rejected.
Command label /<label> from <owner> was not registered by Paper (label occupied).
```

`/minecraft:reload` reloads data packs and fires another commands event. `/ul reload` does not recreate executors, rebind trees, or apply changes to conditional command registration; those changes require a restart. The framework does not trigger a data-pack reload automatically. Installing or updating a module JAR still requires a restart: Paper retains argument-type instances, including those holding a custom parser. Bukkit's plugin `/reload` and hot reload are not supported.

### Rejected formats {#rejected-formats}

Compilation refuses duplicate normalized paths (including duplicate formats in the same class), competing parameter names or types under one parent, a literal and argument with the same node name, unmatched `@CmdParam` names or placeholders, unsupported types, and non-terminal or invalid `<name...>` arguments. A literal and an argument with different node names may share a parent. A subclass may replace an inherited mapping. A mapping cannot occupy the same executable path as an omitted greedy tail.

A compilation failure rolls back the failing module or external connection, not other owners' commands. The format diagnostic is logged at SEVERE; examples of reasons are `competing parameter with <method>`, `duplicate path with <method>` and `greedy parameter must be last`:

```text
Cannot load module <module>: executor <class>: <class>#<method> [<format>]: <reason>. Change @CmdMapping formats to use distinct literal prefixes, one parameter name/type per position, terminal <name...> arrays, and registered custom type parsers.
```

### Migrating from 6.x {#migrating-from-6-x}

Rebuild against 7.0 and follow the [upgrade guide](/guide/advanced/upgrading-to-7); changing `api-version` alone is insufficient.

| 6.x API | 7.0 replacement |
|---|---|
| Bukkit `TabExecutor`, `onCommand`, `onTabComplete`; `matchMethod`, `parseParameters`, `validateParameterCount`, `parseParameterValue` | Typed mappings on `BaseCommandExecutor`; no replacement string matcher. |
| `AbstractCommand`, `AbstractTabExecutor`, `AbstractPlayerCommandExecutor`, `AbstractConsoleCommandExecutor` | `BaseCommandExecutor` with `@CmdTarget`, or `BrigadierCommand`. |
| `suggest(Player, Command, String[])`, `suggest(CommandSender, Command, String[])` | `suggest(CommandSender, String, String[])`. |
| `CommandContext.getCommand()` and builder `command(...)` | `getCommandName()` and `commandName(String)`; `getParsedParams()` now returns `Map<String, Object>`, and `getParam` and `getParamValue` return `Object`. |
| `CommandManager.register` taking `Class<? extends CommandExecutor>`; `registerCoreCommand(CommandExecutor)` | `Class<? extends BaseCommandExecutor>`; `registerCoreCommand(BaseCommandExecutor)`. |
| `unregister(String)`; `getPluginByCommand(Command)` | Release commands with the owning module or external plugin; `getPluginByLabel(String)` queries module ownership by primary, alias or namespaced spelling (returns `null` for core or external commands). |
| `CommandTabCompletionDispatch`; `TabCompletionManager.suggest(Player, Command, String[])`, `createContext(Player, Command, String[])`, `suggestFirstArgs` | Brigadier supplies literals; use context-based provider calls. `TabCompletionContext.getCommand()` becomes `getCommandName()`. No candidates means an empty result, including for console or RCON. |
| `WorldParser`, `GameModeParser`, `LocationParser`, `EnchantmentParser`, implicit built-in registry entries | Native argument mappings; register a custom `TypeParser` explicitly only for otherwise unmapped types. |

`getMappings`, `handleHelp`, `getHelpCommand`, `createDefaultValidatorChain`, `executeCommand` and `buildMethodParams` remain. See the framework's [compatibility policy](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#command-engine-as-of-700).

## Arguments

Separate format parts with whitespace. Literal parts are case-insensitive, including after an argument, and have priority over arguments at the same position. The framework can retry the dispatch once using canonical literals; it does not lowercase argument values. For example, `/trade ACCEPT` matches `accept` beside `<name>`, while `/trade "Accept"` passes `Accept` to a `String` argument.

| Java type | Input and value |
|---|---|
| `String` | One whitespace-delimited token, including non-ASCII text; double quotes group a value such as `"a b"`. An unterminated quote does not parse. |
| `int`, `long`, `float`, `double`, `boolean` and their boxed types | Brigadier's corresponding argument types. Boolean accepts only `true` and `false`, not 6.x's silent conversion of `yes` to `false`. |
| `short`, `byte` and their boxed types | Integer argument constrained to the Java type's range. |
| `Player` | Paper player selector resolved for the source. A missing player is refused rather than passed as `null` as in 6.5.0. |
| `OfflinePlayer` | Player-name token resolved by Bukkit; suggests online names. |
| `World`, `GameMode`, `UUID`, `Enchantment` | Paper world, game-mode, UUID and enchantment registry arguments. |
| `Material` | Lowercase resource key such as `minecraft:diamond`, not `DIAMOND`. |
| `Location` | Paper fine position `x y z` in the source's world, including relative coordinates; not `world,x,y,z`. |
| Other types with a registered `TypeParser` | One token, optionally double-quoted, parsed by that parser. |

Use `<name...>` only at the end, for `String` (the remaining text) or an array (`String[]` splits on whitespace; other arrays parse each element using its type mapping). Omission supplies `""` or an empty array. A plain `<name>` cannot represent an array.

### Custom type parsers

Implement `TypeParser<T>` and call `TypeParserRegistry.getInstance().register(new ColorParser())` before compiling commands that use it (for automatic module registration, `registerSelf()` runs first). Use `@CmdParam("color") Color color` with a `<color>` placeholder. Use `<colors...>` with `Color[]` to parse a tail element by element; the tree does not call your `parseArray` override.

<<< @/../examples/src/main/java/com/ultikits/docs/command/ColorParser.java

The following parser accepts a range such as `1-100`; register it the same way before using a `<range>` placeholder with an `IntRange` parameter:

<<< @/../examples/src/main/java/com/ultikits/docs/command/RangeParser.java

## Tab completion

Brigadier supplies literal suggestions. For an argument node, the framework merges explicit providers (`@CmdParam(suggest = ...)`) from accessible mappings that use it. Only when none of those mappings supplies a provider does `protected List<String> suggest(CommandSender sender, String label, String[] args)` receive the typed label and arguments, including the partial token. Return `null` for native suggestions, a list to replace them, or an empty list for no candidates.

- `@players`, `@worlds`, `@materials` (also `@blocks` and `@items`) and `@boolean` (also `@toggle`) are built-in provider keys. Register a custom key with `TabCompletionManager.register(String, TabCompleter)` before the command contract is validated. Unknown `@key` values cause load to fail. `TabCompletionContext.getSender()` returns the requester; `getPlayer()` returns `null` for non-players.
- For a method provider, use its name in `suggest`. Return `List<String>` and use exactly one of `()`, `(String)`, `(Player)`, `(Player, String)`, `(Player, Command, String[])`, `(CommandSender)`, `(CommandSender, String)`, or `(CommandSender, Command, String[])`. `String` is the partial token, `Command` is looked up in the public command map by label, and `String[]` contains the arguments. Player-only providers are skipped for non-player requests. Unsupported parameter signatures are refused at load.
- Method lookup starts on the executor. Modules can share providers by listing module container beans in class-level `@CmdSuggest({PointSuggest.class})`. For external executors, keep method providers on the executor itself; the shared-provider bean lookup is module-only.
- If no method matches, a module can use a [module message path](/guide/essentials/messages#module-annotation-text) as the hint; a missing or invalid path uses the literal value. For an external executor, this missing-method branch supplies no hint, even if the plugin has its own catalogue.

## Access and feedback

Class and mapping permissions are both required when set; `requireOp = true` at either level also requires OP. Method `@CmdTarget` can repeat or narrow the class target, never widen it or switch between `PLAYER` and `CONSOLE`. This applies to inherited mappings too.

<<< @/../examples/src/main/java/com/ultikits/docs/command/PlayerOnlyCommand.java

### Visibility

Root requirements hide inaccessible commands, and mapping requirements hide exclusive paths; shared prefixes remain visible. The framework filters usage lines and parameter-provider calls without running stateful validators for completion. If a real suggesting argument shares a parent with a hidden literal, the server dispatcher may still merge that sibling literal into a completion response. Avoid that layout if the name must stay secret. Seeing a name does not grant execution access.

On a usable root, manually typing an unavailable subcommand normally follows the same reply path as an unknown one, including when Brigadier rejects an exact-case hidden literal before invoking a callback. One exception for name secrecy is a root-level catch-all beside a gated literal: typing the hidden name gets unknown-command and gated help, with neither mapping run; other words still reach the catch-all. If the root itself is inaccessible, do not expect the framework's permission or sender-type reply. A live permission change does not refresh the client tree automatically; reconnect or run `/minecraft:reload`. Execution checks access live.

### Framework replies

The framework adds a greedy fallback at non-greedy nodes, named `args` (`args_` or more underscores if needed), without asking the server for suggestions there. The fallback can make invalid input appear valid to the client; it does not accept invalid input as a successful mapping. When the input reaches framework recovery:

- An unmatched first token gives `command.reply.unknown` and calls gated help. Failure deeper in the tree can give `command.reply.usage` for the accessible mappings below the deepest matched node. For example, `abc` in place of an `int` after a subcommand gets usage, not a custom parser error. A missing player selector result can also reach the usage path.
- A `TypeParseException` from a custom argument parser gives `command.reply.argument_error` with its untranslated detail on the custom parser reply path. Where the reply receives a native translatable component, it preserves the component. Neither rule guarantees recovery from all native syntax errors: Paper can reject input before a framework callback runs.
- Recovery normalizes repeated or trailing whitespace when reached, preserving quoted and greedy argument content. A native literal with exactly one trailing space (for example `ul reload `) can fail before the callback; trim console or panel input before dispatch.

The `<label>` in framework replies is the primary root. The help literal defaults to `help` (`getHelpCommand()`); the default help path, including the bare root when no mapping handles it, is subject to root requirements and runs the applicable sender-type and permission validators present in the chain before calling `handleHelp`. It does not run the cooldown or execution-lock validators.

### Reply language and message keys

With `language: auto`, framework feedback uses the player's client language; non-player senders such as the console, command blocks, and panel sender use `fallback-language`. The table gives the bundled text of the thirteen `ultitools:` keys. Override them in `plugins/UltiTools/messages/<locale>.yml` with dotted or nested YAML keys and MiniMessage values. A full `/ul reload` re-reads framework catalogue overrides. Inserted text, such as `<words...>` in a format, is not interpreted as MiniMessage; cooldown seconds are ungrouped integers. Module help and replies written by your handler remain yours.

| Key | English | Chinese |
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

The default unknown and argument-error replies are red. The usage prefix is yellow and the command format is grey. Access checks on the tree can stop a dispatch before the validators emit their denial messages.

## Validation, cooldown and execution locks

`CommandContext` supplies the sender, the primary command name (`getCommandName()`), the typed label (`getAlias()`), raw arguments (`getRawArgs()`), and the matched method and format. Read typed arguments from `getParsedParams()` or `getParam(name)`; `getParamValue(name)` returns the first element for an array. Use this typed result instead of re-parsing `getRawArgs()`.

After resolving arguments, the framework runs validators in ascending `getOrder()` order. The defaults are `SenderTypeValidator` (100), `PermissionValidator` (200), `UsageLockValidator` (250) and `CooldownValidator` (300). A custom validator defaults to `0`. Use `addValidator(...)` to keep the default chain. `super(chain)` replaces the defaults but does not bypass the command tree's requirements. A declared `@CmdCD` or active `@UsageLimit` without the corresponding validator is refused at load.

<<< @/../examples/src/main/java/com/ultikits/docs/command/WorldRestrictionValidator.java

In a class annotated with `@CmdExecutor(alias = {"worldcheck"})`, register the validator in the constructor:

```java
public WorldCheckCommand() {
    addValidator(new WorldRestrictionValidator("world", "world_nether"));
}
```

Here the class is `WorldCheckCommand`. To supply your own chain, build it with `ValidatorChain.builder().add(...).build()` and pass it to `super(...)`. Keep `PermissionValidator` and `SenderTypeValidator` if you rely on those annotations at execution time; a shared node in the tree is not a substitute for validating the selected mapping. If your validator acquires resources, release them in `onComplete` after the body and in `onRefused` if dispatch fails after your validator passes.

`ValidationResult.failure(Text, String)` accepts deferred text and a diagnostic code. Read `getErrorText()` first; for a text-backed failure `getErrorMessage()` is `null`. Use `getErrorMessage()` for the existing `failure(String)` and `failure(String, String)` factories. The chain exposes the first failure. A custom string failure goes out unchanged, without catalogue translation.

### Cooldown and execution lock

`@CmdCD(60)` applies a 60-second player cooldown per executor instance and mapping. A method annotation takes priority over a class default (including a base class default for mappings declared there). A body that throws still starts its cooldown; a rejection before the body runs does not. The displayed remaining time is the number of whole seconds left plus one, so `@CmdCD(5)` can display 6 seconds. To query the default validator for a mapping, use `getCooldownValidator().getRemainingCooldown(playerId, this, method.toString())`; if replacing the chain, query the validator actually present in it.

`@UsageLimit(UsageLimit.LimitType.SENDER)` locks a mapping per player. `ALL` uses one lock per mapping across players; with `ContainConsole = true`, non-player senders are blocked while a player holds it, but cannot acquire it. Non-player senders never acquire a `SENDER` lock either. `NONE` disables the limit; `ContainConsole = false` exempts non-player senders. A method-level annotation overrides the class default. The lock is acquired without waiting, released when the body finishes (even if it throws), and released if a later validation step refuses the invocation. A nested dispatch of the same mapping can therefore be refused while the outer invocation still holds the lock. On unload, shared built-in validator state is retained until its last executor releases it.

### Binding the cooldown to a config key {#binding-the-cooldown-to-a-config-key}

For a module, set `config` to the config entity class and `key` to its `@ConfigEntry` path (or the field name if the path is empty). Leave `value` unset and put the default on the config field:

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownConfig.java

<<< @/../examples/src/main/java/com/ultikits/docs/command/BoundCooldownCommand.java

Register the file-backed config exactly once. A missing key, conflicting literal value, non-`int`/`long` field (boxed forms are accepted), or value outside `0..Integer.MAX_VALUE` (including `null`) refuses the binding at load. Directory entities and external executors cannot use this binding. `0` disables new cooldowns; a non-positive literal also disables them.

With `/ul reload`, a valid new value applies to future cooldowns, not ones already running. An invalid binding update keeps the running value, logs a warning and reports a partial reload. An out-of-range panel write is refused. Avoid adding `@Range` to the same field: its validation can fail the config reload itself. See [config-bound scheduling](/guide/advanced/scheduled-tasks#config-bound-timing) for the equivalent timing pattern.

## Execution threads and unload

Without an async annotation, a body runs inline on the global tick thread, or is submitted to `global().run(...)` if invoked from another thread. Inline execution can block the server, and a nested synchronous dispatch can run before the outer invocation returns. If a GUI click callback dispatches a command that opens or closes an inventory, defer the dispatch out of the click event. With the panel's capturing sender, replies sent before dispatch returns can appear in the command result; later replies go to the console log stream. See [Panel integration](/guide/advanced/panel-integration#remote-command-results).

`@RunAsync` and `@AsyncCommand` use the framework-owned `Scheduler.async()` for the body, not the module scheduler or a player entity task. Use the worker for CPU or I/O work; send world, entity, block, chunk and inventory access back to the appropriate [scheduler context](/guide/advanced/scheduled-tasks#scheduler-api), such as `scheduler.entity(player).run(...)` using the module's injected `Scheduler`. A player leaving does not skip the accepted body or its completion hooks. A body failure can send feedback from the worker thread.

`@AsyncCommand` can display a processing message. `processingMessageKey` uses `<namespace>:<path>` (for example, `my-module:backup.processing`), with color from that catalogue. An empty or invalid value uses `ultitools:command.async.processing`; an invalid value logs once per executor and value:

```text
Invalid processingMessageKey on <executor class>: <value>; using the default processing message
```

A non-positive `timeout` disables the watcher. Otherwise it reports once, via `entity(player)` for a player or `global()` for another sender, and is cancelled if the body finishes first. Timeout does not cancel or interrupt the body. Before unload, new async submissions to the unloading executor are refused, and accepted bodies and their completion hooks have a shared wait allowance of about ten seconds. A single module unload gets its own allowance; shutdown shares one across all executors, starting with framework commands before services close. Only time actually spent waiting counts. When the allowance expires, unloading continues and an executor with pending work logs:

```text
Async command unload wait expired for <executor class>: <n> invocation(s); work continues in the background
```

Do not wait from the body for a global or entity callback while unload waits on the tick thread. Work still running after unload must not depend on resources that have been released; submitting work after scheduler retirement may be refused. The command allowance is independent of the UI storage allowance. See [live-unload waits and Paper watchdog warnings](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#live-unload-waits-and-paper-watchdog-warnings).

## Command tests

To test registration and dispatch without a server, capture the `LifecycleEvents.COMMANDS` handler, pass it a test registrar, and run the received tree with a Brigadier dispatcher. Directly adding a tree to Brigadier tests parsing and callbacks, but does not verify Paper registration timing, client command-tree filtering, or Paper's syntax-event recovery. Verify those behaviors on Paper separately.
