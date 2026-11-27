# Upgrading from 6.x to 7.0

7.0.0 has not been released. This guide describes changes as of v7.0.0; see the [7.0.0 release notes](../release-notes/7.0.0) for the overview.

Use this guide to migrate an UltiTools module from source to a rebuilt JAR. If you maintain a separate Paper plugin that calls UltiTools, also read [Standalone Paper plugins](#external-paper-plugins).

## Before you upgrade {#before-upgrade}

1. Back up the server before changing versions. Keep a matching set of the old framework and module JARs, configuration, worlds and module data. Include inventories and serialized item strings in files or databases: [7.0 item writes](#item-migration) cannot be read by 6.x.
2. Let every pending `/upm update` finish one confirming start on the **6.x framework**, before installing 7.0. This applies when an update has been staged but has not yet been confirmed by a start on 6.x. If you carry it across, 7.0 may refuse the staged JAR and the update may roll back to the previous 6.x JAR, which is also below the new API floor. Check the old start-up log before you proceed. See the [pending-update limitation in the compatibility policy][module admission].

If you do not want a staged 6.x update, read [Updates and uninstalls in 6.x](./module-versioning#updates-and-uninstalls-in-6-x) first. The 6.x `/upm uninstall` cancels the update **and** unloads the module and deletes its JARs; it is not a revoke-only command.

## Build target and module admission {#build-target}

As of v7.0.0, target **Paper 26.3 build 258 with Java 25**. Use a Java 25 toolchain and compile for Java 25 against `com.ultikits:UltiTools-API` 7.0 and `io.papermc.paper:paper-api:26.3.build.258-stable`. Use Maven `provided` (Gradle `compileOnly`) for the framework and Paper APIs supplied by the server; do not bundle those APIs. Review any other dependency that you previously expected UltiTools to supply. See [Older Servers](./older-servers) if you need to stay on an older target.

Set the UltiTools API level in the module JAR's root `plugin.yml`:

```yaml
api-version: 700
```

As of v7.0.0, admission requires an integer from `700` through the running framework's API level, inclusive. This is not Paper's `api-version: '26.3'`. Changing the old JAR's declaration cannot repair references to removed APIs. UltiTools loads the rebuilt JAR unchanged through its shared parent-first `URLClassLoader`: it no longer adapts bytecode, probes the server API or performs start-up and offline linkage audits. A skipped-container diagnostic reports a missing symbol the framework actually encountered; it does not recover missing capabilities.

With readable metadata and a `main:` entry, the floor and integer checks run before main-class resolution. If `plugin.yml` is unreadable or has no `main:`, fix that first. For API refusals, the start-up log distinguishes these cases:

| Declaration | What to check |
| --- | --- |
| Missing or not an integer | Search the log for `has no valid api-version` (Chinese: `未声明有效的 api-version`). A missing or bare key shows `<missing>` in English or `<缺失>` in Chinese; a string such as `''`, `'26.3'`, `'1.21'` or `'abc'` is shown in quotes. Quoted integers such as `'700'` are accepted. |
| Integer below `700`, such as `630` | The log names the level and the minimum. Search for `below the minimum` (Chinese: `要求的最低级别`). Install a rebuilt JAR. |
| Integer above the running framework's level | The installed framework is too old for the declared level. |

A JAR refused by the integer or minimum check never supplies main or helper classes to another module, and it counts once in `Failed`. Refusing one module does not stop other eligible modules that do not depend on it from loading. For example, if a `630` and a `700` JAR declare the same main class, the `700` copy can supply the classes even if its filename sorts later. The warning still names both copies; neither file is automatically deleted. Among admitted copies, [filename order still matters](./module-versioning#two-copies-of-one-module).

For dependencies on other server plugins, declare the provider under `depend` or `softdepend` in the module descriptor. See [Other plugins' classes](./startup-phases#other-plugins-classes) and [Runtime libraries](./startup-phases#runtime-libraries).

## Removed public APIs {#removed-public-apis}

Use this table to find 6.x calls and types to replace before you rebuild. The left column lists APIs that are no longer available as of v7.0.0, not APIs that are merely deprecated.

| 6.x API removed in 7.0 | 7.0 replacement |
| --- | --- |
| `AbstractCommand`, `AbstractTabExecutor`, `AbstractPlayerCommandExecutor`, `AbstractConsoleCommandExecutor` | Extend `BaseCommandExecutor` and use `@CmdTarget` where needed; see [Commands](#command-migration). |
| `i18n(...)`, `MessageUtils`, `Localized`, `Language`, `FrameworkText`, `OfficialLanguageFiles`, and the old language getters | Inject `Messages`; use `LocaleResolver#fallback()` if you specifically need the server fallback locale. |
| `@I18n`, `@UltiToolsModule(i18n = …)` and `supported()` | Remove declarations, overrides and calls; ship `messages/<locale>.yml`. |
| `XVersionUtils`, `Sounds`, `Colors#getCode()` | Use Paper and Adventure APIs; `Colors#getGlassPaneMaterial()` supplies the pane `Material`. See [Native items and sounds](#items-and-sounds). |
| `ItemStackBuilder` | Build an `ItemSpec`, then call `ItemRenderer#render(ItemSpec, Audience)` or build and edit a native `ItemStack` directly. |
| `BaseInventoryPage`, `BasePaginationPage`, `IconWrapper`, `RenderNodeDiffer`, `DiffResult` | Use `DeclarativeGui` with `ItemSpec`; for paging use `State` and `GridView`. The UI service renders the grid snapshots. |
| `BaseConfirmationPage`, `widgets.Confirm`, `InventoryConfirm`, `ChatConfirm`, `Buttons`, `ViewType`, `DependenceManagers#initInventoryAPI` | Use `ui.Confirm` for a confirmation screen, a module-owned clickable prompt for chat confirmation and `TextButton` for a labelled button. No inventory API initialiser or `ViewType` replacement is needed. |
| `Toast`, `NotificationService#sendToastNotification` | No drop-in toast helper. Use a title, action-bar or chat notification. |
| `Hologram` | Spawn and manage a Paper `TextDisplay`. |
| Old `NotificationService` sending method signatures and the no-argument `InMemoryNotificationService` constructor | Inject `NotificationService` and migrate to [its `void` methods](#notifications-migration). |
| Class-name filter methods and audit bridges on `SecurityPolicy` and `ClassLoaderUtils` | Remove these calls. There is no replacement filter or audit. JAR structure checks still exist; they are not a sandbox. |

## Commands {#command-migration}

As of v7.0.0, UltiTools compiles annotation-based commands into Brigadier trees and registers them through Paper's command lifecycle. Update the old executors and check argument parsing and completion against [Migrating from 6.x](../essentials/cmd-executor#migrating-from-6-x). Also check [Rejected formats](../essentials/cmd-executor#rejected-formats); a format accepted by 6.x can now prevent that module from loading.

## Text and languages {#messages-migration}

As of v7.0.0, `Messages` is the only text system. Ship new catalogues with the module and migrate any operator edits by hand.

- **Language files.** Move translations you still need from `lang/` to `src/main/resources/messages/<locale>.yml`, with lowercase dotted keys and MiniMessage values. Only `.yml` is read. The new catalogues do not interpret `§` or `&` colour codes or import legacy files. Convert operator edits into [override files](/guide/essentials/messages#operator-overrides); do not edit the generated defaults.
- **Source language.** Declare `source-language` in the module's `plugin.yml` if the module's own texts are not English; it defaults to `en`.
- **Sending text.** Inject `com.ultikits.ultitools.text.Messages` with `@Autowired`, build keys with `messages.key(path)` and send with `messages.send(...)`, to resolve the recipient’s language. This follows the client language by default, subject to the operator’s language settings and the fallback rules. Pass player or operator input as `Arg.string`, never as part of a template. Use `messages.shared(Text)` for entity names, text displays and shared boss bars.
- **Defaults.** New installations ship `language: auto` and `fallback-language: auto`; on a host whose time zone is not a China zone, the console and the fallback are English. See [Language selection](/guide/essentials/messages#language-selection).
- **Legacy text APIs.** Replace `i18n(...)` with `Messages`. If you need the server fallback language, inject `LocaleResolver` and call `fallback()` instead of using `getLanguageCode()` or `getConfiguredLanguage()`.
- **Language declarations.** Remove `supported()` overrides and old language declarations. Ship the supported locales with the module instead.

Check your code against the [complete list of removed legacy text types and entry points](/guide/essentials/i18n#removed-text-apis). The [migration table](/guide/essentials/i18n) also covers configuration comments and language files.

## Native items and sounds {#items-and-sounds}

As of v7.0.0, the framework no longer supplies XSeries or the cross-version material and sound layer. `Colors` remains and gains `getGlassPaneMaterial()`. If you maintain source for both 6.x and 7.0, use native constants such as `Material.CYAN_STAINED_GLASS_PANE` directly.

To turn a material name into an item in 7.0, use `Material.matchMaterial`. It accepts current material names such as `DIAMOND` and namespaced keys such as `minecraft:stone`; there is no legacy-name lookup or fallback item. Reject `null`, block-only and air results before passing the material to `ItemSpec.builder`, as shown in [Item construction and storage](#item-migration).

The following native replacements apply as of v7.0.0. Use `org.bukkit.Material`, `org.bukkit.Sound`, `org.bukkit.enchantments.Enchantment`, `org.bukkit.inventory.ItemFlag` and Adventure's `net.kyori.adventure.text.Component`:

| 6.x approach | Native replacement for 7.0 |
| --- | --- |
| XSeries material / `XVersionUtils` item factory | `new ItemStack(Material.STONE)`, or `itemRenderer.render(ItemSpec.builder(Material.STONE).build(), player)` |
| `XVersionUtils.getSound(Sounds.ENTITY_ENDERMAN_TELEPORT)` passed to `playSound` | `player.playSound(player.getLocation(), Sound.ENTITY_ENDERMAN_TELEPORT, volume, pitch)` (keep the caller's existing volume and pitch) |
| XSeries enchantment used for a hidden glow | `ItemSpec.builder(Material.PAPER).glint(true).build()`, then render it (visual glint without adding an enchantment) |
| `XVersionUtils.sendActionBar(player, "Ready")` | `player.sendActionBar(Component.text("Ready"))` |

Call sound and enchantment APIs during gameplay, not in static initializers or enum constructors. For a purely visual glint, use `ItemSpec.Builder#glint(true)`, or `ItemMeta#setEnchantmentGlintOverride(Boolean)` on an existing stack; neither adds an enchantment. For colored glass, use `new ItemStack(Colors.CYAN.getGlassPaneMaterial())`; existing GUI glass colors and button materials remain unchanged.

### `XVersionUtils` replacement table {#xversionutils-replacements}

As of v7.0.0, replace all 15 public methods on the old class as follows on Paper 26.3. Here `color` is a retained `Colors` value, and item constructors are `org.bukkit.inventory.ItemStack`. “No direct equivalent” means no single Paper call preserves the whole helper's behaviour; keep the stated checks in your own code.

| Removed 6.x method | Paper 26.3 replacement and behaviour to retain |
| --- | --- |
| `getColoredPlaneGlass(Colors color)` | `new ItemStack(color.getGlassPaneMaterial())`; for a fixed color use e.g. `Material.CYAN_STAINED_GLASS_PANE` |
| `getColoredWool(Colors color)` | `new ItemStack(Material.valueOf(color.name() + "_WOOL"))` |
| `getSign()` | `new ItemStack(Material.OAK_SIGN)` |
| `getEndEye()` | `new ItemStack(Material.ENDER_EYE)` |
| `getEmailMaterial(boolean isRead)` | `new ItemStack(isRead ? Material.FILLED_MAP : Material.PAPER)` |
| `getHead(OfflinePlayer player)` | `new ItemStack(player.isOp() ? Material.DRAGON_HEAD : Material.PLAYER_HEAD)`; the old helper only chose the head type and did not set a player's skin |
| `getGrassBlock()` | `new ItemStack(Material.GRASS_BLOCK)` |
| `registerNewObjective(Scoreboard scoreboard, String name, String criteria, String displayName)` | No direct equivalent: first call `scoreboard.getObjective(name)` and return it if present; otherwise call `scoreboard.registerNewObjective(name, Criteria.DUMMY, displayName)`. The old helper ignored `criteria` and always created a dummy objective |
| `getSound(Sounds sound)` | Use `Sound.ENTITY_ENDERMAN_TELEPORT` or another matching native constant; replace the deleted `Sounds` type in callers too |
| `getBed(Colors bedColor)` | `new ItemStack(Material.valueOf(bedColor.name() + "_BED"))` |
| `getItemDurability(ItemStack itemStack)` | No direct equivalent: if `itemStack.getItemMeta()` is `org.bukkit.inventory.meta.Damageable`, return `itemStack.getType().getMaxDurability() - damageable.getDamage()`; otherwise return `0`. `getDamage()` alone is damage taken, not remaining durability |
| `getItemInHand(Player player, boolean isMainHand)` | `isMainHand ? player.getInventory().getItemInMainHand() : player.getInventory().getItemInOffHand()` |
| `sendActionBar(Player player, String message)` | `player.sendActionBar(Component.text(message))` for literal text |
| `sendPlayerList(Player player, String header, String footer)` | `player.setPlayerListHeaderFooter(header, footer)` preserves the string call; for literal Adventure text use `player.sendPlayerListHeaderAndFooter(Component.text(header), Component.text(footer))` |
| `getBlockFace(Block placedBlock)` | No direct equivalent: read `placedBlock.getBlockData()`; if it is `org.bukkit.block.data.Directional`, return `directional.getFacing()`, otherwise return `org.bukkit.block.BlockFace.NORTH` |

A module retaining XSeries must bundle its own dependency and relocate its packages with Maven Shade or Gradle Shadow (shade + relocate). Do not rely on the framework to supply it or declare it only as `provided`/`compileOnly`: Paper's `plugin.yml` `libraries:` mechanism is not available to UltiTools modules loaded by the framework. The [6.x runtime-library instructions](/guide/introduction) are not a supply guarantee for 7.0.

## Item construction and storage {#item-migration}

As of v7.0.0, `ItemStackBuilder` is removed. Describe the item with `ItemSpec` and use an injected `ItemRenderer` to render it in the viewer’s language.

Names and lore move into the module's language files as MiniMessage. A 6.x builder call such as

```java
ItemStack item = ItemStackBuilder.of(Material.DIAMOND).name("&aShop").lore("&7Click to buy").amount(3).glow().build();
```

becomes, with `itemRenderer` injected by `@Autowired`:

```java
ItemSpec spec = ItemSpec.builder(Material.DIAMOND)
        .name(messages.key("shop.name"))
        .addLore(messages.key("shop.click"))
        .amount(3)
        .glint(true)
        .build();
ItemStack item = itemRenderer.render(spec, player);
```

The remaining builder methods map as follows. Here `builder` is an `ItemSpec.Builder`, `stack` is a rendered or existing `ItemStack`, and `key2` and `key3` are `MessageKey`s from the module's language files:

| 6.x call | 7.0 replacement |
| --- | --- |
| `.amount(n)` | `builder.amount(n)`; values outside 1 to 99 throw `IllegalArgumentException` instead of being clamped |
| `.lore(...)` / `.addLore(...)` | `builder.lore(List.of(Text.of(key2), Text.of(key3)))` replaces all lines; `builder.addLore(key2)` appends one; fixed components use `Text.literal(component)` |
| `.glow()` | `builder.glint(true)`; no enchantment is added |
| `.enchant(e, lvl)` | `builder.data(DataComponentTypes.ENCHANTMENTS, ItemEnchantments.itemEnchantments().add(e, lvl).build())` |
| `.removeEnchant(e)` | `stack.removeEnchantment(e)` after rendering |
| `.hideAttributes()` | `builder.hiddenInTooltip(Set.of(DataComponentTypes.ATTRIBUTE_MODIFIERS))` |
| `.flags(flags)` | `stack.editMeta(meta -> meta.addItemFlags(flags))` after rendering |
| `.hideAll()` | `stack.editMeta(meta -> meta.addItemFlags(ItemFlag.values()))`; like 6.x, the name and lore stay visible. `builder.tooltipHidden(true)` hides the whole tooltip, name and lore included |
| `.unbreakable()` | `builder.data(DataComponentTypes.UNBREAKABLE)` |
| `.customModelData(n)` | `builder.data(DataComponentTypes.CUSTOM_MODEL_DATA, CustomModelData.customModelData().addFloat(n).build())` |
| `.leatherColor(c)` | `builder.data(DataComponentTypes.DYED_COLOR, DyedItemColor.dyedItemColor(c))` |
| `.skullOwner(player)` | `builder.data(DataComponentTypes.PROFILE, ResolvableProfile.resolvableProfile(player.getPlayerProfile()))` |
| `.meta(consumer)` / `.item(consumer)` | `stack.editMeta(consumer)` / `consumer.accept(stack)` after rendering |
| `ItemStackBuilder.of(existingStack)` | `existingStack.clone()`, then Paper's `setData` and `unsetData` |
| `.build()` / `.buildClone()` | `itemRenderer.render(spec, player)` creates a new stack on every call; `stack.clone()` copies an existing one |
| `ItemStackBuilder.of(String)` | `Material m = Material.matchMaterial(name);` then `m != null && m.isItem() && !m.isAir() ? ItemSpec.builder(m) : null` |

`ItemStackUtils` keeps its five methods and can read the Bukkit object streams it wrote in 6.x, so those stored values need no advance conversion. This does not cover module-specific formats. In 7.0 it writes Paper item bytes encoded as Base64, which 6.x cannot read. Back up items and inventories before upgrading, and do not automatically overwrite a failed read with an empty inventory. Restore a backup from the matching version if you roll back. See [Items and Item Storage](/guide/essentials/items).

## Scheduling and declarative GUI {#scheduler-and-screens}

As of v7.0.0, scheduling and declarative screens use services owned by the module instance.

- **Scheduling.** Inject `com.ultikits.ultitools.scheduling.Scheduler` with `@Autowired`; each module instance owns one, and unloading the module cancels its tasks. `@Scheduled` runs on it. Async repeating tasks run at a fixed rate, and tasks bound to an entity end when the entity is removed (for a player, on disconnect). See [Scheduler API](/guide/advanced/scheduled-tasks#scheduler-api). The framework's own work moving onto its scheduler requires no change in module code; its visible effects are listed under [Framework-scheduled work](/guide/advanced/scheduled-tasks#framework-scheduled-work).
- **Declarative GUI.** `DeclarativeGui` no longer inherits obliviate's `Gui`. The constructor takes `UiService ui`, `Scheduler scheduler`, `Player viewer`, `String id`, `Text title` and `int rows` (a fixed count from 1 to 6); `InventoryType` constructors, `IconWrapper`, `RenderNodeDiffer`, `DiffResult` and `getPlayer()` (now `viewer()`) are gone; `ItemDisplay` takes an `ItemSpec`, and clicks use `onClick(GridAction)`. See [What changes in 7.0](/guide/advanced/declarative-gui#what-changes-in-7-0).

## Legacy chest pages and confirmation widgets {#chest-and-confirmation}

As of v7.0.0, there is no compatibility bridge for the old chest pages or confirmation widgets, and `DependenceManagers#initInventoryAPI` is removed. The framework JAR no longer bundles obliviate-invs or UniversalScheduler. If you depended on the framework to supply `mc.obliviate.*` or `com.github.Anon8281.*`, package the libraries yourself or rewrite the code. Packaging them does not bring back removed framework APIs. `Colors` remains.

| 6.x | 7.0 |
|---|---|
| `BaseInventoryPage` | `DeclarativeGui`, see [Declarative GUI](/guide/advanced/declarative-gui) |
| `BasePaginationPage` | A `State` that holds the page number and a `GridView` that shows the slice, see [Declarative GUI](/guide/advanced/declarative-gui) |
| `BaseConfirmationPage`, `InventoryConfirm`, `Confirm.gui(...)` | `Confirm` of the UI service, see [UI: Intents and Sessions](/guide/advanced/ui-service#notice-and-confirm) |
| `ChatConfirm`, `Confirm.chat(...)` | The module sends its own clickable chat prompt, see [UI: Intents and Sessions](/guide/advanced/ui-service#chat-confirmation) |
| `Buttons`, `ViewType` | No replacement type; use a `TextButton` label or the framework label keys |

The 6.x pages are still described, as 6.x material, in [GUI Interface](/guide/advanced/gui).

## Toasts and holograms {#display-and-toast}

As of v7.0.0, `Toast`, `NotificationService#sendToastNotification` and `Hologram` are removed.

**Toasts.** The advancement-based popup depended on deprecated, version-unstable server internals, and message text containing quotes could break its generated JSON. There is no replacement helper. `NotificationService` offers `sendTitleNotification`, `sendSubTitleNotification`, `sendActionBarNotification`, `sendBossBarNotification` and `sendMessageNotification` (a chat message); some overloads also take a `Sound`. Use one of these, or chat, instead. In 7.0 these methods take `Text` and Adventure types; see [Notification service](#notifications-migration).

**Holograms.** `Hologram` spawned an invisible armour stand for each text line. Use Paper's native `TextDisplay` entity instead; a single display can contain multiple lines. The following example disables entity persistence:

```java
World world = location.getWorld();
if (world == null) {
    throw new IllegalArgumentException("The display location must have a world");
}
TextDisplay display = world.spawn(location, TextDisplay.class, d -> {
    d.text(messages.shared(Text.of(messages.key("hologram.welcome"))));
    d.setBillboard(Display.Billboard.CENTER);
    d.setPersistent(false);
});
// later: display.remove();
```

- Call `World#spawn` on the thread that owns the location. From another thread, switch first with the module's injected `Scheduler`, for example `scheduler.region(location).run(...)`; see [Scheduler API](/guide/advanced/scheduled-tasks#scheduler-api).
- `Location#getWorld()` can return `null`, so check it before spawning, as the example does.
- `messages` is the module's injected `com.ultikits.ultitools.text.Messages` service. Its `shared(Text)` method returns text for objects every player sees, such as a text display.

The caller owns the display and removes it with `display.remove()` when it is no longer needed.

## Notification service {#notifications-migration}

As of v7.0.0, the old notification signatures are no longer available. Update the calls and recompile; remove any code that checks their former `boolean` results.

The service renders each `Text` in the recipient's language. It has twelve sending methods: four abstract ones and eight default overloads. The signatures change as follows:

| Before 7.0 | As of v7.0.0 |
| --- | --- |
| `String` message, title, subtitle and action-bar arguments | `com.ultikits.ultitools.text.Text` |
| Boss-bar `int` seconds | A positive `java.time.Duration`; the default stays 25 seconds |
| `org.bukkit.Sound` | Adventure `net.kyori.adventure.sound.Sound`, played with the caller's source, volume and pitch |
| Title fade-in, stay and fade-out as `int` ticks | Adventure `Title.Times`; the defaults stay 500 ms, 2.5 s and 1 s |
| `boolean` return values | `void`; a `null` required argument throws `NullPointerException` naming the parameter, a zero or negative duration throws `IllegalArgumentException` |
| Two overloads taking a caller-owned Bukkit `BossBar` | One full overload taking Adventure `BossBar.Color` and `BossBar.Overlay` |
| `new InMemoryNotificationService()` | `new InMemoryNotificationService(Messages, Scheduler)`, or preferably inject `NotificationService` |
| Bean names `inMemoryNotificationService` and the interface's class-name string | Look up by type: `@Autowired NotificationService` or `getBean(NotificationService.class)` |

A 6.x call such as

```java
notificationService.sendBossBarNotification(player, "Arena closes soon", 10);
```

becomes, with `messages` and `notifications` injected by `@Autowired`:

```java
notifications.sendBossBarNotification(player, Text.of(messages.key("arena.closing")), Duration.ofSeconds(10));
```

Move the text into the module's language file. Pass player or operator input as `Arg.string` with a `<name>` placeholder in the catalogue, never by joining it into the template; use `Text.plain(string)` for fixed text. A second boss-bar notification now replaces the bar's text, colour and overlay and restarts its single countdown; in 6.x the text stayed unchanged and overlapping countdowns made the bar disappear early. See [Notifications](/guide/essentials/notifications) for the threads each method uses and the known limitations.

## Configuration saving and JSON flushes {#config-save-and-flush}

`UltiToolsPlugin#saveConfig(path, type)` threw `NullPointerException` in 6.x when the path was not registered for the module. As of v7.0.0 it throws `IllegalStateException` naming the module and path, and writes no file. Register the configuration entity before saving it. If 6.x code caught `NullPointerException` to detect a missing registration, check that `getConfig(path, type)` returns non-null instead. Do not catch `IllegalStateException` for this: `saveConfig` throws the same type when it is called off the server thread. A registered entity of another type still throws `ClassCastException`. See [`save()`](../essentials/config-file#save).

In 6.x a negative `datasource.flushRate` made the JSON store flush once in the background and never again. As of v7.0.0 a negative value starts no periodic flush and logs one warning at start-up; a normal server stop still writes the data. To restore periodic flushes, set a positive number of seconds and restart the server. See [Operating JSON Storage](../essentials/data-storage#operating-json-storage).

## Rebuild and check the artifact {#rebuild-and-check}

1. Rebuild from the migrated sources with both 7.0 build dependencies. If you raise the module's `api-version`, raise the module's own MAJOR version under the [module versioning rules](./module-versioning#choosing-the-number).
2. Open the built JAR. Check its root `plugin.yml` for the intended `main`, module `version` and integer `api-version`. Check that newly bundled catalogues are under `messages/<locale>.yml` and that required private libraries are packaged without bundling the framework or Paper APIs.
3. Use [Checking an artifact](./module-versioning#checking-an-artifact) to compare bytecode references against the UltiTools version you claim to support, not simply the one you compiled against. The manual tool is not the removed loader audit and does not prove runtime compatibility.
4. On a test server matching the new baseline, exercise commands with both player and console senders where applicable, localized output, screens and confirmations, scheduled tasks and reads of representative saved data. Check the start-up log as well as the features: admission is not proof that every call site works.

## Apply and recover on the server {#apply-and-recover}

1. After the last confirming 6.x start, stop the server. Replace old module JARs with the rebuilt versions in `plugins/UltiTools/plugins/`, keeping only the intended copy of each. Replace the framework JAR and start the server on the new Paper and Java baseline. A JAR change requires a full restart; `/ul reload` only reloads configuration and applicable message overrides.
2. As of v7.0.0, `/upm install`, `/upm update` and `/upm uninstall` queue changes for the next start. Review them with `/upm pending`, and undo an eligible request with `/upm revoke <module>` before restarting. An uninstall no longer stops the running module immediately. If a module adds custom enchantments, contributes tags or bundles data packs, [declare them in a bootstrap hook](./startup-phases#bootstrap-content) rather than in `registerSelf()`. Back up worlds before removing a module that provided this content and review the uninstall warnings.
3. Let start-up finish. As of v7.0.0, queued file changes are applied during bootstrap; installs and updates are only confirmed when the expected JAR and version load during enable. A failed or interrupted start can cause the framework to remove the unconfirmed install or restore the previous JAR for an unconfirmed update. Read the start-up log and `/upm pending` before retrying; entries requiring operator action are not revocable. See [Application and recovery at start-up](./module-versioning#application-and-recovery-at-start-up).
4. Module JAR recovery does not rewind data. A downgrade in place to 6.x is unsupported; if you need to return to 6.x, restore the matching pre-upgrade backup instead of reusing files written by 7.0.

## Standalone Paper plugins {#external-paper-plugins}

As of v7.0.0, a standalone Paper plugin that uses the [External Plugin API](./external-plugin-api) should also rebuild for the new baseline and migrate the UltiTools APIs it calls. Keep its `JavaPlugin` entry point and `UltiToolsAPI.connect(this)` in `onEnable()`, with the Paper plugin dependency on `UltiTools` declared in its descriptor. Install it as a Paper plugin, not as an UltiTools module.

The module JAR's integer `api-version` requirement, module bootstrap descriptor and `/upm` steps do not apply to that plugin. Its descriptor and loading are Paper's responsibility.

[module admission]: https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#module-api-floor-700-and-plain-module-loading-as-of-700
