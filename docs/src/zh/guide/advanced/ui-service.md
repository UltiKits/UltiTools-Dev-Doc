# 界面：意图与会话

自 v7.0.0 起，模块通过框架的 `UiService`（包 `com.ultikits.ultitools.ui`）向玩家显示界面。模块把要显示或要询问的内容描述为一个意图（intent），服务选择能够显示它的后端，即 Paper 对话框或箱子物品栏，并返回一个 `UiSession`，其结果说明界面如何结束。[声明式 GUI](/zh/guide/advanced/declarative-gui) 的页面也建立在同一个服务之上。

::: warning 未发布的 v7.0.0 行为
本页描述尚未发布的 7.0.0 框架。6.x 没有 `UiService`，其界面是 [GUI 界面](/zh/guide/advanced/gui) 一页介绍的那些类。
:::

## 获取服务 {#obtaining-the-service}

按接口类型注入服务：

```java
@Service
public class ArenaScreens {
    @Autowired
    private Messages messages;
    @Autowired
    private UiService ui;
    @Autowired
    private Scheduler scheduler;
}
```

框架在组件扫描之前就把服务注册进模块的容器，因此它在任何 `@PostConstruct` 方法运行之前已经注入。模块主类与其扫描到的 bean 拿到的是同一个实例。

模块每个已加载的副本都有自己的服务。框架按模块实例而不是按模块名区分：同名的替换副本会拿到新的服务，卸载一个副本只结束该副本的界面。`owner()` 返回模块名，仅用于诊断。`UiService` 的方法都可以在任意线程调用，只有 `container(...)` 必须在服务器线程调用。

## 意图 {#intents}

意图是对一个界面的不可变描述。`UiIntent<R>` 是密封接口，允许五种类型：

| 意图 | 界面 | 结果类型 `R` | `Completed` 的值 |
| --- | --- | --- | --- |
| `Notice` | 对话框 | `Ack` | 玩家按下按钮时为 `Ack.ACK` |
| `Confirm` | 对话框 | `Boolean` | 是为 `true`，否为 `false` |
| `Choice<T>` | 对话框 | `T` | 玩家所选选项的值 |
| `Form` | 对话框 | `FormResponse` | 提交的各项值 |
| `Grid` | 箱子物品栏 | `Ack` | 无：网格界面总是以 `Closed` 结束 |

7.x 的次版本可能增加意图类型。不要在没有 `default` 分支的情况下对 `UiIntent` 做穷尽式 switch。

`show(player, intent)` 返回 `UiSession<R>`；对 `Grid` 返回 `GridSession`。每个构建器都接收来自[文本引擎](/zh/guide/essentials/messages)的 `Text` 标题，标题、正文行、标签与按钮都按查看者的语言渲染。

### Notice 与 Confirm {#notice-and-confirm}

```java
Notice rules = Notice.builder(Text.of(messages.key("arena.rules.title")))
        .addBody(Text.of(messages.key("arena.rules.line1")))
        .build();
ui.show(player, rules);

Confirm leave = Confirm.builder(Text.of(messages.key("arena.leave.title")))
        .addBody(Text.of(messages.key("arena.leave.body")))
        .build();
ui.show(player, leave).result().thenAcceptAsync(result -> {
    if (result.isCompleted() && result.value()) {
        leaveArena(player);
    }
}, scheduler.entity(player));
```

除 `Completed(true)` 以外的任何结果都应视为「未确认」。`UiResult.value()` 对 `Closed` 结果会抛出 `IllegalStateException`，所以先检查 `isCompleted()`。

### 聊天确认 {#chat-confirmation}

