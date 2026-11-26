# Module Versioning

This page describes the version number used by **your module**. `UltiTools-API` follows a different convention for its own version number, explained in [Differences from the framework's version](#differences-from-the-framework-s-version).

## Choosing the number

The deciding question is: after the server owner swaps in the new JAR, is there anything else they have to do?

| | Meaning | What the server owner does |
|---|---|---|
| MAJOR | The upgrade needs manual work | Edit configuration by hand, migrate data, learn a renamed or removed command or permission node, or upgrade UltiTools first |
| MINOR | New functionality, backwards compatible | Replace the JAR. Existing configuration keeps working; a new feature may need enabling in the configuration |
| PATCH | Fixes and internal changes, including CI and build-only changes | Replace the JAR. Nothing else |

The criterion is phrased as work rather than as size of change because the two are unrelated. Rewriting a module's internals is a PATCH as long as the configuration file and the commands stay the same, while renaming a single permission node is a MAJOR even though the change is one line, because every server that granted that node loses the permission.

### Checklist

- [ ] Does the server owner have to edit their configuration file? → MAJOR
- [ ] Does existing data need migrating? → MAJOR
- [ ] Was a command or permission node removed or renamed? → MAJOR
- [ ] Did `plugin.yml`'s `api-version` go up? → MAJOR
- [ ] None of the four, but there is new functionality? → MINOR
- [ ] None of the four, and no new functionality? → PATCH

The fourth item covers a case the first three miss, because nothing about the module itself has changed. Raising `api-version` means owners on the older framework cannot simply replace the JAR; they have to upgrade UltiTools first, which by the criterion above is a MAJOR. This holds even when the release is a rebuild with no source changes, and [Changed descriptors](#changed-descriptors) is the situation that produces such a release.

## Differences from the framework's version

`UltiTools-API`'s [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md) states that its version number is a product-stage signal rather than a strict semver contract, and that a MINOR release of the framework may remove an API.

::: tip Contributing to the framework itself, not just consuming it
If you plan to open a pull request against `UltiTools-Reborn`, note its contribution language policy differs from this site's: new comments, javadoc, workflow comments, and PR titles/bodies must be English-first with Chinese as a supplement.
A CI check enforces this over `src/main` comments/javadoc, workflow files, and one test package, against a small named allowlist visible in review.
This is the framework repository's own policy, not a requirement for this bilingual documentation site.
:::

This looks inconsistent with the rules above. It is not, and the difference is worth understanding first.

The framework's version is resolved and linked against. Maven uses it to select an artifact, and already compiled downstream plugins link to its classes at runtime. Both are compatibility questions, and a number that has to answer a compatibility question cannot be a free-form signal.

A module's version is also read by machines, but only to order two versions, never to judge compatibility:

| Consumer | What it does |
|---|---|
| `PluginManager.hasNewerVersionLoaded` | Code calls `PluginManager#register(...)` with another instance of a module that is already loaded (the same main class), so it compares the two versions and refuses the older one |
| `PluginManager.unregisterSupersededVersions` | In that same case, when the instance being registered is the newer one, unloads the loaded version it supersedes. As of v6.3.0 it goes through the full unload path, and an unload failure is logged against the old version without stopping the new one. Also as of v6.3.0, the old version's panel responders, EventBus handlers and tab completers are released before the new instance's container refresh and `registerSelf()`, so the new instance can claim the panel message types the old one held; if the new instance then fails to load, they are given back and the old version keeps running |
| `UpdateManager.checkModuleUpdates` | Compares the loaded version against the published one to report that an update is available |

All three go through `VersionComparatorUtil.compare` and ask whether A is greater than B. None of them looks at whether the difference is MAJOR, MINOR or PATCH.

Two JARs of one module in the modules folder do not reach the first two. All module JARs share one class loader, so both copies resolve to the same class and are never loaded side by side. Among API-admitted copies, which copy supplies the classes is decided by file name, not by version, as described in [Two copies of one module](#two-copies-of-one-module).

Nor does anything resolve one module from Maven for another module to use. None of the official modules declares a dependency on a sibling module in its pom. A module built as a multi-module project, such as the discontinued `UltiBot`, depends on its own submodules, which is internal to that build rather than one module depending on another. The linkage argument that constrains the framework's version number therefore does not apply to a module's. If you publish your own module for others to compile and link against, that argument starts applying to yours: your version number now has to answer a compatibility question, so what you need is a stricter contract that preserves compatibility, not the framework's looser one.

So the split is that the order of a module's version is machine-consumed while the meaning of MAJOR, MINOR and PATCH is not. That produces one mandatory rule and leaves the rest to the author's judgement.

::: tip The one mandatory rule
Versions must increase monotonically and stay comparable. Going from `1.10.0` back to `1.9.0`, or switching numbering schemes partway through, makes the update check miss a newer release or offer an older one, and makes a second registration of the module keep the wrong instance.
:::

Beyond that, the shape of the number is a message to the server owner, which is why its rules can differ from the framework's without either being wrong.

## The `UltiTools-API` pin

A module declares the framework as `provided`:

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>${ultitools.version}</version>
    <scope>provided</scope>
</dependency>
```

`provided` means the module compiles against the pinned version and runs against whatever framework is installed on the server. That asymmetry is central to how this works:

- Compiled against an older API, every symbol the compiler wrote into the bytecode exists in that version, so the module does not get a `NoSuchMethodError` for referencing something newer than the server provides. It can still get one for other reasons, described in [Compatibility breaks caused by the framework](#compatibility-breaks-caused-by-the-framework).
- Compiled against a newer API, the module may reference a method the server's framework does not have, producing a `NoSuchMethodError` the first time that call site is reached.

The scope of the first point matters. It describes statically linked references in one direction and is not a general guarantee: a later framework release can still remove or reshape something the module uses, and anything reached by reflection was never covered, because the compiler did not record it.

A pin that lags the latest release is therefore the normal state rather than drift to be corrected. Raise it only when the module actually starts using a newer API; moving to v7.0.0 is a new API baseline and requires rebuilding 6.x modules, as described in [Modules from 6.x to 7.0](#modules-6x-to-7).

### The pin and `api-version`

The pin is not the module's runtime floor. These are two independent numbers, and only one of them is checked:

| Number | Decides | Checked by |
|---|---|---|
| The `UltiTools-API` version in `pom.xml` | Which version's descriptors your bytecode records | Nothing. It is `provided`, does not enter the JAR, and the framework cannot read it at runtime |
| `api-version` in `plugin.yml` | The declared runtime floor | In 6.x, `PluginManager.isUltiToolsVersionCompatible` checks it when the module loads; this is the only framework version consulted before admission. As of v6.3.0, `/upm` also checks it when installing or updating a module. As of v7.0.0, `ModuleJarAdmission` checks the integer declaration and floor of `700` before main-class resolution; `PluginManager.isUltiToolsVersionCompatible` still checks whether a newer framework is needed. `/upm` checks the accepted range too; see [Version selection by API level](#version-selection-by-api-level) |

Raising the pin does not raise the floor. A gap between the two numbers is not itself a fault: bytecode built against a newer pin still runs on the declared floor as long as every member it references already exists there. What breaks is a JAR whose bytecode references a symbol the framework version named in `api-version` does not declare, because that server admits it and then fails when the call site is reached.

In 6.x, only `api-version` has anything to do with which framework versions the module can run on. More than this one number is checked before a module is admitted: the JAR is structurally validated first and, as of v7.0.0, `ModuleJarAdmission` checks the declaration before main-class resolution. Later, `passesCompatibilityGates` checks `!hasNewerVersionLoaded && isUltiToolsVersionCompatible`; the newer-instance check matters when code registers the same main class a second time through `PluginManager#register`. Of these checks, `api-version` declares the framework level, rather than proving that every referenced API exists.

## Compatibility breaks caused by the framework

An older pin provides only the guarantee described in the previous section. A module whose own code has not changed can still produce a linkage error, because what the bytecode links to is determined by the framework installed on the server rather than by the module's build.

::: warning A successful build does not mean compatibility
A successful build only shows that the source still compiles. What breaks an already published JAR is the descriptor recorded in its bytecode, and compilation does not show it to you.
:::

[The JLS chapter on binary compatibility][jls13] lists every change that can cause this. The examples below cover removed APIs (including the 7.0 native API migration) and changed descriptors that this project has shipped or announced; they are not a complete list.

### Removed API

A MINOR release of the framework may remove API, as described in `COMPATIBILITY.md`. Which linkage error you get depends on what was removed: removing a type produces `NoClassDefFoundError`, while removing a method, constructor or field produces `NoSuchMethodError` or `NoSuchFieldError`. The second case is not hypothetical, as the current removal list includes a constructor and not only types.

Raising the pin and rebuilding produces one of two outcomes, and you cannot tell which until you run it:

- The build fails. The removal is exposed here rather than on a server owner's machine, and you migrate away from the removed API.
- The build succeeds. Some surviving member absorbed the call, and the rebuilt artifact is already fixed.

Neither outcome repairs the JAR you have already published. That one keeps failing until you release the rebuild, which makes the second outcome the one to watch: a successful build looks like there is nothing to do, when in fact the fix is in your hands and has to be published.

A successful build is not hard to get, because this check only covers what the source names explicitly. Anything the source reaches implicitly may be resolved somewhere else:

- An overload absorbs the call. `m(String)` is removed, `m(Object)` remains, and unmodified source compiles against the surviving one.
- The removed type never appears in the source. In `factory.create().run()`, the return type of `create()` is inferred, so pointing `create()` at a replacement type still compiles cleanly while the old bytecode continues to reference the deleted one.

The cost only arrives if you publish the raised pin: building against a newer framework may record newer descriptors, which means raising `api-version` as well, which leaves behind every server still on the older framework. Raising the pin is therefore useful as a check and poor as a fix. Raise it in a throwaway build, see what fails to compile, migrate away from those APIs, then decide separately whether the released pin should move.

For APIs that carry deprecation notices, follow those notices and migrate before the removal is released. The 7.0 removals described below had no prior 6.x deprecation markers; v7.0.0 starts a new API baseline.

::: tip Reading a deprecation notice for its deadline
As of v6.3.0, every `@Deprecated(forRemoval = true)` member carries a machine-checked `{@removeIn X.Y.Z}` javadoc tag naming the concrete removal version.
A build-time check fails the framework's own CI if the member is still declared once the project version reaches that target, so the tag is an enforced promise, not just documentation.
See [`compatibility/DEPRECATIONS.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/compatibility/DEPRECATIONS.md) for every currently `ANNOUNCED` removal and its deadline in one place.
:::

### Modules from 6.x to 7.0 {#modules-6x-to-7}

As of v7.0.0, 6.x modules cannot load directly on 7.0. Update the build dependency to UltiTools-API 7.0, migrate removed APIs, rebuild against the target Paper, and declare an integer `api-version: 700` (or higher) in the JAR's root `plugin.yml`. Editing an old JAR's declaration alone does not repair references to removed APIs. A declaration above the installed framework's API level is still refused.

7.0 loads modules unchanged and retains a shared parent-first `URLClassLoader`, but removes load-time bytecode adaptation, server-API probing, and startup and offline linkage audits. Retained container-skip diagnostics describe observed missing classes and handlers; they do not mean the framework restores missing capabilities.

With a readable `plugin.yml` and a `main:` entry, these checks run before main-class resolution. An unreadable file or absent `main:` still receives the existing metadata refusal.

| Refused declaration | Meaning |
| --- | --- |
| Integer below `700`, such as `630` | Below the running framework's minimum; install a rebuilt module |
| Missing `api-version` | No valid declaration; the read value is `<missing>` in English or `<缺失>` in Chinese |
| Empty or non-integer, such as `'26.3'`, `1.21` or `abc` | No valid declaration; a bare `api-version:` shows `<missing>` in English or `<缺失>` in Chinese. An empty string (`api-version: ''`) and other values are shown in single quotes, such as `''` or `'1.21'`, rather than reporting a low level |

Missing and non-integer declarations share one message template; below-minimum integers use another. Quoted integers such as `'700'` are accepted too. These are the exact language-file templates, without the log prefix; `%s`, `%d` and the Chinese positional parameters are replaced at runtime with the JAR name, the declared or read value, the minimum and the running framework version (the order differs between the two templates):

`language: en`

```text
Module '%s' declares api-version %d, below the minimum %d required by UltiTools-API %s; refusing to load. Install a module rebuilt for the current UltiTools-API; changing api-version alone does not make an old module compatible.
Module '%s' has no valid api-version (read: %s); UltiTools-API %s requires an integer api-version of %d or higher -- refusing to load. Install a module rebuilt for the current UltiTools-API.
```

`language: zh`

```text
模块 '%s' 声明的 api-version 为 %d，低于 UltiTools-API %4$s 要求的最低级别 %3$d；拒绝加载。请安装针对当前 UltiTools-API 重新构建的模块；仅修改 api-version 无法使旧模块兼容。
模块 '%s' 未声明有效的 api-version（读到的值：%s）；UltiTools-API %s 要求模块声明 %d 或更高的整数；拒绝加载。请安装针对当前 UltiTools-API 重新构建的模块。
```

A JAR refused by the integer/minimum-level check (missing, non-integer or below `700`) is excluded from the shared class path and supplies neither main nor helper classes to other modules. Each refusal counts once in `Failed`; unrelated modules continue loading. If `m-6.3.0.jar` (630) and `m-7.0.0.jar` (700) declare the same main class, the old copy is refused and the new one supplies the classes even though its file name sorts later. The start-up duplicate warning still names both files and identifies `m-7.0.0.jar` as the JAR the classes load from. The framework does not delete the old file automatically. Among admitted copies, file-name ordering still applies; the module version does not select the newest copy.

Before upgrading the framework, let each pending `/upm update` complete one confirming startup on the old framework. Cancel unwanted updates first as described under [Updating and uninstalling](#updating-and-uninstalling-on-a-server) for 6.x: on the old framework, `/upm uninstall` also unloads the module and deletes its JARs, so back up files you need first. Do not carry an unconfirmed 6.x update into 7.0: API refusal can trigger the existing transaction rollback, and the restored old JAR is below 700 too. After completing or cancelling pending updates, stop the server, replace modules with their rebuilt 7.0 versions, keep only the intended JAR for each module, then upgrade the framework and start.

As of v7.0.0, install, update and uninstall requests take effect at the next restart. If your procedure relied on an immediate uninstall, queue the request and restart the server. You can [review and undo requests](#updating-and-uninstalling-on-a-server) before restarting.

### Native item and sound APIs in 7.0

::: warning Unreleased v7.0.0 migration
As of v7.0.0, the framework no longer supplies XSeries or a cross-version material and sound compatibility layer.
The 6.x instructions elsewhere on this site remain applicable only to those framework versions.
:::

Rebuild modules against 7.0 after replacing these removed public symbols:

| Removed in v7.0.0 | Replacement |
| --- | --- |
| `com.ultikits.ultitools.utils.XVersionUtils` | Direct Paper and Adventure calls; see the complete method table below |
| `com.ultikits.ultitools.entities.Sounds` | Paper `org.bukkit.Sound` |
| `com.ultikits.ultitools.entities.Colors#getCode()` | Native `Material.<COLOR>_STAINED_GLASS_PANE`, or the new 7.0 `Colors#getGlassPaneMaterial()` |

`Colors` itself remains available and gains `getGlassPaneMaterial()` as of v7.0.0; that getter does not exist in 6.x. `new ItemStack(Material.CYAN_STAINED_GLASS_PANE)` works on both 6.x and 7.0. As of v7.0.0, `ItemStackBuilder` is removed as a whole, including its entries with XSeries parameter types; see [Item construction and storage in 7.0](#item-construction-7).

To turn a material name into an item in 7.0, use `Material.matchMaterial`. It accepts current material names such as `DIAMOND` and namespaced keys such as `minecraft:stone`; there is no legacy-name lookup or fallback item. Reject `null`, block-only and air results before passing the material to `ItemSpec.builder`, as shown in [Item construction and storage in 7.0](#item-construction-7).

The following native replacements apply as of v7.0.0. Use `org.bukkit.Material`, `org.bukkit.Sound`, `org.bukkit.enchantments.Enchantment`, `org.bukkit.inventory.ItemFlag` and Adventure's `net.kyori.adventure.text.Component`:

| 6.x approach | Native replacement for 7.0 |
| --- | --- |
| XSeries material / `XVersionUtils` item factory | `new ItemStack(Material.STONE)`, or `itemRenderer.render(ItemSpec.builder(Material.STONE).build(), player)` |
| `XVersionUtils.getSound(Sounds.ENTITY_ENDERMAN_TELEPORT)` passed to `playSound` | `player.playSound(player.getLocation(), Sound.ENTITY_ENDERMAN_TELEPORT, volume, pitch)` (keep the caller's existing volume and pitch) |
| XSeries enchantment used for a hidden glow | `ItemSpec.builder(Material.PAPER).glint(true).build()`, then render it (visual glint without adding an enchantment) |
| `XVersionUtils.sendActionBar(player, "Ready")` | `player.sendActionBar(Component.text("Ready"))` |

Call sound and enchantment APIs during gameplay, not in static initializers or enum constructors. For a purely visual glint, use `ItemSpec.Builder#glint(true)`, or `ItemMeta#setEnchantmentGlintOverride(Boolean)` on an existing stack; neither adds an enchantment. For colored glass, use `new ItemStack(Colors.CYAN.getGlassPaneMaterial())`; existing GUI glass colors and button materials remain unchanged.

#### Replacing every XVersionUtils method

As of v7.0.0, replace all 15 public methods from the released 6.5.0 class as follows on Paper 26.3. Here `color` is a retained `Colors` value, and item constructors are `org.bukkit.inventory.ItemStack`. “No direct equivalent” means no single Paper call preserves the whole helper's behaviour; keep the stated checks in your own code.

| Removed 6.x method | Paper 26.3 replacement and behaviour to retain |
| --- | --- |
| `getColoredPlaneGlass(Colors color)` | `new ItemStack(Material.valueOf(color.name() + "_STAINED_GLASS_PANE"))`; for a fixed color use e.g. `Material.CYAN_STAINED_GLASS_PANE` |
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

### Item construction and storage in 7.0 {#item-construction-7}

::: warning Unreleased v7.0.0 item API
As of v7.0.0, `com.ultikits.ultitools.utils.ItemStackBuilder` is removed. Build items with `ItemSpec` and the injected `ItemRenderer`, then recompile.
:::

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

Stored items need no change in the module. `ItemStackUtils` keeps its five methods, reads strings saved by 6.x and writes a new format that 6.x cannot read; back up stored items before upgrading. See [Items and Item Storage](/guide/essentials/items).

### Scheduling and declarative GUI in 7.0

As of v7.0.0 (unreleased), two APIs change for module authors. Rebuild the module against 7.0 as described above.

- **Scheduling.** Inject `com.ultikits.ultitools.scheduling.Scheduler` with `@Autowired`; each module instance owns one, and unloading the module cancels its tasks. `@Scheduled` runs on it. Async repeating tasks run at a fixed rate, and tasks bound to an entity end when the entity is removed (for a player, on disconnect). See [Scheduler API](/guide/advanced/scheduled-tasks#scheduler-api). The framework's own work moving onto its scheduler requires no change in module code; its visible effects are listed under [Framework-scheduled work](/guide/advanced/scheduled-tasks#framework-scheduled-work).
- **Declarative GUI.** `DeclarativeGui` no longer inherits obliviate's `Gui`. The constructor takes the module's `UiService`, its `Scheduler` and a `Text` title with a fixed row count of 1 to 6; `InventoryType` constructors, `IconWrapper`, `RenderNodeDiffer`, `DiffResult` and `getPlayer()` (now `viewer()`) are gone; `ItemDisplay` takes an `ItemSpec`, and clicks use `onClick(GridAction)`. See [What changes in 7.0](/guide/advanced/declarative-gui#what-changes-in-7-0).

### Legacy chest pages and confirmation widgets in 7.0 {#legacy-chest-removal}

::: warning Unreleased v7.0.0 removals
As of v7.0.0, `abstracts.gui.BaseInventoryPage`, `abstracts.gui.BasePaginationPage`, `abstracts.gui.BaseConfirmationPage`, `widgets.Confirm`, `widgets.impl.ChatConfirm`, `widgets.impl.InventoryConfirm`, `entities.Buttons` and `entities.ViewType` (all under `com.ultikits.ultitools`) and `DependenceManagers#initInventoryAPI` are removed, with no deprecated bridge. A module that references one of them does not compile against 7.0, and a module built against 6.x fails to load on 7.0. Rebuild it against 7.0.
:::

The framework JAR no longer bundles obliviate-invs or UniversalScheduler. 6.x did not relocate them, so a module that used `mc.obliviate.*` or `com.github.Anon8281.*` directly was using the framework's copies; it must package those libraries itself or rewrite that code. `Colors` remains.

| 6.x | 7.0 |
|---|---|
| `BaseInventoryPage` | `DeclarativeGui`, see [Declarative GUI](/guide/advanced/declarative-gui) |
| `BasePaginationPage` | A `State` that holds the page number and a `GridView` that shows the slice, see [Declarative GUI](/guide/advanced/declarative-gui) |
| `BaseConfirmationPage`, `Confirm.gui(...)` | `Confirm` of the UI service, see [UI: Intents and Sessions](/guide/advanced/ui-service#notice-and-confirm) |
| `Confirm.chat(...)` | The module sends its own clickable chat prompt, see [UI: Intents and Sessions](/guide/advanced/ui-service#chat-confirmation) |
| `Buttons`, `ViewType` | No replacement type; use a `TextButton` label or the framework label keys |

The 6.x pages are still described, as 6.x material, in [GUI Interface](/guide/advanced/gui).

### Toasts and holograms in 7.0

::: warning Unreleased v7.0.0 removals
As of v7.0.0, `com.ultikits.ultitools.widgets.Toast`, `NotificationService#sendToastNotification` and `com.ultikits.ultitools.widgets.Hologram` are removed.
Migrate the callers as described below, then rebuild them against 7.0.
:::

**Toasts.** The advancement-based popup depended on deprecated, version-unstable server internals, and message text containing quotes could break its generated JSON. There is no replacement helper. `NotificationService` offers `sendTitleNotification`, `sendSubTitleNotification`, `sendActionBarNotification`, `sendBossBarNotification` and `sendMessageNotification` (a chat message); some overloads also take a `Sound`. Use one of these, or chat, instead. In 7.0 these methods take `Text` and Adventure types; see [Notification service in 7.0](#notification-service-7).

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

### Notification service in 7.0 {#notification-service-7}

::: warning Unreleased v7.0.0 notification API
As of v7.0.0, `NotificationService` takes `Text`, `Duration` and Adventure types, and every method returns `void`.
Modules compiled against 6.x are not binary compatible with it; migrate the calls and rebuild.
:::

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

### Text and languages in 7.0

::: warning Unreleased v7.0.0 text engine
As of v7.0.0, modules ship `messages/<locale>.yml` catalogues and send text through the injected `Messages` service.
6.x language files are not converted; the `i18n(...)` path still works for now.
:::

- **Language files.** Move texts to `src/main/resources/messages/<locale>.yml` with lowercase dotted keys and MiniMessage values. `§` and `&` colour codes are not interpreted there, and only `.yml` files are read. Re-create the texts; the 6.x `lang/` files, sentence keys and custom language names are not converted.
- **Source language.** Declare `source-language` in the module's `plugin.yml` if the module's own texts are not English; it defaults to `en`.
- **Sending text.** Inject `com.ultikits.ultitools.text.Messages` with `@Autowired`, build keys with `messages.key(path)` and send with `messages.send(...)`, so each player sees their own client language. Pass player or operator input as `Arg.string`, never as part of a template. Use `messages.shared(Text)` for entity names, text displays and shared boss bars.
- **Defaults.** New installations ship `language: auto` and `fallback-language: auto`; on a host whose time zone is not a China zone, the console and the fallback are English. See [Language selection](/guide/essentials/messages#language-selection).

The `i18n(...)` path, `getLanguageCode()` and `getConfiguredLanguage()` remain in 7.0 while callers migrate; their removal is a separate, later change. See [Messages and Languages](/guide/essentials/messages).

### Changed descriptors

This situation is harder to notice, because nothing is removed and there is nothing to mark as deprecated. A method's descriptor covers both its parameter types and its return type, so a change to either produces a different symbol under the same name.

This has happened twice.

**6.1.1 to 6.2.0, a MINOR release.** Removing Spring changed the type of a field on `UltiToolsPlugin`, and the return type of the Lombok-generated `getContext()` changed with it. Every already compiled module calling that method received a `NoSuchMethodError`. Nothing was removed and nothing was marked deprecated; in the source it reads as internal cleanup. The same applies to a public field whose type changes: the compiled `getfield` still carries the old descriptor and fails with `NoSuchFieldError`.

**6.2.0 to 6.2.1, a PATCH release.** Replacing `AbstractDataEntity` with `BaseDataEntity<String>` across the data APIs changed the descriptors of 14 public members across 5 types: `DataOperator`'s `exist(T)`, `getById`, `insert(T)` and `update(T)`, `Query`'s `first()`, and their implementations. Nothing was removed and nothing was added, and every affected member kept its name.

The second case occurred in a PATCH release, which shows that no version level is exempt. The version policy schedules intentional removals, so an unintended binary break is by definition unscheduled, and PATCH is not an exception.

A module that only uses `.query()….first()` calls none of the `DataOperator` methods and is affected all the same, so a list organised around `DataOperator` would not cover it.

#### Both directions

When a symbol keeps its name and changes its descriptor, both directions are affected. The same module, from the same source, with only the pin changed:

| Pin used at build time | On framework 6.2.0 | On framework 6.2.1 and later |
|---|---|---|
| 6.2.0 | Works | `NoSuchMethodError`, looking for `(AbstractDataEntity)`, which no longer exists |
| 6.2.1 | `NoSuchMethodError`, looking for `(BaseDataEntity)`, which does not exist yet | Works |

Rebuilding against the newer framework is therefore not a fix that leaves older servers where they were; it changes which side works. Both directions fail for the same reason, so the handling depends on which generation of type the missing symbol names, described in [Reading the output](#reading-the-output).

#### What has to be released

Rebuilding alone is not enough. With the pin still on the old version, the build regenerates the old descriptor and the new artifact fails in exactly the same way. As long as you keep the original direct call site, you have to raise the pin to a framework version carrying the new descriptor and rebuild. The third option below avoids that condition.

That covers only half of it, and by the table above, the half that is not checked. The rebuilt JAR now records the new descriptor, so it throws `NoSuchMethodError` on frameworks older than that one. If `api-version` stays where it was, an older server admits the new JAR and then fails on the first call. `api-version` therefore has to be raised as well, which by the checklist at the top of this page makes that release a MAJOR.

Raise it to what the artifact actually requires rather than mechanically following the pin. Raising the pin does not by itself mean the output needs the newer framework: if the rebuild only redirected a call onto a member that exists in both versions, or you raised the pin only to run a check, the bytecode may still run on the original floor, and raising `api-version` would turn a compatible repair into an unnecessary MAJOR release. The next section describes how to confirm this. Following the pin is the conservative choice when you have not confirmed it.

### Checking an artifact

Whether a given JAR can run on framework X is something you can confirm. The way to confirm it is not to rebuild, but to compare the symbols the bytecode references against what that framework actually declares:

```bash
# run from a checkout of UltiTools-Dev-Doc
python3 scripts/symcheck.py your-module.jar UltiTools-API-<the floor you declare>.jar
```

An exit code of 0 means no symbols are missing. A non-zero exit code lists what is missing, and the JAR will fail on that framework the first time it reaches one of those call sites.

Compare against the version you declare in `api-version`, not the one you pinned. These are different questions, and the first is the one your users will encounter.

This `scripts/symcheck.py` is a manual symbol-comparison tool in the docs repository, not the removed framework startup or offline server-linkage audit. Passing it does not replace the v7.0.0 integer floor of 700 or the rebuild requirement.

#### Reading the output

First distinguish two situations, because they need different work:

- The name is gone entirely, with no overload surviving, or the class itself is absent. This is a removed API. Consult that release's removal list; what you need is a source migration.
- A symbol of the same name is still there with a different descriptor. This is a changed descriptor, and only then does the table below apply.

For a changed descriptor, look at which generation of type the missing symbol names:

| The missing symbol names | Meaning | What to do |
|---|---|---|
| The newer type, such as `BaseDataEntity` | The artifact needs a higher version than the floor it declares | Raise `api-version`; the pin does not need to change |
| The older type, such as `AbstractDataEntity` | The pin stayed on an older version, so the output is older than the declared floor | Raise the pin and rebuild. Raising `api-version` does not help here and makes matters worse |

These two are easy to confuse and the responses point in opposite directions, so it is worth reading the symbol itself first.

The script cannot make this decision for you. It receives one module JAR and one framework JAR, so it can confirm that a symbol is absent but not why, and it never sees your pin.

There are two more situations the script states rather than guesses at. A reference whose hierarchy leaves both JARs is listed as inconclusive and does not affect the exit code; this happens when a framework class inherits from a type the API JAR does not bundle, such as a server API or a UI library, in which case a module calling the inherited method is behaving normally. And if `javap` itself fails, the script stops rather than analysing incomplete output.

A manual check runs into one more detail: the constant pool records the static type of the receiver at the call site, not the class that declares the member. When you call an inherited framework method from your own plugin class, the recorded owner is your own class, in the form `com/example/MyPlugin.getContext:()…`. Filtering for references whose owner is already inside the framework's package therefore misses every inherited call, and since plugins extend `UltiToolsPlugin`, those account for most of them.

::: tip The limits of a manual check
Running `javap -s` on a single class shows the descriptor of a member, but the question here is whether anything in the whole JAR references a symbol the target framework does not have, which requires comparing two artifacts.
:::

### Supporting two framework versions at once

What cannot cover both sides is a statically linked call site, because the descriptor is fixed at compile time and one call site matches one side. There are three options, in increasing cost:

1. Accept the higher floor. This is the default choice: older servers stay on the older JAR, and the new one serves the new framework.
2. Publish separate artifacts per framework range and maintain both lines.
3. Write an adapter layer, either calling reflectively (`getMethod("getContext").invoke(plugin)` returns `Object`, and `getBean` is reached the same way) or lazily loading a different adapter per framework version. A reflective call site links to neither descriptor, so a single artifact can run on both sides. The cost is that this path loses compile-time checking: problems surface at runtime, and the next time the framework reshapes that member there is no build warning at all.

The third option is workable and should not be ruled out simply because it is listed last, but it trades a build-time failure for a runtime one, so it is worth taking only when older servers genuinely have to keep working.

This also shows the scope of the rule that a lagging pin is normal. That rule says not to move the pin without a reason, and a changed descriptor is a reason, as are the other situations the process above points back here.

### Other linkage errors

If the linkage error you have is neither of the two situations above, it belongs to one of the other JLS categories. Making an instance method `static` produces `IncompatibleClassChangeError`, narrowing a member's accessibility produces `IllegalAccessError`, and there are more. One question sets the direction: did the framework remove something?

- Yes. It should appear on the removal list. If it does not, please open an issue; that is a gap in the process rather than a problem only on your side.
- No. Try the rebuild path above: raise the pin, rebuild, raise `api-version`. If the rebuild **fails to compile**, the change broke source compatibility as well, and what you need is a migration rather than a rebuild.

As of v6.3.0, a framework API linkage error naming a type under `com.ultikits.ultitools` when loading the module's declared main class produces one English `SEVERE` line with the JAR name, `plugin.yml`'s `version` and `api-version` (when declared), and the original exception message after `Cause:`. `built against an older UltiTools-API version` means you should upgrade the module to a release built for the current framework and consult `COMPATIBILITY.md`; if the declared `api-version` is higher than the installed framework's, the message instead says `requires a newer UltiTools-API`, so upgrade the framework. The full stack trace is logged only at `FINE` (hidden by Paper's default logging), and this refusal is not sent as a panel error report. Missing third-party or Bukkit classes still produce the generic `SEVERE` error with a stack trace. As of v6.3.2, the diagnostic links directly to the public compatibility record, both here and in the skipped-class summary. For example, UltiLogin 1.0.0 on v6.3.2:

```text
[UltiTools-API] Module 'UltiLogin-1.0.0.jar' (version 1.0.0, api-version 620) declares main: 'com.ultikits.plugins.login.UltiLogin', but it was built against an older UltiTools-API version and is not compatible with this one -- refusing to load. Upgrade it to a release of the module built for the current UltiTools-API version -- see https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md for the list of APIs removed or changed in this release. Cause: java.lang.IncompatibleClassChangeError: class com.ultikits.plugins.login.UltiLogin overrides final method com.ultikits.ultitools.abstracts.UltiToolsPlugin.unregisterSelf()V
```

As of v6.3.0, a module refused this way is counted in the `Failed` number of the start-up summary `[UltiTools-API] Succeeded loaded <s>, Failed <f>.`, as is every other module JAR of that start that did not load: one refused while its main class is read, one excluded for a missing required plugin or a dependency cycle, and one whose registration failed. A second API-admitted copy of a module that did load is not counted; as of v7.0.0, an API-refused copy still counts once in `Failed`. When every JAR in the modules folder is refused, the summary reads `Succeeded loaded 0, Failed <n>.`; `No UltiTools plugin found.` appears only when the folder holds no module JAR. Before v6.3.0 the summary counted only modules that reached registration, so a start that refused a module could still print `Failed 0`.

As of v6.3.0, a module whose main class still overrides `unregisterSelf()` or `reloadSelf()`, both `final` since 6.3.0, is refused whole at load with the `built against an older UltiTools-API version` line above, and a module that names it in `@PluginDependency(depends = ...)` is refused too, as for any missing hard dependency. A module that lists it only under `softDepends`, `loadBefore` or `loadAfter` still loads, and so does every unrelated module. The fix is a release of the module built for the current UltiTools-API version; module authors move the override's work to `onUnregister()` or `onReload()`.

[jls13]: https://docs.oracle.com/javase/specs/jls/se21/html/jls-13.html

### New annotation attributes

A missing method or field fails loudly with a linkage error. A missing annotation attribute does not: the JVM drops any attribute the running annotation type does not declare, and nothing is logged. As of v6.3.0, `@Scheduled(config = ..., periodKey = ..., delayKey = ...)` and `@CmdCD(config = ..., key = ...)` read an interval or cooldown from a config key. A module that uses them still loads on a 6.2.x framework, where a bound `@Scheduled` runs once at load instead of on its interval and a bound `@CmdCD` enforces no cooldown.

Raising the pin does not prevent this, for the reason given in [The pin and `api-version`](#the-pin-and-api-version). In 6.x, a module using either binding must declare at least `630` (`api-version: 630` for 6.3.0), so that an older framework refuses it at load. As of v7.0.0, every module must instead be rebuilt against 7.0 and declare at least `700`, whether or not it uses bindings. To surface the mistake on the version you develop against, 6.3.0 itself refuses a module that uses a binding while declaring a lower `api-version`, naming the module, the binding and the required floor. Existing literal usages such as `@Scheduled(period = 6000)` and `@CmdCD(60)` are unaffected and need no change.

## Two copies of one module

As of v7.0.0, API-refused JARs do not participate in the class-loading order below and each counts once in `Failed`; an old refused copy cannot shadow an admitted new copy. The framework does not clean up old copies automatically; keep only one.

As of v6.3.0, UltiTools reads the JARs in `plugins/UltiTools/plugins/` in file-name order, compared as plain strings, and builds the module class loader in the same order. Before v6.3.0 the order was whatever the file system listed, which Java does not define, so the same folder could load a different copy on another machine.

A module JAR is identified by the `main:` entry of its `plugin.yml`. When two or more admitted JARs declare the same `main:` class, the class comes from the first of them in that order that carries it, and the other copies are refused. When at least one JAR supplies the classes, one warning at start-up names every copy declaring that main class, including API-refused copies as of v7.0.0, and the JAR the classes load from:

```text
[UltiTools-API] These JAR files all declare the same module main class com.example.MyModule: MyModule-1.0.0.jar, MyModule-1.1.0.jar. The module's classes load only from MyModule-1.0.0.jar; the other copies are not loaded. Keep only one of them.
```

As of v7.0.0, only that first copy's early hook can run at start-up, once; see [Start-up Phases and Early Hooks](/guide/advanced/startup-phases#duplicate-copies-and-order).

The version numbers play no part here. In the example the older `1.0.0` keeps running because its file name sorts first, whatever the two `plugin.yml` files say. Before v6.3.0 each refused copy logged its own error line instead of this one warning.

From v6.3.0 through the rest of 6.x, `/upm uninstall` identifies JARs whose `plugin.yml` `main:` names the module’s main class, regardless of their declared `name:`, and lists deleted files in its reply. As of v7.0.0, the command lists the identified JARs queued for deletion rather than deleting them while the server runs. At restart, it checks that the files still match the record.

`/upm update` refuses to update a module while such a copy would win. As of v6.3.0, before it downloads anything, it looks in the modules folder for another JAR that declares the module's `main:` and whose file name sorts before the new JAR's name. As of v7.0.0, an API-refused copy is not a class-path blocker for this check. If it finds one, the new version could never load there: the copy would keep supplying the classes and the update would be rolled back at every start. So the command stages nothing, and its reply names the new JAR and every such copy. After moving those copies away, you can retry `/upm update` without restarting first. Applying the queued update still requires a restart. A copy that sorts after the new JAR does not stop the update, and the start-up warning above still names it.

## Version selection by API level

As of v6.3.0, `api-version` is consulted twice: by the module loader at start-up, as described in [The pin and `api-version`](#the-pin-and-api-version), and by `/upm` when it installs or updates a module from UltiCloud.

UltiCloud reads `api-version` from the `plugin.yml` of every JAR published to it and stores it with that version. A JAR without an integer `api-version` is refused at upload, as described in [UltiKits CLI](/guide/advanced/ultikits-cli#the-module-s-api-level). Versions published before UltiCloud read the level are recorded as built for a framework before 6.3.0.

Which versions a server is offered and installs depends on the framework it runs:

| Server runs | Versions offered and installed |
|---|---|
| UltiTools-API 7.0 onward | Integer `api-version` from 700 up to the framework's own API level (700 for 7.0.0) |
| UltiTools-API 6.3.0 through 6.x | `api-version` from 630 up to the framework's own API level (630 for 6.3.0) |
| UltiTools-API before 6.3.0 | `api-version` below 630 only |

A server on 6.3.0 through 6.x sends its level (`apiLevel`, and `minApiLevel=630`) when it looks up a module's versions: in 6.3.0 with every catalogue request, as of v6.3.1 only on the module versions route. A framework before 6.3.0 sends none, and UltiCloud treats such a request as coming from a framework before 6.3.0, so released 6.2.x servers are not offered a 6.3.0 build. This applies to `/upm install`, `/upm install <module> <version>`, `/upm versions`, `/upm update` and the update check at start-up. The update check reports only a version this server can install and never mentions one that needs a newer UltiTools-API. `/upm list` still lists every module in the catalogue; Install on a module with no compatible version replies with the reason.

From v6.3.2 through the rest of 6.x, `/upm check`, `/upm update <module>` and `/upm update all` reply `Update check still running; try again in a few seconds.` until the startup check completes, including before its manager exists. They do not consume partial results; update commands download and stage nothing during this time. These commands read the completed startup result, not a new check: wait for completion and retry. A completed check with failed lookups instead reports `Update check incomplete: could not confirm the latest version of <names>.`.

As of v7.0.0, module version requests carry `apiLevel` and `minApiLevel=700`. `/upm install` and `/upm update` use the same integer parser and floor of 700 after downloading; downloads above the framework's own level are still refused. `/upm update <module>` can proceed before the start-up update check completes if an existing queued change identifies the module. `/upm check` and `/upm update all` still wait for the check.

The download locations, 630 range and reply examples below apply to 6.x. `/upm` also checks what it downloads. `/upm install` writes the JAR into the modules folder as `<id>-<version>.jar.part`, a name the module loader never reads, and reads its `plugin.yml` again; `/upm update` makes the same check on the copy it downloads into `.ultikits/upm-transactions/`. A module whose `api-version` is absent, not an integer, below 630 or above the framework's level is refused: the download is deleted and nothing is written to the modules folder. For `/upm update` the staged download is discarded and no update is recorded. The reply names the declared level, the framework's level and the accepted range. With `language: en`:

```text
Cannot install ultirecipe: UltiCloud has no version of it that this server can install. This UltiTools-API is at API level 630 and installs only modules declaring api-version 630 to 630. Nothing was written to the modules folder.
Refused to install ultirecipe 1.0.0: the downloaded JAR declares api-version 620. This UltiTools-API is at API level 630 and installs only modules declaring api-version 630 to 630. The download was deleted; nothing was written to the modules folder.
No version of ultirecipe can be installed on this server. This UltiTools-API is at API level 630 and installs only modules declaring api-version 630 to 630.
```

The first line answers an install when UltiCloud reports that no version is compatible, the second an install whose download declares another level, and the third `/upm versions` with no compatible version. An update that is refused for the same reason replies `The update of <module> was not staged:` followed by the reason.

This has three consequences for a module author:

- Declare `api-version: 630` as an integer for the module to be installable through `/upm` on 6.3.0. A build for 6.2.x (`api-version: 620`) is refused by `/upm` on 6.3.0. Every first-party module built for 6.2.x overrides `UltiToolsPlugin.unregisterSelf()`, which 6.3.0 made final, so those builds could not load anyway.
- Raising `api-version` above 630 hides the version from servers whose framework level is lower, in addition to the loader refusing it there.
- A JAR an operator copies into the modules folder by hand is judged only by the loader rule; `/upm` is not involved.

`PluginInstallUtils.installLatestPlugin`, `installPlugin` and `updatePlugin` keep their signatures and return `false` for a module refused this way.

::: warning A catalogue that does not filter
With a catalogue that ignores `apiLevel`, such as a self-hosted `api-url`, `/upm versions` and the update check can list a version that `/upm install` or `/upm update` then refuses after downloading it.
The post-download check is what protects the server in that case.
:::

## Updating and uninstalling on a server

As of v7.0.0, `/upm install`, `/upm update` and `/upm uninstall` queue changes for the next restart. Running modules keep working until then. An uninstall request does not disable the module immediately, and `/ul reload` does not apply the queue. To stop a module urgently, queue its uninstall and restart the server.

### Commands and pending changes

As of v7.0.0, operators (OPs) and the server console can run these commands. The new `pending` and `revoke` subcommands do not require separate permission nodes.

| Command | Action |
| --- | --- |
| `/upm install <module>` or `/upm install <module> <version>` | Stage a compatible catalogue version or the specified version. Installing a different version of a running module counts as an update. |
| `/upm update <module>` or `/upm update all` | Stage an update for one module or for all modules with available updates. |
| `/upm uninstall <module>` | Queue the identified JARs for deletion and list their names in the reply. |
| `/upm pending` | List changes, download status and the results of applying changes at this start. |
| `/upm revoke <module>` | Undo an unapplied change for that module or cancel an in-progress download. |

The pending list shows at most one entry per module. A successfully staged different version replaces a pending install or update; requesting the same pending version changes nothing. Requesting an install of the running version cancels its pending update or uninstall, or changes nothing if neither is pending.

Uninstall replaces a pending update. If a module is only waiting to be installed, uninstall cancels the install without queuing a deletion. Uninstall also cancels an in-progress download for the module, even if an uninstall is already queued. An ordinary update does not override a pending uninstall: revoke it first, or use `install` to specify the version to keep.

When changes are pending, each OP gets one reminder on joining per server run. Adding or replacing a change can trigger another reminder the next time that OP joins; it does not notify OPs who stay online. At each OP's first join after a restart, they also get a summary if changes were handled at that start. Run `/upm pending` for the individual results.

### Application and recovery at start-up

As of v7.0.0, install and update stage downloads in `.ultikits/upm-transactions/` under the server root and check the JAR's module identity, version and API level without modifying the modules directory. A new install in 6.x could overwrite a file of the same name. In 7.0, if that file already exists, a new install is refused before downloading or queuing anything, and the file is left untouched. Move or delete it before retrying. If a conflicting file appears after queuing, start-up leaves it in place and records the failed install.

On restart, the framework processes removals before applying installs and updates in the [bootstrap phase](/guide/advanced/startup-phases), before building the module class loader. If a JAR queued for deletion no longer matches the recorded file, the framework leaves it in place, drops its deletion and asks you in the start-up log to run `/upm uninstall` again if needed. The JAR can still load.

An install or update is kept only if the module loads from the target JAR at the expected version. Otherwise the framework rolls back the change: it removes a newly installed JAR from the modules directory or restores the previous JAR for an update, and reports the result in the start-up log. A failed bootstrap hook also triggers rollback for a new install. If a JAR is held open and cannot be removed, the log warns you and recovery continues at the next start.

If start-up is interrupted, the framework uses the retained transaction record to finish or roll back the change at the next start. An unconfirmed install or update does not count as successful. Entries marked as failed remain visible in `/upm pending` but cannot be revoked; the next change request for that module reports the earlier failure. Entries that require operator action cannot be revoked either; check the files named in the start-up log.

### Known limitations

- As of v7.0.0, both install and update rely on atomic moves: the modules and transaction directories must be on the same file system.
- As of v7.0.0, the pending changes' transaction records are not flushed with `fsync`; a power loss or system crash can lose the most recently queued request, so check `/upm pending` after restarting.

### Updates and uninstalls in 6.x

As of v6.3.0, `/upm update <module>` no longer replaces the JAR while the server runs. It downloads the new version into `.ultikits/upm-transactions/` under the server root and records it, and nothing in the modules folder changes until the next start. At that start, before any module loads, the old JAR is moved aside and kept and the new JAR is moved in. After the modules load, the update is kept only if your module is loaded from the new JAR at the new version; otherwise the new JAR is removed, the old JAR is put back, and the start-up log names both versions and says the restored version loads at the next start.

This has two consequences for a module author:

- The new JAR must declare in `plugin.yml` the version UltiCloud offers for it. A download that declares another version is refused before anything is recorded.
- A release that fails to load, for example because of a linkage error or an exception from `registerSelf()`, is rolled back rather than left installed.

A move that fails, such as a read-only folder or a file held open, leaves the modules folder unchanged and the current version loads. The start-up log reports it, and the next `/upm update` of that module reports it again. When `plugins/` and the server root are on different file systems the move is refused, with one error line naming both folders.

As of v6.3.0, an update only ever moves, replaces or deletes a file whose SHA-256 matches its record: the downloaded JAR, or the old JAR it kept aside. If something else has changed one of those files, or put a file where the update needs a free place (for example a copy under the new JAR's name), the update does nothing to any file. It keeps its record in a state that means "on hold for the operator", and the start-up log names each unexpected file with the hash it expected and the one it found. Later starts repeat that line and do nothing else, and `/upm update` and `/upm uninstall` of that module refuse until you resolve it. To resolve it, check the named files, take back any JAR you need from `.ultikits/upm-transactions/`, then delete the update record named in the line and the folder of the same name.

In 6.x, `/upm uninstall <module>` unloads every loaded instance through the framework's full unload path, deletes the module's JARs, and cancels any update of it still waiting for the next start, whichever of the module's names it was given. A JAR it cannot delete now, for example on Windows where the running server keeps every module JAR open, is recorded and deleted at the next start before any module loads.

As of v6.3.0, before the next start deletes a recorded JAR it confirms that the file is still the one the uninstall recorded. If it cannot read the JAR to confirm that, it leaves the JAR in place, so the module can load again at that start, reports the JAR and the read error in the start-up log at SEVERE level, and keeps the deletion recorded for the start after.

If the deletion cannot be recorded either, for example on a read-only file system, the reply to `/upm uninstall` names only the module JARs to delete by hand and says on a separate line that the deletion could not be recorded, so the next start will not delete them.

If a module's own unload hook throws, including a checked exception it does not declare, the framework still releases everything the module registered: its commands, listeners, scheduled tasks, tab-completion completers, EventBus handlers and panel responders, and its container is closed. The reply to `/upm uninstall` is then an error line saying the module was removed from the loaded modules but its unload threw (details are in the console), followed by a line saying the module's JARs were deleted.

## Current state of the modules

For UltiTools-API 6.3.0 every first-party module released a new MAJOR version: `2.0.0`, and `3.0.0` for UltiEconomy. Before that, two of them had made a decision before this page existed and reached opposite conclusions: one used MINOR for a bug fix, the other MAJOR for a new feature, and neither matches the table above. Those earlier versions were not renumbered retroactively, because a published version number may already have been written down by server owners.
