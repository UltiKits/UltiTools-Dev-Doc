::: warning 🚧 This page is under construction

The translation of this page is not finished yet.

:::

# 命令执行器

在传统的 Bukkit 插件开发中，我们通常会使用 Bukkit 的 `CommandExecutor` 接口来处理命令。

但在某些情况下，我们需要判断命令的发送者是否为玩家，是否拥有某些权限，判断参数等等。

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

// 命令限制执行者为玩家和控制台
@CmdTarget(CmdTarget.CmdTargetType.BOTH)
@CmdExecutor(
    // 命令权限（可选）
    permission = "ultikits.example.all",
    // 命令描述（可选）
    description = "测试指令",
    // 命令别称
    alias = {"test","ts"},
    // 是否手动注册（可选）
    manualRegister = false,
    // 是否需要OP权限（可选）
    requireOp = false
)
public class ExampleCommand extends AbstractCommendExecutor {
    
  @Override
  protected void handleHelp(CommandSender sender) {
    // 向命令发送者发送帮助信息
  }
}
```

这样你就完成了一个空的什么都不做的命令执行器。这里的 `@CmdTarget` 和 `@CmdExecutor` 注解是代表了该命令的发送者类型和执行器信息。我们将在下一节详细介绍这两个注解。

## 注册命令

和spigot开发一样，有了执行器，就需要去注册它。我们可以在 `registerSelf` 方法中使用 `getCommandManager().register()` 方法来注册命令。

如果你的模块存在大量的命令执行器而不想手动注册，也可以使用 UltiTools 提供的自动注册功能，详情可以查看[这篇文章](/guide/advanced/auto-register)。

```java
import com.ultikits.plugin.ultikitsapiexample.context.ContextConfig;
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.ContextEntry;
import com.ultikits.ultitools.annotations.EnableAutoRegister;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

    // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
    // 在这里请不要主动使用无参数的构造函数
    public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
        super(name, version, authors, depend, loadPriority, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
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

## 基于映射的命令执行器

### 快速上手

假如你的插件拥有一个设置传送点的功能，你希望玩家输入一个带有传送点名称和坐标（可选）的命令，以此来设立一个传送点。

那么这个命令应该会长这样：`/point add name`

如果是使用传统的方法，你需要判断参数输入的合法性，发送者以及权限等，如果还有其他功能，你还需要编写一大堆的 `switch ... case` 和 `if ... else` 语句，疯狂嵌套。
使得代码可读性变差，提高了维护的难度。~~（还容易烧干你的脑子）~~

使用这个方法，你只需要编写最主要的逻辑即可，剩下的交给 UltiTools。

首先你需要创建一个继承了 `AbstractCommandExecutor` 的执行器类。

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

至此，你只需要和传统方式一样注册命令执行器即可完成所有工作。

### 参数Tab提示补全

每次写完一个命令之后希望给自己的命令添加Tab提示补全，但是又不想写一大堆的代码？

为Tab补全绞尽脑汁判断每个命令的长度和之前的参数来生成一个补全List，这非常容易把人累死。

现在你只需要简单的为每一个参数写一个方法返回补全List即可！这个方法可以被反复利用，所有繁杂的参数数量判断都交给 UltiTools 来完成。

你所需要做的只是在 `@CmdParam` 注解中添加 `suggest` 属性，指定一个方法名即可。


```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, @CmdParam(value = "name", suggest="listName") String name) {
  ...
}

public List<String> listName(Player player, Command command, String[] args) {
  ...
}
```

UltiTools会首先在当前类中搜索匹配的方法名，并尝试调用此方法。

你的方法可以包含最多三个参数，分别对应的类型是 `Player`， `Command` 和 `String[]`，你可以选择任意的参数数量和顺序，但是类型只能是这三种，每种类型一个参数。

`Player` 代表了发送此命令的玩家，`Command` 代表了当前的命令，`String[]` 代表了当前命令的参数。

你的方法需要返回一个 `List<String>` 类型的值，UltiTools 将会将此值作为补全列表返回给玩家。

::: tip

如果你仅仅只是想返回一个简单的提示字符串，那么你只需要在 `suggest` 字段中写上你想要的字符串即可。这里的字符串也支持i18n国际化。

```java
@CmdMapping(format = "add <name>")
public void addPoint(@CmdSender Player player, 
                     @CmdParam(value = "name", suggest="[名称]") String name) {
  ...
}

```
:::

::: tip

如果你对UltiTools生成的补全列表不满意，你可以重写 `suggest` 方法，自己生成补全列表。

```java
@Override
protected List<String> suggest(Player player, Command command, String[] strings) {
    ...
}
```
:::

#### @CmdSuggest 注解

如果你希望你的这个补全方法与其他命令类共享，那么你可以创建一个类，将想要复用的方法写在此类下。

在需要使用此类中的方法的类上添加 `@CmdSuggest` 注解，指定此类的类名即可。

```java
@CmdSuggest({PointSuggest.class})
public class PointCommand extends AbstractCommandExecutor {
    
    @CmdMapping(format = "add <name>")
    public void addPoint(@CmdSender Player player, @CmdParam(value = "name", suggest="listName") String name) {
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

### 权限

#### 方法权限

如果你需要为某一个方法指定权限，你只需要在 `@CmdMapping` 添加 `permission` 属性即可

```java
@CmdMapping(..., permission = "point.set.add")
```

::: tip
如果在 `@CmdExecutor` 定义了权限，那么命令发送者仅需拥有 `@CmdExecutor` 指定的权限即可。
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

::: tip
如果在 `@CmdExecutor` 定义了权限，那么命令发送者仅需拥有 `@CmdExecutor` 指定的权限即可。
:::

### 限定发送者

如果你希望为全部方法指定发送者，你只需要在你的类前面添加 `@CmdTarget` 注解即可。

如果为某一个方法，则在该方法前面添加即可。

```java
@CmdTarget(CmdTarget.CmdTargetType.BOTH)
```

::: tip
如果在类和方法都指定了发送者，则需要同时满足。
:::

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

由于 Bukkit API 不允许被异步调用，因此如果你需要调用 Bukkit API，你需要新建一个同步执行的Task：

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

### 命令冷却

如果你不希望一个指令被大量执行而消耗服务器资源，那么你可以在相应的方法前面添加 `@CmdCD`:

```java
@CmdCD(60)
```

参数类型为整数，单位为秒。

冷却结束之前执行该指令将会发送消息：`操作频繁，请稍后再试`

此限制仅对**玩家**生效。

### 执行锁

如果你希望一个命令只能被一条一条地执行，那么可以在相应的方法前面添加 `@UsageLimit` 注解：

```java
@UsageLimit(ContainConsole = false, value = LimitType.SENDER)
```
其中 `ContainConsole` 为是否将限制应用于控制台，`value` 为限制类型。

可用的类型有：

- `LimitType.SENDER` 限制每个发送者每次只能有一条该指令在执行
- `LimitType.ALL` 限制全服只能有一条该指令在执行
- `LimitType.NONE` 不作限制

在 `LimitType.SENDER` 策略下，玩家在上一条该指令执行完毕之前重复执行前将会收到提示：`请先等待上一条命令执行完毕！`

在 `LimitType.ALL` 策略下，玩家在服内上一条该指令执行完毕之前重复执行前将会收到提示：`请先等待其他玩家发送的命令执行完毕！`

## 传统命令执行器

### 游戏内命令

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

### 命令补全

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

### 控制台指令

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

### 指令帮助

上述三个类都提供了一个 `sendHelpMessage` 方法，用于向玩家或控制台发送帮助信息。

```java
sendHelpMessage(CommandSender sender) {
    // 你的代码,向玩家发送信息
}
```

当发送 `/somecommand help` 指令时，将会调用该方法。

### 错误处理

你可能会发现，上述三个类的 onCommand 方法都返回了一个 `boolean` 类型的值。

与原生的 `CommandExecutor` 接口相同，该值用于表示命令是否执行成功。

当命令执行返回 `false` 时，将自动向命令发送者提示信息。
