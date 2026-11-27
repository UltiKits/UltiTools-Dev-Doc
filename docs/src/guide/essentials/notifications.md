# Notifications

As of v7.0.0, the framework's `NotificationService` (package `com.ultikits.ultitools.services`) sends short notifications to one player: a chat message, a title, an action bar or a boss bar that empties and disappears by itself. Every text is a `Text` from the [text engine](/guide/essentials/messages) and is rendered in the recipient's language.

::: warning Unreleased v7.0.0 behaviour
This page describes the unreleased 7.0.0 framework. 6.x takes `String` text, `int` seconds and ticks and Bukkit sounds, and its methods return `boolean`; see [Notification service in 7.0](/guide/advanced/upgrading-to-7#notifications-migration).
:::

## Obtaining the service

The framework registers one shared instance under the interface type. Inject it by that type:

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

Outside injection, use `getContext().getBean(NotificationService.class)`. Always look the service up by `NotificationService`. The implementation class `InMemoryNotificationService` is created on the first lookup by the interface, and a lookup by the implementation class or a scan by type does not find it. The 6.x bean names `inMemoryNotificationService` and the interface's class-name string no longer exist.

## Methods

The interface has twelve sending methods: four abstract ones and eight default overloads that fill in defaults. All of them return `void`. In the table, `Sound` is Adventure's `net.kyori.adventure.sound.Sound`, `Title.Times` is Adventure's `net.kyori.adventure.title.Title.Times`, and `BossBar.Color` and `BossBar.Overlay` are Adventure's `net.kyori.adventure.bossbar.BossBar` enums.

| Kind | Methods |
| --- | --- |
| Chat | `sendMessageNotification(Player, Text)`<br>`sendMessageNotification(Player, Text, Sound)` |
| Title | `sendTitleNotification(Player, Text title, Text subtitle)`<br>`sendTitleNotification(Player, Text, Text, Sound)`<br>`sendTitleNotification(Player, Text, Text, Sound, Title.Times)` |
| Subtitle only | `sendSubTitleNotification(Player, Text)`<br>`sendSubTitleNotification(Player, Text, Sound)` |
| Action bar | `sendActionBarNotification(Player, Text)` |
| Boss bar | `sendBossBarNotification(Player, Text)`<br>`sendBossBarNotification(Player, Text, Duration)`<br>`sendBossBarNotification(Player, Text, Duration, Sound)`<br>`sendBossBarNotification(Player, Text, Duration, BossBar.Color, BossBar.Overlay, Sound)` |

The abstract methods are the two-argument action bar and the longest chat, title and boss-bar overloads. A `Sound` argument is optional and may be `null`; the sound plays with the source, volume and pitch you give it. Every other argument is required, and `null` throws a `NullPointerException` whose message is the parameter name.

### Chat

```java
notifications.sendMessageNotification(player, Text.of(messages.key("arena.joined")));
```

### Titles and subtitles

```java
notifications.sendTitleNotification(player,
        Text.of(messages.key("arena.round.title"), Arg.number("round", 3)),
        Text.of(messages.key("arena.round.subtitle")));
```

Without a `Title.Times`, the title fades in for 500 ms, stays for 2.5 s and fades out for 1 s (`NotificationService.DEFAULT_TITLE_TIMES`, the former 10/50/20 ticks). Pass your own times to the five-argument overload:

```java
notifications.sendTitleNotification(player, title, subtitle, null,
        Title.Times.times(Duration.ofMillis(200), Duration.ofSeconds(3), Duration.ofMillis(500)));
```

`sendSubTitleNotification` shows the subtitle under an empty title with the default times:

```java
notifications.sendSubTitleNotification(player, Text.of(messages.key("arena.countdown")));
```

### Action bar

```java
notifications.sendActionBarNotification(player, Text.of(messages.key("arena.ready")));
```

### Boss bar

```java
Sound ding = Sound.sound(org.bukkit.Sound.BLOCK_NOTE_BLOCK_PLING, Sound.Source.MASTER, 1f, 1f);
notifications.sendBossBarNotification(player, Text.of(messages.key("arena.closing")),
        Duration.ofSeconds(10), BossBar.Color.RED, BossBar.Overlay.NOTCHED_10, ding);
```

The bar starts full and empties over the given `Duration`, then disappears. The short overloads use a green bar with the continuous `PROGRESS` overlay, and a lifetime of 25 seconds (`NotificationService.DEFAULT_BOSS_BAR_DURATION`) when no duration is given. A zero or negative duration throws `IllegalArgumentException`.

## Language and arguments

Each `Text` is rendered for the recipient through the text engine, so the player sees the message in their own language. Keys from any module's namespace can be used. The rules of [Messages and Languages](/guide/essentials/messages) apply unchanged.

Pass player or operator input as an argument, normally `Arg.string`, and write the placeholder in the catalogue, for example `<player>`. The engine never interprets MiniMessage tags in an argument, so no escaping is needed. Do not join such input into a template. For fixed text use `Text.plain(string)`, and for an already built component `Text.literal(component)`. See [Text from players and operators](/guide/essentials/messages#text-from-players-and-operators).

## Threads

The methods may be called from any thread:

| Kind | Where it runs |
| --- | --- |
| Chat, title, subtitle, action bar | Rendered and sent on the calling thread |
| Boss bar | Rendered on the calling thread; creating, replacing, the sound and the countdown run in the player's entity context (`Scheduler#entity`), so the bar appears on a later tick, not during the call |

A sound passed to a chat or title notification is played on the calling thread. See [Known limitations](#known-limitations) before sending one from an asynchronous thread.

## Boss-bar replacement

A player has at most one notification boss bar per service instance. A second boss-bar notification while one is showing reuses that bar: it replaces the text, colour and overlay, fills the bar again and restarts the countdown for the new duration. Only one countdown runs per bar, so repeated notifications do not make the bar disappear early.

The countdown advances in 250 ms steps. When the player leaves, the countdown ends and the entry is forgotten; after reconnecting, the next notification shows a new bar. A boss-bar notification for a player who is no longer online does nothing.

## Known limitations

These are tracked in [UltiTools-Reborn#971](https://github.com/UltiKits/UltiTools-Reborn/issues/971):

- Some durations last one extra 250 ms step, the 25-second default among them (25.25 s).
- Disabling the framework while players stay online, through a plugin manager or `/reload`, leaves visible boss bars until the player reconnects. Restart the server instead.
- A call after the framework has shut down is rejected with `RejectedExecutionException`.
- A sound sent from an asynchronous thread is delivered, but it uses a server-side random generator that is not thread-safe. Prefer sending sounds from the player's entity context, for example inside `scheduler.entity(player).run(...)`.
- Modules compiled against 6.x are not binary compatible with this service. Migrate the calls and rebuild against 7.0.
