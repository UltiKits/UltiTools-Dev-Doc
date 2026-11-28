# 通知

自 v7.0.0 起，框架的 `NotificationService`（包 `com.ultikits.ultitools.services`）向单个玩家发送简短通知：聊天消息、标题、动作栏，或一条会自行减少并消失的 Boss 栏。所有文字都是[文本引擎](/zh/guide/essentials/messages)的 `Text`，按收件玩家的语言渲染。

::: warning 自 v7.0.0 起
本页描述自 v7.0.0 起的框架行为。6.x 使用 `String` 文本、`int` 秒数与 tick、Bukkit 音效，方法返回 `boolean`；参见 [7.0 的通知服务](/zh/guide/advanced/upgrading-to-7#notifications-migration)。
:::

## 获取服务

框架以接口类型注册一个共享实例，请按该类型注入：

```java
@Service
public class ArenaNotices {
    @Autowired
    private Messages messages;
    @Autowired
    private NotificationService notifications;

    public void welcome(Player player) {
        notifications.sendMessageNotification(player,
                Text.of(messages.key("arena.welcome"), Arg.string("player", player.getName())));
    }
}
```

不使用注入时，调用 `getContext().getBean(NotificationService.class)`。查找时始终使用 `NotificationService`：实现类 `InMemoryNotificationService` 在第一次按接口查找时才创建，按实现类查找或按类型扫描都找不到它。6.x 的 Bean 名称 `inMemoryNotificationService` 和接口全限定类名字符串已不存在。

## 方法

接口共有十二个发送方法：四个抽象方法，以及八个补全默认值的默认重载，全部返回 `void`。表中 `Sound` 是 Adventure 的 `net.kyori.adventure.sound.Sound`，`Title.Times` 是 Adventure 的 `net.kyori.adventure.title.Title.Times`，`BossBar.Color` 和 `BossBar.Overlay` 是 Adventure `net.kyori.adventure.bossbar.BossBar` 的枚举。

| 类型 | 方法 |
| --- | --- |
| 聊天 | `sendMessageNotification(Player, Text)`<br>`sendMessageNotification(Player, Text, Sound)` |
| 标题 | `sendTitleNotification(Player, Text title, Text subtitle)`<br>`sendTitleNotification(Player, Text, Text, Sound)`<br>`sendTitleNotification(Player, Text, Text, Sound, Title.Times)` |
| 仅副标题 | `sendSubTitleNotification(Player, Text)`<br>`sendSubTitleNotification(Player, Text, Sound)` |
| 动作栏 | `sendActionBarNotification(Player, Text)` |
| Boss 栏 | `sendBossBarNotification(Player, Text)`<br>`sendBossBarNotification(Player, Text, Duration)`<br>`sendBossBarNotification(Player, Text, Duration, Sound)`<br>`sendBossBarNotification(Player, Text, Duration, BossBar.Color, BossBar.Overlay, Sound)` |

四个抽象方法是两参数的动作栏方法，以及聊天、标题、Boss 栏各自参数最多的重载。`Sound` 参数可选，可以传 `null`；声音按你给出的来源、音量和音调播放。其余参数都是必需的，传 `null` 会抛出以参数名为消息的 `NullPointerException`。

### 聊天

```java
notifications.sendMessageNotification(player, Text.of(messages.key("arena.joined")));
```

### 标题与副标题

```java
notifications.sendTitleNotification(player,
        Text.of(messages.key("arena.round.title"), Arg.number("round", 3)),
        Text.of(messages.key("arena.round.subtitle")));
```

不传 `Title.Times` 时，标题淡入 500 毫秒、停留 2.5 秒、淡出 1 秒（`NotificationService.DEFAULT_TITLE_TIMES`，即原来的 10/50/20 tick）。需要其它时长时使用五参数重载：

```java
notifications.sendTitleNotification(player, title, subtitle, null,
        Title.Times.times(Duration.ofMillis(200), Duration.ofSeconds(3), Duration.ofMillis(500)));
```

`sendSubTitleNotification` 在空标题下显示副标题，使用默认时长：

```java
notifications.sendSubTitleNotification(player, Text.of(messages.key("arena.countdown")));
```

### 动作栏

```java
notifications.sendActionBarNotification(player, Text.of(messages.key("arena.ready")));
```

### Boss 栏

```java
Sound ding = Sound.sound(org.bukkit.Sound.BLOCK_NOTE_BLOCK_PLING, Sound.Source.MASTER, 1f, 1f);
notifications.sendBossBarNotification(player, Text.of(messages.key("arena.closing")),
        Duration.ofSeconds(10), BossBar.Color.RED, BossBar.Overlay.NOTCHED_10, ding);
```

Boss 栏从满格开始，在给定的 `Duration` 内减少到空后消失。较短的重载使用绿色、连续样式（`PROGRESS`）的 Boss 栏；未给出时长时为 25 秒（`NotificationService.DEFAULT_BOSS_BAR_DURATION`）。时长为零或负数时抛出 `IllegalArgumentException`。

## 语言与参数

每个 `Text` 都通过文本引擎按收件玩家渲染，玩家看到的是自己语言的消息。可以使用任意模块命名空间的键。[消息与语言](/zh/guide/essentials/messages)中的规则全部适用。

玩家或服主输入的内容作为参数传入，通常用 `Arg.string`，并在语言文件中写占位符，例如 `<player>`。引擎不会解释参数中的 MiniMessage 标签，因此不需要转义；不要把这类输入拼进模板。固定文字用 `Text.plain(string)`，已经构建好的组件用 `Text.literal(component)`。参见[来自玩家和服主的文本](/zh/guide/essentials/messages#来自玩家和服主的文本)。

## 线程 {#threads}

所有方法都可以在任意线程调用：

| 类型 | 运行位置 |
| --- | --- |
| 聊天、标题、副标题、动作栏 | 在调用线程渲染并发送 |
| Boss 栏 | 在调用线程渲染；创建、替换、声音和倒计时在玩家的实体上下文（`Scheduler#entity`）中运行，因此 Boss 栏在之后的 tick 出现，而不是在调用期间出现 |

聊天和标题通知附带的声音在调用线程播放。从异步线程发送声音之前，请先阅读[已知限制](#known-limitations)。

## Boss 栏的替换 {#boss-bar-replacement}

在同一个服务实例中，每个玩家最多有一条通知 Boss 栏。已有 Boss 栏显示时再次发送 Boss 栏通知，会复用这条 Boss 栏：替换文字、颜色和样式，重新充满，并按新的时长重新开始倒计时。每条 Boss 栏只运行一个倒计时，重复通知不会让它提前消失。

倒计时以 250 毫秒为一步。玩家退出时倒计时结束，记录被清除；重新连接后，下一条通知会显示一条新的 Boss 栏。对已经不在线的玩家发送 Boss 栏通知不会产生任何效果。

## 已知限制 {#known-limitations}

以下问题记录在 [UltiTools-Reborn#971](https://github.com/UltiKits/UltiTools-Reborn/issues/971)：

- 部分时长会多持续一个 250 毫秒的步长，默认的 25 秒也在其中（实际 25.25 秒）。
- 玩家仍在线时通过插件管理器或 `/reload` 禁用框架，已显示的 Boss 栏会一直保留到玩家重新连接。请改为重启服务器。
- 框架关闭后再调用，会以 `RejectedExecutionException` 被拒绝。
- 从异步线程发送的声音可以送达，但会使用一个非线程安全的服务端随机数生成器。请尽量在玩家的实体上下文中发送声音，例如放进 `scheduler.entity(player).run(...)`。
- 针对 6.x 编译的模块与本服务不保持二进制兼容。请迁移调用并针对 7.0 重新构建。
