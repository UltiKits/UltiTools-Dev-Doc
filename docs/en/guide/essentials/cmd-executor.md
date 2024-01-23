# Command Executor

In traditional Bukkit plugin development, we usually use the `CommandExecutor` interface of Bukkit to handle commands.

However, in some cases, we need to determine whether the sender of the command is a player, whether it has certain
permissions, and determine the parameters, etc.

If a plugin has multiple commands, then these judgment logic will be repeated in the processing method of each command,
such code is very redundant.

In addition, we may also need to handle command errors, output help information, etc.

UltiTools-API offers a more concise way to handle commands by encapsulating the native `CommandExecutor` interface.

## Create a command executor

You only need to inherit the `AbstractCommandExecutor` class and override the `handleHelp` method. The `@CmdTarget`
and `@CmdExecutor` annotations here represent the target type and executor information of the command.

```java
import com.ultikits.ultitools.abstracts.AbstractCommendExecutor;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdTarget;
import org.bukkit.command.CommandSender;

// Command limits executor
@CmdTarget(CmdTarget.CmdTargetType.BOTH)
@CmdExecutor(
        // Command permission (optional)
        permission = "ultikits.example.all",
        // Command description (optional)
        description = "测试指令",
        // Command alias
        alias = {"test", "ts"},
        // Whether to register manually (optional)
        manualRegister = false,
        // Whether to require OP permission (optional)
        requireOp = false
)
public class ExampleCommand extends AbstractCommendExecutor {

    @Override
    protected void handleHelp(CommandSender sender) {
        // Send help message to command sender
    }
}
```

You have completed an empty command executor that does nothing! The `@CmdTarget` and `@CmdExecutor` annotations here
represent the sender type and executor information of the command. We will introduce these two annotations in detail in
the next section.

## Register command

The same as spigot development, with the executor, you need to register it. We can use
the `getCommandManager().register()` method to register the command in the `registerSelf` method.

If your module has a large number of command executors and you don't want to register them manually, you can also use
the automatic registration provided by UltiTools, for details, please refer
to [this article](/en/guide/advanced/auto-register).

```java
import com.ultikits.plugin.ultikitsapiexample.context.ContextConfig;
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.ContextEntry;
import com.ultikits.ultitools.annotations.EnableAutoRegister;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

    public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
        super(name, version, authors, depend, loadPriority, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        // register command
        getCommandManager().register(this, ExampleCommand.class);
        return true;
    }

    @Override
    public void unregisterSelf() {

    }

    @Override
    public void reloadSelf() {
        super.reloadSelf();
    }
}

```

## Mapping-based command executor

### Quick start

Assuming that your plugin has a function to set the teleport point, you want the player to enter a command with the
teleport point name, so as to set up a teleport point.

Then this command should look like this: `/point add name`

If you use the traditional method, you need to judge the legality of the parameter input, the sender and permissions,
etc. If there are other functions, you also need to write a lot of `switch ... case` and `if ... else` statements, crazy
nesting.

However, with UltiTools, you only need to write the main logic, and the rest will be handled by UltiTools.

First, you need to create an executor class that inherits `AbstractCommandExecutor`.

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

Your method can contain up to three parameters, corresponding to the types `Player`, `Command` and `String[]`. You can
choose any amount or order of parameters, but the type can only be these three types, one parameter for each type.

`Player` represents the player who sent the command, `Command` represents the current command, and `String[]` represents
the current parameters of the current command.

Your method needs to return a value of type `List<String>`, and UltiTools will return this value as a completion list to
the player.

::: tip

If you just want to return a simple prompt string, then you only need to write the string you want in the `suggest`
field. The string here also supports internationalization.

```java

@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player,
                     @CmdParam(value = "name", suggest = "[name]") String name) {
  ...
}

```

:::

::: tip

If you are not satisfied with the completion list generated by UltiTools, you can override the `suggest` method to
generate the completion list yourself.

```java

@Override
protected List<String> suggest(Player player, Command command, String[] strings) {
    ...
}
```

:::

#### @CmdSuggest

If you want a completion method to be shared with other command classes, you can create a class and write methods which
you want to reuse in other class.

Add the `@CmdSuggest` annotation to the class which need to use suggestion method, and specify the suggestion class.