自 v7.0.0 起，上面的 `Confirm` 是框架提供的唯一确认方式。6.x 的聊天确认（`Confirm.chat(...)`、`ChatConfirm`）和箱子确认（`BaseConfirmationPage`、`Confirm.gui(...)`）已删除。需要“在聊天里点一下”的模块，用 Adventure 的 `ClickEvent.callback` 自己编写。需要导入 `java.util.UUID`、`org.bukkit.entity.Player`、`net.kyori.adventure.text.Component`、`net.kyori.adventure.text.format.NamedTextColor`，以及 `net.kyori.adventure.text.event.ClickCallback` / `ClickEvent`。给定目标 `Player player` 和 `Runnable onConfirm` / `onCancel`：

```java
UUID target = player.getUniqueId();
ClickCallback.Options once = ClickCallback.Options.builder().uses(1).build();
Component yes = Component.text("[Confirm]", NamedTextColor.GREEN).clickEvent(ClickEvent.callback(audience -> {
    if (audience instanceof Player clicker && clicker.getUniqueId().equals(target)) {
        onConfirm.run();
    }
}, once));
Component no = Component.text("[Cancel]", NamedTextColor.RED).clickEvent(ClickEvent.callback(audience -> {
    if (audience instanceof Player clicker && clicker.getUniqueId().equals(target)) {
        onCancel.run();
    }
}, once));
player.sendMessage(Component.text("Delete this home?").appendNewline().append(yes).append(Component.space()).append(no));
```

需要事先考虑的特性：

- 提示在服务器上按 Paper 默认的回调寿命（约 12 小时）过期；点击已过期的按钮没有任何效果。
- 点击不经过命令管线，其他插件的命令拦截器看不到它。
- 按钮动作抛出的异常由 Paper 记录，不会让玩家掉线。
- 两个按钮相互独立：先点确认再点取消，两个动作各执行一次。需要互斥的模块须自己保证。
- 卸载模块不会撤销待点回调；在回调过期之前，点击旧按钮仍可能运行已卸载模块的代码。

### Choice {#choice}

`Choice<T>` 为每个选项显示一个按钮。选项只有文字标签和可选的提示（tooltip），没有物品图标；需要图标时使用 `Grid`。至少需要一个选项，选项的值不能重复，并且应当是不可变对象。

```java
Choice<String> kit = Choice.<String>builder(Text.of(messages.key("kit.title")))
        .option("warrior", Text.of(messages.key("kit.warrior")))
        .option(new ChoiceOption<>("archer", Text.of(messages.key("kit.archer")),
                Text.of(messages.key("kit.archer.tooltip"))))
        .build();
```

### Form {#form}

`Form` 收集多个输入并一次提交，至少需要一个输入。每个输入有一个键，最长 32 个字符，须匹配 `[a-z0-9_]+`，在表单内唯一。

| 输入 | 值 | 创建方式 |
| --- | --- | --- |
| `TextInput` | `String`，可以为空 | `TextInput.builder(key, label)`；`maxLength` 为 1 到 256（默认 32），`maxLines`（默认 1），`initial` |
| `ToggleInput` | `Boolean` | `ToggleInput.of(key, label, initial)` |
| `ChoiceInput<T>` | 所选选项的值 | `ChoiceInput.of(key, label, options)` 或 `ChoiceInput.of(key, label, options, initial)` |
| `SliderInput` | `Double` | `SliderInput.builder(key, label, min, max)`；`step`（默认 1），`initial`（默认 `min`） |

没有密码（遮蔽）输入，因为 Paper 对话框的文本输入没有这个选项。

调用方提供 `CreateHome` 回调来处理表单提交；关闭而未提交时不会调用它。示例用 `Text.plain`，不需要消息词典。

