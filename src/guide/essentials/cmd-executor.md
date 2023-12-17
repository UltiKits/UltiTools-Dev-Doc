# 命令执行器

在传统的 Bukkit 插件开发中，我们通常会使用 Bukkit 的 `CommandExecutor` 接口来处理命令。
但在某些情况下，我们需要判断命令的发送者是否为玩家，是否拥有某些权限。
如果一个插件存在多个命令，那么这些判断逻辑就会重复出现在每个命令的处理方法中，这样的代码是非常冗余的。

除此之外，我们也可能还需要处理命令错误，输出帮助信息等等。

UltiTools 对原生的 `CommandExecutor` 接口进行了封装，提供了一个更加简洁的命令处理方式。

## 创建命令执行器

你只需要继承 `AbstractCommandExecutor` 类，并重写 `handleHelp` 方法。这里的 `@CmdTarget` 和 `@CmdExecutor` 注解是代表了该命令的目标类型和执行器信息。

```java
import com.ultikits.ultitools.abstracts.AbstractCommendExecutor;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdTarget;
import org.bukkit.command.CommandSender;

@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(
  permission = "ultikits.example.all",
  description = "测试指令",
  alias = {"test","ts"}
)
public class ExampleCommand extends AbstractCommendExecutor {
    
  @Override
  protected void handleHelp(CommandSender sender) {
    sender.sendMessage("=== 测试指令 ===\n" +
      "/test 测试指令\n" +
      "/ts 测试指令\n" +
      "===========");
  }
}
```

## 注册命令

注册命令十分简单，下面是一个示例：

```java
getCommandManager().register(
  new TestCommands(),    //命令执行器
  "permission.test",     //命令权限
  "示例功能",             //命令描述
  "test"                 //命令
);
```
## 游戏内命令

如果你希望一个指令只能在游戏内使用（由玩家执行），那么可以继承 `AbstractPlayerCommandExecutor` 类，并重写 `onPlayerCommand` 方法。

```java
public class SomeCommands extends AbstractPlayerCommandExecutor {
    @Override
    protected boolean onPlayerCommand(Command command, String[] strings, Player player) {
        // 你的代码
        return true;
    }
}
```

除 `Player` 类型的参数外，该方法与 `CommandExecutor#onCommand` 方法相同。

如果尝试在控制台执行该命令，将会收到一条错误消息：`只有游戏内可以执行这个指令！`

如果你希望该指令能够使用 Tab 补全，请看下一节。

## 命令补全

自Minecraft 1.13起，Bukkit API提供了一个新的 `TabCompleter` 接口，用于处理命令补全。

UltiTools 对该接口进行了封装，提供了一个更加简洁的命令补全方式。

你只需要继承 `AbstractTabExecutor` 类，并重写 `onTabComplete` 方法。

```java
@Override
protected List<String> onPlayerTabComplete(Command command, String[] strings, Player player) {
    // 你的代码
    return null;
}
```

除 `Player` 类型的参数外，该方法与 `TabCompleter#onTabComplete` 方法相同。

其余的用法与 `AbstractPlayerCommandExecutor` 类相同。

## 控制台指令

如果你希望一个指令只能在控制台使用，那么可以继承 `AbstractConsoleCommandExecutor` 类，并重写 `onConsoleCommand` 方法。

```java
public class SomeCommands extends AbstractConsoleCommandExecutor {
    @Override
    protected boolean onConsoleCommand(CommandSender commandSender, Command command, String[] strings) {
        // 你的代码
        return true;
    }
}
```

该方法与 `CommandExecutor#onCommand` 方法相同。

如果尝试在游戏内执行该命令，将会收到一条错误消息：`只可以在后台执行这个指令！`

## 指令帮助

上述三个类都提供了一个 `sendHelpMessage` 方法，用于向玩家或控制台发送帮助信息。

```java
sendHelpMessage(CommandSender sender) {
    // 你的代码,向玩家发送信息
}
```

当发送 `/somecommand help` 指令时，将会调用该方法。

## 错误处理

你可能会发现，上述三个类的 onCommand 方法都返回了一个 `boolean` 类型的值。

与原生的 `CommandExecutor` 接口相同，该值用于表示命令是否执行成功。

当命令执行返回 `false` 时，将自动向命令发送者提示信息。