```java

@CmdSuggest({PointSuggest.class})
public class PointCommand extends AbstractCommandExecutor {

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

### Permission

#### Method permission

If you need to specify permissions for a method, you need to add the `permission` attribute in the `@CmdMapping`
annotation.

```java
@CmdMapping(..., permission = "point.set.add")
```

::: tip
The permissions specified in `@CmdExecutor` will override any permission set in `@CmdMapping`.
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

::: tip
If the sender is specified in both the class and the method, both must be met.
:::

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

Since the Bukkit API does not allow asynchronous calls, if you need to call the Bukkit API, you need to create a
synchronous task:

```java

@CmdMapping(format = "list")
@RunAsync
public void listPoint(@CmdSender Player player) {
    //do query
    new BukkitRunnable() {
        @Override
        public void run() {
            //call bukkit api
        }
    }.runTask(PluginMain.getInstance());
}
```

### Command cooldown

If you don't want a command to be executed in large quantities and consume server resources, then you can add
`@CmdCD` in front of the corresponding method:

```java
@CmdCD(60)
```

Parameter type is integer, in second.

If the command is executed before the cooldown ends, the message `Frequent operations, please try again later` will be
sent.

This restriction only takes effect on **players**.

### Execution lock

If you want a command to be executed only one by one, you can add `@UsageLimit` in front of the corresponding method:

```java
@UsageLimit(ContainConsole = false, value = LimitType.SENDER)
```

`ContainConsole` is whether the restriction is applied to the console, and `value` is the restriction type.

Available types are:

- `LimitType.SENDER` limits that each sender can only have one command of this type executed at a time
- `LimitType.ALL` limits that only one command of this type can be executed in the whole server
- `LimitType.NONE` no limit

Under the `LimitType.SENDER` strategy, the player will receive a prompt: `Please wait for last Command Processing!`

Under the `LimitType.ALL` strategy, the player will receive a
prompt: `Please wait for last Command Processing which sent by other players!`

## Vanilla Bukkit Command Executor Wrapper

### Player Command

If you want a command to be executed only in the game (executed by the player), you can inherit the
`AbstractPlayerCommandExecutor` class and override the `onPlayerCommand` method.

```java
public class SomeCommands extends AbstractPlayerCommandExecutor {
    @Override
    protected boolean onPlayerCommand(Command command, String[] strings, Player player) {
        // your code
        return true;
    }
}
```

Except for the `Player` type parameter, this method is the same as the `CommandExecutor#onCommand` method.

If you try to execute this command in the console, you will receive an error
message: `This command can only be performed in GAME!`

If you want this command to use Tab completion, please see the next section.

### Command Completion

From Minecraft 1.13, the Bukkit API provides a new `TabCompleter` interface for command completion.

UltiTools has encapsulated this interface to provide a more concise way of command completion.

You need to inherit the `AbstractTabExecutor` class and override the `onTabComplete` method.

```java

@Override
protected List<String> onPlayerTabComplete(Command command, String[] strings, Player player) {
    // your code
    return null;
}
```

Except for the `Player` type parameter, this method is the same as the `TabCompleter#onTabComplete` method.

The rest of the usage is the same as the `AbstractPlayerCommandExecutor` class.

### Console Command

If you want a command to be executed only in the console, you can inherit the `AbstractConsoleCommandExecutor` class and
override the `onConsoleCommand` method.

```java
public class SomeCommands extends AbstractConsoleCommandExecutor {
    @Override
    protected boolean onConsoleCommand(CommandSender commandSender, Command command, String[] strings) {
        // your code
        return true;
    }
}
```

This method is the same as the `CommandExecutor#onCommand` method.

If you try to execute this command in the game, you will receive an error
message: `This command can only be performed in CONSOLE!`

### Help Message

All three classes above provide a `sendHelpMessage` method for sending help messages to players or consoles.

```java
sendHelpMessage(CommandSender sender) {
    // send help message
}
```

When sending the `/somecommand help` command, this method will be called.

### Error Message

You may find that the `onCommand` method of the three classes above returns a `boolean` type value.

It is the same as the native `CommandExecutor` interface, this value is used to indicate whether the command was
executed successfully.

When the command execution returns `false`, the command sender will be automatically prompted with an error message.