```java
import com.ultikits.ultitools.scheduling.Scheduler;
import com.ultikits.ultitools.text.Text;
import com.ultikits.ultitools.ui.Form;
import com.ultikits.ultitools.ui.FormResponse;
import com.ultikits.ultitools.ui.SliderInput;
import com.ultikits.ultitools.ui.TextInput;
import com.ultikits.ultitools.ui.ToggleInput;
import com.ultikits.ultitools.ui.UiService;
import java.util.concurrent.CompletionStage;
import org.bukkit.entity.Player;

public final class HomeFormExample {
    @FunctionalInterface
    public interface CreateHome {
        void create(Player player, String name, boolean shared, double radius);
    }

    public static CompletionStage<Void> show(UiService ui, Scheduler scheduler, Player player,
                                             CreateHome createHome) {
        TextInput name = TextInput.builder("name", Text.plain("Name")).maxLength(24).build();
        ToggleInput shared = ToggleInput.of("shared", Text.plain("Shared"), false);
        SliderInput radius = SliderInput.builder("radius", Text.plain("Radius"), 1, 10)
                .initial(3)
                .build();
        Form form = Form.builder(Text.plain("Create a home"))
                .input(name)
                .input(shared)
                .input(radius)
                .build();

        return ui.show(player, form).result().thenAcceptAsync(result -> {
            if (!result.isCompleted()) {
                return;
            }
            FormResponse response = result.value();
            createHome.create(player, response.get(name), response.get(shared), response.get(radius));
        }, scheduler.entity(player));
    }
}
```

读取值时使用所显示表单的输入句柄。`FormResponse.get` 按对象身份匹配句柄，另一个表单中相等的句柄会抛出 `IllegalArgumentException`。

### 滑块的值与精度 {#slider-values-and-precision}

滑块的值是 `min + k * step`（`k` 为整数，按 `double` 运算），最大的 `k` 对应的值恰好是 `max`。`max - min` 必须是步长的整数倍。因此，从 0 到 10、步长 0.1 的滑块在第 73 步返回 `7.300000000000001` 而不是 `7.3`；显示时请自行取整。

Paper 对话框以 `float` 传递滑块数值。对话框后端只接受每个滑块都符合这一精度的表单：较大绝对值端点处的 `float` 间距不超过半个步长，并且 `min`、`max` 与 `initial` 各自与其 `float` 值相差不超过四分之一步长。从 0 到 100,000,000、步长 1 的滑块不满足这个条件。这样的表单完全不会显示，会话以 `Closed(UNSUPPORTED)` 结束。它不会回退为箱子界面，因为箱子后端只显示网格。

## 会话如何结束 {#how-a-session-ends}

`UiSession.result()` 恰好完成一次，值为 `UiResult<R>`：带答案的 `UiResult.Completed`，或带 `CloseReason` 的 `UiResult.Closed`。结果由下列事件中最先发生的一个决定；此后 `isOpen()` 返回 `false`，后来的事件被忽略。

| 结果 | 何时出现 |
| --- | --- |
| `Completed(value)` | 玩家作答 |
| `Closed(PLAYER)` | 玩家关闭了界面：表单或选择的取消按钮，或关闭箱子物品栏。框架判定为无效而拒绝的对话框答案也是这个结果，并记录一条带拥有者的 WARNING |
| `Closed(INTERRUPTED)` | 结束界面的是游戏或其他插件，而不是玩家，或者框架无法打开它。见[各关闭原因何时出现](#close-reasons)（自 v7.0.0 起） |
| `Closed(DISCONNECTED)` | 玩家离开服务器，或调用 `show` 时玩家已离线 |
| `Closed(REPLACED)` | 同一玩家被显示了另一个意图；每个玩家最多有一个打开的会话 |
| `Closed(TIMED_OUT)` | 超时 |
| `Closed(CLOSED_BY_CODE)` | 模块调用了 `session.close()` |
| `Closed(OWNER_UNLOADED)` | 显示它的模块被卸载 |
| `Closed(UNSUPPORTED)` | 没有后端能向该玩家显示这个意图，或打开失败 |

没有后端支持某个意图时，什么也不会打开，玩家之前的会话保持打开。7.x 的次版本可能增加 `CloseReason` 常量。

`session.close()` 可以在任意线程调用，可以重复调用。界面稍后关闭、结果稍后完成，都不在调用内部发生，因此可以在网格动作或事件处理器中安全调用。

### 各关闭原因何时出现 {#close-reasons}

自 v7.0.0 起，`INTERRUPTED` 表示界面不是玩家主动关闭的。下表列出每个原因在两种后端上由什么触发：

| 原因 | 对话框 | 箱子界面 |
| --- | --- | --- |
| `PLAYER` | 玩家按了取消，或答案被判定为无效而拒绝 | 玩家关闭了物品栏 |
| `DISCONNECTED` | 玩家离开服务器 | 玩家离开服务器。游戏报告「无法使用」且同一 tick 内玩家退出，也算这个原因 |
| `INTERRUPTED` | 玩家死亡、换世界，或为玩家打开了另一个物品栏（打开事件没有被取消） | 游戏或其他插件关闭了物品栏：死亡、传送、打开另一个物品栏、插件调用。框架无法打开界面，或在改标题后无法重新打开时也是这个原因 |
| `REPLACED` | 框架向玩家显示了下一个界面 | 相同 |
| `CLOSED_BY_CODE` | 模块调用了 `session.close()` | 相同 |
| `OWNER_UNLOADED` | 模块被卸载 | 相同 |
| `TIMED_OUT` | 超时 | 相同（需要自己设置超时） |

箱子界面首次打开，或改标题后的重新打开被拒绝（例如其他插件取消了打开事件）时，会话也立即以 `INTERRUPTED` 结束。存储照常提交（见下文）。

框架不会替你关闭别的东西：别的物品栏打开并打断了对话框时，新打开的物品栏保持打开。

### 被打断的对话框 {#interrupted-dialogs}

已显示的对话框在其玩家死亡、换世界，或为玩家打开了另一个物品栏时，以 `Closed(INTERRUPTED)` 结束。被取消的死亡事件或物品栏打开事件不会打断它。结果与其他结果一样，在查看者实体上下文的任务中送达。

对话框被其他方式顶掉时（例如另一个插件显示了自己的对话框），Paper 不发出信号，框架无从得知，这样的会话要等到超时才结束。对可能长时间停在屏幕上的对话框，请用 `ShowOptions` 设置合适的超时，不要依赖默认的 10 分钟。

### 关闭原因不改变存储 {#close-reason-and-storage}

对绑定了存储容器的界面，关闭原因只描述界面是怎么结束的。有未保存改动的容器，无论会话以 `PLAYER`、`INTERRUPTED`、`DISCONNECTED` 还是其他原因结束，都按同样的方式提交；没有改动的容器不写入。关闭原因不会在提交之前多出一个 tick。

## 对话框按钮 {#dialog-buttons}

对话框不能用 Esc 关闭。每种对话框都有明确的按钮：

| 意图 | 按钮 | 默认标签键 |
| --- | --- | --- |
| `Notice` | 一个确认按钮 | `ultitools:ui.ok` |
| `Confirm` | 是、否 | `ultitools:ui.yes`、`ultitools:ui.no` |
| `Form` | 提交、取消 | `ultitools:ui.submit`、`ultitools:ui.cancel` |
| `Choice` | 每个选项一个按钮，外加取消 | `ultitools:ui.cancel` |

框架目录把这些键在中文下渲染为 确定、是、否、提交、取消，在英文下渲染为 OK、Yes、No、Submit、Cancel。模块可以按意图替换标签：`Notice.Builder.button(Text)`、`Confirm.Builder.yes(Text)` 与 `no(Text)`、`Form.Builder.submit(Text)`。取消按钮的标签没有设置方法。

`Choice` 会在每个选项按钮上显示其提示。表单中 `ChoiceInput` 的选项不显示提示，因为 Paper 的选项条目没有提示字段。

### 客户端的显示 {#client-display}

- 原生客户端会在对话框标题旁画一个安全警告图标。它不是框架添加的按钮。统计动作按钮时不要把它算进上表。
- 滑块只显示标签和当前值，不显示取值范围的两端。想让玩家知道范围，请把范围写进标签或正文。

## 超时 {#timeouts}

Notice、Confirm、Form 与 Choice 默认 10 分钟后超时；网格没有超时。超时也是对话框被游戏以服务器看不到的方式顶掉时的收尾手段（见[被打断的对话框](#interrupted-dialogs)）。通过 `ShowOptions` 修改：

```java
ui.show(player, form, ShowOptions.builder().timeout(Duration.ofMinutes(2)).build());
```

`timeout(Duration)` 接受不超过 12 小时的正时长。`noTimeout()` 只对网格生效，其他意图仍使用默认值。

## 线程 {#threads}

| 内容 | 线程 |
| --- | --- |
| `result()` 完成 | 在查看者实体上下文的任务中；查看者已退出时在全局上下文的任务中 |
| 拥有者卸载时的 `result()` | 在卸载线程上、卸载返回之前（Paper 上为主线程） |
| `GridAction` | 在查看者实体上下文随后的任务中，从不在物品栏事件内部 |
| `SlotContainer` 的方法 | 只能在服务器线程调用，`owner()`、`size()` 与 `kind()` 除外 |

结果完成之前挂上的非异步后续操作在完成它的线程上运行。结果完成之后才挂上的非异步后续操作立即在挂上它的线程上运行，这可能是异步线程。无论在哪个线程挂上，都要操作玩家时，使用异步变体并传入模块的[调度器](/zh/guide/advanced/scheduled-tasks#调度器-api)：

```java
session.result().thenAcceptAsync(result -> handle(player, result), scheduler.entity(player));
```

如果那时玩家已经退出，该执行器会拒绝任务，后续阶段以 `RejectedExecutionException` 异常完成。即使玩家已退出也必须执行的工作，使用 `scheduler.global()`。

## 箱子界面 {#chest-screens}

`Grid` 是一个箱子界面的快照：1 到 6 行、每行 9 列（`Grid.COLUMNS`），用从零开始的 `GridSlot(row, column)` 定位。每个格子为空、是一个图标，或绑定到容器的一个索引。

### 图标与点击 {#icons-and-clicks}

图标是 `GridItem`：一个 `ItemSpec` 加一个可选的 `GridAction`。玩家永远拿不走图标。

调用方提供 `joinArena` 回调，接收点击图标的玩家。回调返回后，点击动作关闭会话。

```java
import com.ultikits.ultitools.item.ItemSpec;
import com.ultikits.ultitools.text.Text;
import com.ultikits.ultitools.ui.Grid;
import com.ultikits.ultitools.ui.GridSession;
import com.ultikits.ultitools.ui.UiService;
import java.util.function.Consumer;
import net.kyori.adventure.key.Key;
import org.bukkit.entity.Player;

public final class ArenaMenuExample {
    public static GridSession show(UiService ui, Player player, Consumer<Player> joinArena) {
        ItemSpec icon = ItemSpec.builder(Key.key("minecraft:diamond_sword"))
                .name(Text.plain("Join arena"))
                .build();
        Grid menu = Grid.builder(Text.plain("Arena"), 1)
                .set(0, 4, icon, click -> {
                    joinArena.accept(click.viewer());
                    click.session().close();
                })
                .build();
        return ui.show(player, menu);
    }
}
```

`GridClick` 提供 `viewer()`、`slot()`、`kind()`（一个 `ClickKind`）与 `session()`。动作只在其任务运行时会话仍然打开才会执行。动作中可以调用 `update`、`close()`，或显示另一个意图。动作抛出的异常会带拥有者记录并被吞掉。

双击只执行一次动作：箱子后端忽略图标上的双击事件，并丢弃 250 毫秒内对同一图标的第二次左键点击。

图标通过[物品渲染器](/zh/guide/essentials/items#渲染)为每个查看者分别渲染，名字与说明行（lore）按查看者的语言显示；标题同样按查看者渲染。

### 重绘 {#redrawing}

`session.update(next)` 替换快照。调用返回时 `current()` 已经返回 `next`；后端在查看者实体上下文随后的任务中得到通知，在那之前的多次更新可能合并为一次。行数不能改变（`IllegalArgumentException`）。标题可以改变：后端会重新打开物品栏，这不会结束会话；玩家光标上拿着物品时不会重新打开。

点击按后端在点击上报时持有的快照处理。玩家在旧画面上做的点击如果在重绘之后才到达服务器，执行的是重绘后该格子的动作，因此每个动作都要对格子当前显示的内容保持安全。绑定到容器的格子会在容器变化时自动重绘。

### 打开前与关闭时的光标 {#cursor-on-close}

自 v7.0.0 起，框架在显示箱子界面或对话框之前，会检查玩家当前打开的菜单。如果它是玩家自己的背包界面（生存或创造），且光标上或 2×2 合成格里有物品，框架先按原版方式关闭这个菜单：物品回到背包，放不下的掉在玩家脚下。这些物品不会被带进新界面。背包为空时不会有额外的关闭；玩家已经打开的其他容器按 Paper 的正常打开规则处理。

箱子界面关闭时，框架通过 Paper 关闭物品栏，自己不移动光标上的物品；Paper 按关闭任何物品栏时的方式处理它。箱子物品栏中的物品是展示副本，从来不是真实物品。

### 绑定容器与存储 {#bound-containers-and-storage}

真实物品存放在 `SlotContainer` 中，在服务器线程上用 `ui.container(ContainerSpec)` 创建。网格用 `bind(slot, container, index, mode)` 或 `bindRange(...)` 把格子绑定到容器索引。`BindingMode.EDITABLE` 允许玩家放入和取出物品，受容器的 `TransferPolicy` 与状态约束；`BindingMode.VIEW` 拒绝一切操作。容器比界面活得久，可以同时由多个界面显示。

| 规格 | 用途 |
| --- | --- |
| `ContainerSpec.storage(size)` | 真实物品。需要 `Disposition` 与 `UndeliveredHandler` |
| `ContainerSpec.template(size)` | 编辑定义（例如礼包）用的副本；没有处置方式、存储或处理器 |

存储容器结束时执行其处置方式：`COMMIT` 通过 `ContainerStore` 写入内容（`COMMIT` 必须提供），`RETURN_TO_CONTRIBUTORS` 把每件物品还给放入它的玩家。默认情况下，没有任何界面再显示容器时它就结束（`endWhenUnviewed(true)`）。

```java
SlotContainer bag = ui.container(ContainerSpec.storage(27)
        .baseline(loadBag(player.getUniqueId()))
        .disposition(Disposition.COMMIT)
        .store(snapshot -> saveBag(player.getUniqueId(), snapshot)) // returns CompletionStage<StoreAnswer>
        .undelivered((playerId, items) -> keepForLater(playerId, items))
        .build());

ui.show(player, Grid.builder(Text.of(messages.key("bag.title")), 3)
        .bindRange(0, 0, 27, bag, 0, BindingMode.EDITABLE)
        .build());
```

存储的回答为 `StoreAnswer.written()`、`refused(current)` 或 `unknown(cause)`。晚于规格中提交超时（默认 30 秒，最长 10 分钟）的回答按未知处理；此时容器进入 `FAILED`，不退还任何物品，物品由存储负责。`ui.deliver(player, items)` 把物品放进玩家的物品栏，放不下的掉落在玩家脚下。完整规则见 `SlotContainer`、`ContainerSpec` 与 `ContainerStore` 的 Javadoc。

## 卸载与停服 {#unload-and-server-stop}

自 v7.0.0 起，`/upm uninstall <模块>` 将卸载排到下次重启，不会卸载正在运行的模块或关闭它的界面。见[服务器上的模块变更](/zh/guide/advanced/module-versioning#在服务器上更新和卸载)。模块真正卸载时，例如服务器停止或取得界面服务后加载失败时，框架先结束它的界面，然后才取消模块的 `@Scheduled` 任务、运行 `onUnregister()`。在卸载线程上，框架依次执行待处理的发放，开始写入每个有改动的 `COMMIT` 容器，以 `Closed(OWNER_UNLOADED)`（或已经选定的结果）结束每个打开的会话，然后等待存储的回答。卸载期间或之后调用 `show`，返回的会话已经是 `Closed(OWNER_UNLOADED)`，不会打开任何界面。

存储等待有上限：

| 情形 | 等待 |
| --- | --- |
| 卸载单个模块 | 每次写入最多等待其剩余的提交超时，或剩余的约 10 秒卸载等待，以先到者为准 |
| 停服 | 所有模块共用约 10 秒的预算，在卸载第一个模块之前开始计算。只扣除界面存储卸载本身的耗时，不扣其他模块卸载钩子的耗时；预算不会重新补满 |

存储等待用完停服预算之后，后面的模块完全没有等待时间，其写入立即按超时处理。未得到回答的写入按未知处理，这些容器以 `UNKNOWN_KEPT_BY_STORE` 结束：不退还物品，物品由存储负责。

::: warning 存储资源保留到 onUnregister
`ContainerStore` 使用的连接与线程池要一直保持打开，直到你的 `onUnregister()` 钩子运行。完成存储返回的阶段时不要依赖服务器线程：卸载期间正是服务器线程在等待，排给它的任务不会再运行。
:::

## 已知限制 {#known-limitations}

- 停服时所有模块共用约 10 秒的存储等待预算，见上文；预算用完之后才卸载的模块没有等待时间。
- 箱子物品栏里是展示副本。后端先取消点击与拖拽，再执行自己的转移。其他插件不得用 `setCancelled(false)` 或 `setResult(ALLOW)` 清掉取消状态，否则原版可能移动展示副本并复制物品。
- 数字键交换与 Shift 移动依赖 Paper 根据展示副本算出的 `InventoryAction`。重绘尚未到达时这次输入可能不生效；请等重绘完成后重试。
- 其他插件替换对话框时 Paper 不发出信号。如果其他插件在你的对话框之后显示了自己的对话框，你的对话框超时关闭时也会关掉那个对话框。
- 不要为同一个存储键同时打开两个界面。某个键的界面仍开着、还有未保存的改动时，再为同一个键打开另一个界面，新界面读到的是旧数据；框架不会合并两份副本。请先结束旧界面、等它提交完成，再读取该键并重新显示。
- 框架拒绝某次点击时，客户端会先画出自己的预测，随后被服务器纠正，画面可能闪一下。这是游戏协议本身的特性。同一个容器的其他观看者比操作的玩家晚一个 tick 看到变化。
- 在运行中的服务器上实际卸载或重载模块时，框架在服务器线程上等待未保存的存储界面，最多约 10 秒。这与 Paper 默认的 `watchdog.early-warning-delay`（10000 毫秒）相同，等满时 Paper 可能打印 `The server has not responded for 10 seconds! Creating thread dump` 和一段线程转储。服务器并没有崩溃，该排查的是没有答复的存储。停服过程中 Paper 不打印这种预警。
- 声明式引擎现在向 `UiService` 提交 `Grid` 快照，不再继承 obliviate 的 `Gui`。使用 6.x 界面的模块需要迁移并针对 7.0 重新构建；参见[声明式 GUI](/zh/guide/advanced/declarative-gui)。旧箱子页面和两个旧确认组件（箱子式与聊天式）也已删除，见[聊天确认](#chat-confirmation)和[7.0 中的旧箱子页面与确认组件](/zh/guide/advanced/upgrading-to-7#chest-and-confirmation)。
