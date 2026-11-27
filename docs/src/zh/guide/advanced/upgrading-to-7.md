# 从 6.x 升级到 7.0

7.0.0 尚未发布。本指南介绍自 v7.0.0 起的变更，概览见 [7.0.0 更新说明](../release-notes/7.0.0)。

按本指南迁移 UltiTools 模块源码并重新构建 JAR。如果你维护的是调用 UltiTools 的独立 Paper 插件，请同时阅读[独立 Paper 插件](#external-paper-plugins)。

## 升级前准备 {#before-upgrade}

1. 更换版本之前先备份服务器。成套保留旧框架和模块 JAR、配置、世界存档及模块数据。备份文件或数据库中的库存和序列化物品字符串：[7.0 写入的物品数据](#item-migration)无法用 6.x 读取。
2. 在**旧 6.x 框架**上，让每个待生效的 `/upm update` 完成一次启动确认，再安装 7.0。这一步适用于已暂存、但还没有在 6.x 上启动确认的更新。如果把它带入 7.0，新框架可能拒载暂存的 JAR，触发回滚；恢复出来的 6.x JAR 也低于新 API 下限。继续前先检查 6.x 启动日志。见[兼容性政策中的待生效更新限制][module admission]。

如果不想保留已暂存的 6.x 更新，先阅读 [6.x 的更新与卸载](./module-versioning#_6-x-的更新与卸载)。6.x 的 `/upm uninstall` 不只是撤销更新：它还会卸载模块并删除模块 JAR。

## 构建目标与模块准入 {#build-target}

自 v7.0.0 起，目标环境是 **Paper 26.3 build 258 与 Java 25**。使用 Java 25 工具链，设置 Java 25 编译目标，依赖 `com.ultikits:UltiTools-API` 7.0 和 `io.papermc.paper:paper-api:26.3.build.258-stable`。框架与 Paper API 由服务器提供，用 Maven `provided`（Gradle `compileOnly`），不要打进模块 JAR。检查原先依赖 UltiTools 供应的其他库。需要留在旧环境时，见[支持 1.21 以下的服务端](./older-servers)。

在模块 JAR 根目录的 `plugin.yml` 中声明 UltiTools API 级别：

```yaml
api-version: 700
```

自 v7.0.0 起，准入范围是 `700` 到运行中的框架 API 级别，含两端，且必须为整数。这不是 Paper 的 `api-version: '26.3'`。只修改旧 JAR 的声明无法修复对已删除 API 的引用。UltiTools 仍用共享的、优先委派给父加载器的 `URLClassLoader`，按原样加载重新构建的 JAR，不再改写字节码、探测服务端 API 或执行启动及离线链接审计。容器跳过诊断只报告实际遇到的缺失符号，不会补全缺失的能力。

存在可读的元数据与 `main:` 条目时，整数和下限检查在解析主类之前执行。若 `plugin.yml` 无法读取或没有 `main:`，先修正元数据。启动日志区分以下准入问题：

| 声明 | 检查项 |
| --- | --- |
| 缺失或不是整数 | 日志含 `未声明有效的 api-version`（英文：`has no valid api-version`）。缺少键或只写键不带值时，显示 `<missing>`（英文）或 `<缺失>`（中文）；`''`、`'26.3'`、`'1.21'` 或 `'abc'` 等值带引号显示。带引号的整数（如 `'700'`）也有效。 |
| 整数低于 `700`，如 `630` | 日志列出声明值和下限；可搜索 `要求的最低级别`（英文：`below the minimum`）。请安装重新构建的 JAR。 |
| 整数高于运行中的框架 API 级别 | 已安装的框架版本低于模块声明所需的级别。 |

因整数或下限检查被拒的 JAR 不会为其他模块提供主类或辅助类，且只计入一次 `Failed`。拒载不会阻止其他符合条件且不依赖被拒模块的模块加载。例如，若 `630` 和 `700` 的两份 JAR 声明同一个主类，即使 `700` 的文件名排序在后，也可由它提供类。警告仍会列出两个副本；框架不会自动删除文件。当多个副本均符合准入要求时，[仍按文件名排序](./module-versioning#同一模块的两个副本)。

依赖其他服务端插件时，在模块描述文件的 `depend` 或 `softdepend` 中声明提供方。见[其他插件的类](./startup-phases#其他插件的类)与[运行库](./startup-phases#运行库)。

## 已删除的公开 API {#removed-public-apis}

在重新构建之前，按下表查找需要替换的 6.x 调用和类型。左栏是自 v7.0.0 起不再可用的 API，而不是仅标记为弃用的 API。

| 7.0 已删除的 6.x API | 7.0 替代写法 |
| --- | --- |
| `AbstractCommand`、`AbstractTabExecutor`、`AbstractPlayerCommandExecutor`、`AbstractConsoleCommandExecutor` | 继承 `BaseCommandExecutor`，需要限制发送者类型时用 `@CmdTarget`；见[命令](#command-migration)。 |
| `i18n(...)`、`MessageUtils`、`Localized`、`Language`、`FrameworkText`、`OfficialLanguageFiles` 和旧语言 getter | 注入 `Messages`；确实需要服务器后备语言时，用 `LocaleResolver#fallback()`。 |
| `@I18n`、`@UltiToolsModule(i18n = …)` 和 `supported()` | 删除声明、覆盖和调用，随模块打包 `messages/<locale>.yml`。 |
| `XVersionUtils`、`Sounds`、`Colors#getCode()` | 改用 Paper 与 Adventure API；用 `Colors#getGlassPaneMaterial()` 取玻璃板 `Material`。见[原生物品与音效](#items-and-sounds)。 |
| `ItemStackBuilder` | 构建 `ItemSpec` 后调用 `ItemRenderer#render(ItemSpec, Audience)`，或直接创建并编辑原生 `ItemStack`。 |
| `BaseInventoryPage`、`BasePaginationPage`、`IconWrapper`、`RenderNodeDiffer`、`DiffResult` | 用 `DeclarativeGui` 和 `ItemSpec`；分页用 `State` 和 `GridView`。界面服务渲染网格快照。 |
| `BaseConfirmationPage`、`widgets.Confirm`、`InventoryConfirm`、`ChatConfirm`、`Buttons`、`ViewType`、`DependenceManagers#initInventoryAPI` | 确认界面改用 `ui.Confirm`，聊天确认由模块发送可点击的提示，带文字的按钮用 `TextButton`。无需替换旧物品栏初始化方法或 `ViewType`。 |
| `Toast`、`NotificationService#sendToastNotification` | 没有可直接替换的进度弹窗工具。改用标题、动作栏或聊天通知。 |
| `Hologram` | 生成并管理 Paper 的 `TextDisplay`。 |
| `NotificationService` 的旧发送方法签名和 `InMemoryNotificationService` 的无参构造器 | 注入 `NotificationService`，迁移到[返回 `void` 的方法](#notifications-migration)。 |
| `SecurityPolicy` 和 `ClassLoaderUtils` 上的类名过滤方法及审计桥接 | 删除这些调用，没有替代过滤器或审计。JAR 结构检查仍在，但不是沙箱。 |

## 命令 {#command-migration}

自 v7.0.0 起，UltiTools 将注解命令编译成 Brigadier 命令树，通过 Paper 的命令生命周期注册。按[从 6.x 迁移](../essentials/cmd-executor#从-6-x-迁移)更新旧执行器，核对参数解析和补全行为。再检查[被拒绝的格式](../essentials/cmd-executor#被拒绝的格式)：6.x 接受的格式现在可能导致相应模块无法加载。

## 文字与语言 {#messages-migration}

自 v7.0.0 起，`Messages` 是唯一的文本系统。模块随包提供新语言文件，服主修改过的旧译文需要手动迁移。

- **语言文件。** 将 `lang/` 中需要保留的译文移到 `src/main/resources/messages/<locale>.yml`，改用小写点分键和 MiniMessage 值。只读取 `.yml`，不解释 `§` 或 `&` 颜色码；旧文件不会自动导入。将服主修改过的译文转成[覆盖文件](/zh/guide/essentials/messages#operator-overrides)，不要编辑生成的默认文件。
- **源语言。** 模块自身文本不是英文时，在模块的 `plugin.yml` 中声明 `source-language`；默认为 `en`。
- **发送文本。** 用 `@Autowired` 注入 `com.ultikits.ultitools.text.Messages`，用 `messages.key(path)` 构造键，用 `messages.send(...)` 发送，按接收者解析语言；默认根据玩家客户端语言选择，也受服主语言设置及后备规则影响。玩家或服主的输入以 `Arg.string` 传入，绝不拼进模板。实体名称、文本展示实体和共享 Boss 栏使用 `messages.shared(Text)`。
- **默认值。** 新装时 `language` 与 `fallback-language` 均为 `auto`；主机时区不是中国时区时，控制台和后备语言为英文。见[语言选择](/zh/guide/essentials/messages#language-selection)。
- **旧文本 API。** 用 `Messages` 替换 `i18n(...)`。若确实需要服务器后备语言，注入 `LocaleResolver` 并调用 `fallback()`，不再调用 `getLanguageCode()` 或 `getConfiguredLanguage()`。
- **语言声明。** 删除 `supported()` 覆盖和旧语言声明，随模块打包支持的语言文件。

逐项核对代码中是否还有[已删除的旧文本类型和入口](/zh/guide/essentials/i18n#removed-text-apis)。[迁移对照表](/zh/guide/essentials/i18n)还说明了配置注释和语言文件的迁移方式。

## 原生物品与音效 {#items-and-sounds}

自 v7.0.0 起，框架不再提供 XSeries 或跨版本的材质与音效兼容层。`Colors` 仍然存在，并新增 `getGlassPaneMaterial()`。同时维护 6.x 和 7.0 源码时，可直接用 `Material.CYAN_STAINED_GLASS_PANE` 等原生常量。

在 7.0 中把材质名转换为物品，请使用 `Material.matchMaterial`。它接受当前材质名（如 `DIAMOND`）和带命名空间的 key（如 `minecraft:stone`）；框架不查询旧名称，也不回退为其他物品。把材质交给 `ItemSpec.builder` 之前，先排除 `null`、纯方块和空气的结果，写法见 [物品构建与存储](#item-migration)。

以下原生写法自 v7.0.0 起适用，使用 `org.bukkit.Material`、`org.bukkit.Sound`、`org.bukkit.enchantments.Enchantment`、`org.bukkit.inventory.ItemFlag` 和 Adventure 的 `net.kyori.adventure.text.Component`：

| 6.x 写法 | 7.0 原生替代 |
| --- | --- |
| XSeries 材质或 `XVersionUtils` 物品工厂 | `new ItemStack(Material.STONE)`，或 `itemRenderer.render(ItemSpec.builder(Material.STONE).build(), player)` |
| 将 `XVersionUtils.getSound(Sounds.ENTITY_ENDERMAN_TELEPORT)` 传给 `playSound` | `player.playSound(player.getLocation(), Sound.ENTITY_ENDERMAN_TELEPORT, volume, pitch)`（音量和音调沿用原调用） |
| 用 XSeries 附魔产生隐藏附魔的发光效果 | `ItemSpec.builder(Material.PAPER).glint(true).build()`，再渲染（只显示光泽，不添加附魔） |
| `XVersionUtils.sendActionBar(player, "Ready")` | `player.sendActionBar(Component.text("Ready"))` |

音效和附魔 API 在游戏逻辑执行时调用，不要放在静态初始化或枚举构造器中。纯视觉的光泽用 `ItemSpec.Builder#glint(true)`，已有物品栈用 `ItemMeta#setEnchantmentGlintOverride(Boolean)`；两者都不添加附魔。彩色玻璃使用 `new ItemStack(Colors.CYAN.getGlassPaneMaterial())`；现有 GUI 的玻璃颜色和按钮材质不变。

### `XVersionUtils` 方法对照 {#xversionutils-replacements}

自 v7.0.0 起，旧类中的全部 15 个公开方法在 Paper 26.3 上按下表替换。其中 `color` 是保留的 `Colors` 枚举值，物品构造器是 `org.bukkit.inventory.ItemStack`。「没有直接等价物」指单个 Paper 调用无法保留整个辅助方法的行为，需要在自己的代码中保留表内说明的检查。

| 已移除的 6.x 方法 | Paper 26.3 替代与需要保留的行为 |
| --- | --- |
| `getColoredPlaneGlass(Colors color)` | `new ItemStack(color.getGlassPaneMaterial())`；固定颜色可直接使用如 `Material.CYAN_STAINED_GLASS_PANE` |
| `getColoredWool(Colors color)` | `new ItemStack(Material.valueOf(color.name() + "_WOOL"))` |
| `getSign()` | `new ItemStack(Material.OAK_SIGN)` |
| `getEndEye()` | `new ItemStack(Material.ENDER_EYE)` |
| `getEmailMaterial(boolean isRead)` | `new ItemStack(isRead ? Material.FILLED_MAP : Material.PAPER)` |
| `getHead(OfflinePlayer player)` | `new ItemStack(player.isOp() ? Material.DRAGON_HEAD : Material.PLAYER_HEAD)`；旧辅助方法仅选择头颅类型，不设置玩家皮肤 |
| `getGrassBlock()` | `new ItemStack(Material.GRASS_BLOCK)` |
| `registerNewObjective(Scoreboard scoreboard, String name, String criteria, String displayName)` | 没有直接等价物：先调用 `scoreboard.getObjective(name)`，存在就返回；不存在时调用 `scoreboard.registerNewObjective(name, Criteria.DUMMY, displayName)`。旧辅助方法忽略 `criteria`，始终创建 dummy 类型的计分项 |
| `getSound(Sounds sound)` | 使用 `Sound.ENTITY_ENDERMAN_TELEPORT` 或其他对应的原生音效常量；调用方也要替换已删除的 `Sounds` 类型 |
| `getBed(Colors bedColor)` | `new ItemStack(Material.valueOf(bedColor.name() + "_BED"))` |
| `getItemDurability(ItemStack itemStack)` | 没有直接等价物：若 `itemStack.getItemMeta()` 是 `org.bukkit.inventory.meta.Damageable`，返回 `itemStack.getType().getMaxDurability() - damageable.getDamage()`，否则返回 `0`。单独的 `getDamage()` 是已损耗值，不是剩余耐久 |
| `getItemInHand(Player player, boolean isMainHand)` | `isMainHand ? player.getInventory().getItemInMainHand() : player.getInventory().getItemInOffHand()` |
| `sendActionBar(Player player, String message)` | 纯文本使用 `player.sendActionBar(Component.text(message))` |
| `sendPlayerList(Player player, String header, String footer)` | `player.setPlayerListHeaderFooter(header, footer)` 保留字符串调用；Adventure 纯文本可用 `player.sendPlayerListHeaderAndFooter(Component.text(header), Component.text(footer))` |
| `getBlockFace(Block placedBlock)` | 没有直接等价物：读取 `placedBlock.getBlockData()`；若它是 `org.bukkit.block.data.Directional`，返回 `directional.getFacing()`，否则返回 `org.bukkit.block.BlockFace.NORTH` |

模块若继续使用 XSeries，必须用 Maven Shade 或 Gradle Shadow 自行打包依赖并重定位包名（shade + relocate）。不能依赖框架提供，也不能只声明为 `provided`/`compileOnly`：由框架加载的 UltiTools 模块不能使用 Paper 的 `plugin.yml` `libraries:` 机制。[6.x 的运行库说明](/zh/guide/introduction)不是 7.0 的依赖供应承诺。

## 物品构建与存储 {#item-migration}

自 v7.0.0 起，`ItemStackBuilder` 整体删除。用 `ItemSpec` 描述物品，再用注入的 `ItemRenderer` 按接收者语言渲染。

名字和说明行移到模块的语言文件中，以 MiniMessage 编写。6.x 的构建器调用，例如

```java
ItemStack item = ItemStackBuilder.of(Material.DIAMOND).name("&aShop").lore("&7Click to buy").amount(3).glow().build();
```

在用 `@Autowired` 注入 `itemRenderer` 后改写为：

```java
ItemSpec spec = ItemSpec.builder(Material.DIAMOND)
        .name(messages.key("shop.name"))
        .addLore(messages.key("shop.click"))
        .amount(3)
        .glint(true)
        .build();
ItemStack item = itemRenderer.render(spec, player);
```

其余构建器方法的对应关系如下。表中 `builder` 是 `ItemSpec.Builder`，`stack` 是渲染出的或已有的 `ItemStack`，`key2` 和 `key3` 是模块语言文件中的 `MessageKey`：

| 6.x 调用 | 7.0 替代 |
| --- | --- |
| `.amount(n)` | `builder.amount(n)`；超出 1 到 99 时抛出 `IllegalArgumentException`，不再截断 |
| `.lore(...)` / `.addLore(...)` | `builder.lore(List.of(Text.of(key2), Text.of(key3)))` 替换全部说明行；`builder.addLore(key2)` 追加一行；固定组件用 `Text.literal(component)` |
| `.glow()` | `builder.glint(true)`；不添加附魔 |
| `.enchant(e, lvl)` | `builder.data(DataComponentTypes.ENCHANTMENTS, ItemEnchantments.itemEnchantments().add(e, lvl).build())` |
| `.removeEnchant(e)` | 渲染后调用 `stack.removeEnchantment(e)` |
| `.hideAttributes()` | `builder.hiddenInTooltip(Set.of(DataComponentTypes.ATTRIBUTE_MODIFIERS))` |
| `.flags(flags)` | 渲染后调用 `stack.editMeta(meta -> meta.addItemFlags(flags))` |
| `.hideAll()` | `stack.editMeta(meta -> meta.addItemFlags(ItemFlag.values()))`；与 6.x 一样，名字和说明行仍然显示。`builder.tooltipHidden(true)` 会隐藏整个提示框，包括名字和说明行 |
| `.unbreakable()` | `builder.data(DataComponentTypes.UNBREAKABLE)` |
| `.customModelData(n)` | `builder.data(DataComponentTypes.CUSTOM_MODEL_DATA, CustomModelData.customModelData().addFloat(n).build())` |
| `.leatherColor(c)` | `builder.data(DataComponentTypes.DYED_COLOR, DyedItemColor.dyedItemColor(c))` |
| `.skullOwner(player)` | `builder.data(DataComponentTypes.PROFILE, ResolvableProfile.resolvableProfile(player.getPlayerProfile()))` |
| `.meta(consumer)` / `.item(consumer)` | 渲染后调用 `stack.editMeta(consumer)` / `consumer.accept(stack)` |
| `ItemStackBuilder.of(existingStack)` | `existingStack.clone()`，再调用 Paper 的 `setData` 和 `unsetData` |
| `.build()` / `.buildClone()` | `itemRenderer.render(spec, player)` 每次调用都创建新物品栈；复制已有物品栈用 `stack.clone()` |
| `ItemStackBuilder.of(String)` | `Material m = Material.matchMaterial(name);`，再 `m != null && m.isItem() && !m.isAir() ? ItemSpec.builder(m) : null` |

`ItemStackUtils` 保留五个方法，仍可读取 6.x 由该工具写出的 Bukkit 对象流，这类已存数据无需预先转换。不保证能读取模块自定义格式。7.0 用 Paper 的物品字节格式写入 Base64 字符串，6.x 读不了新格式。升级前备份物品和库存数据；读取失败时不要自动用空库存覆盖原数据。回退时恢复版本匹配的备份。见[物品与物品存储](/zh/guide/essentials/items)。

## 调度与声明式 GUI {#scheduler-and-screens}

自 v7.0.0 起，调度任务和声明式界面使用模块实例自己的服务。

- **调度。** 用 `@Autowired` 注入 `com.ultikits.ultitools.scheduling.Scheduler`；每个模块实例拥有一个，卸载模块会取消其任务，`@Scheduled` 也运行在其上。异步重复任务按固定频率运行，绑定到实体的任务在实体被移除时结束（玩家则在断开连接时）。详见[调度器 API](/zh/guide/advanced/scheduled-tasks#调度器-api)。框架自身的工作改由其调度器运行，模块代码无需改动；可观察到的影响见[框架调度的工作](/zh/guide/advanced/scheduled-tasks#框架调度的工作)。
- **声明式 GUI。** `DeclarativeGui` 不再继承 obliviate 的 `Gui`。构造器参数依次为 `UiService ui`、`Scheduler scheduler`、`Player viewer`、`String id`、`Text title` 和 `int rows`（固定 1 到 6 行）；`InventoryType` 构造器、`IconWrapper`、`RenderNodeDiffer`、`DiffResult` 和 `getPlayer()`（改为 `viewer()`）已删除；`ItemDisplay` 接收 `ItemSpec`，点击使用 `onClick(GridAction)`。详见[7.0 的变化](/zh/guide/advanced/declarative-gui#_7-0-的变化)。

## 旧箱子页面与确认组件 {#chest-and-confirmation}

自 v7.0.0 起，不再保留旧箱子页面及确认组件的桥接，`DependenceManagers#initInventoryAPI` 也已删除。框架 JAR 不再打包 obliviate-invs 与 UniversalScheduler。6.x 没有对它们做重定位，所以曾依赖框架供应的 `mc.obliviate.*` 或 `com.github.Anon8281.*` 必须由模块自行打包，或改写相关代码；自行打包也不会恢复已删除的框架 API。`Colors` 仍然保留。

| 6.x | 7.0 |
|---|---|
| `BaseInventoryPage` | `DeclarativeGui`，见[声明式 GUI](/zh/guide/advanced/declarative-gui) |
| `BasePaginationPage` | 保存页码的 `State` 加显示当前切片的 `GridView`，见[声明式 GUI](/zh/guide/advanced/declarative-gui) |
| `BaseConfirmationPage`、`InventoryConfirm`、`Confirm.gui(...)` | 界面服务的 `Confirm`，见 [UI：意图与会话](/zh/guide/advanced/ui-service#notice-and-confirm) |
| `ChatConfirm`、`Confirm.chat(...)` | 由模块自行发送可点击的聊天提示，见 [UI：意图与会话](/zh/guide/advanced/ui-service#chat-confirmation) |
| `Buttons`、`ViewType` | 没有替代类型；使用 `TextButton` 的标签或框架标签键 |

6.x 的旧页面仍作为 6.x 资料保留在 [GUI 界面系统](/zh/guide/advanced/gui)。

## 进度弹窗与悬浮字 {#display-and-toast}

自 v7.0.0 起，`Toast`、`NotificationService#sendToastNotification` 和 `Hologram` 已删除。

**进度弹窗（Toast）。** 旧实现借助进度（advancement）弹窗，依赖已弃用、跨版本不稳定的服务端内部接口，消息中的引号还可能破坏生成的 JSON。框架不提供替代的辅助类。`NotificationService` 提供 `sendTitleNotification`、`sendSubTitleNotification`、`sendActionBarNotification`、`sendBossBarNotification` 和 `sendMessageNotification`（聊天消息），其中部分重载还接收一个 `Sound`。请改用这些方法或聊天。7.0 中这些方法改为接收 `Text` 和 Adventure 类型，参见 [通知服务](#notifications-migration)。

**悬浮字（Hologram）。** 旧的 `Hologram` 为每行文字生成一个隐形盔甲架。请改用 Paper 原生的 `TextDisplay` 实体，单个显示实体即可包含多行文字。下面的示例关闭了实体持久化：

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

- `World#spawn` 必须在拥有目标位置的线程上调用。在其它线程上时，先通过模块注入的 `Scheduler` 切换线程，例如 `scheduler.region(location).run(...)`，详见[调度器 API](/zh/guide/advanced/scheduled-tasks#调度器-api)。
- `Location#getWorld()` 可能返回 `null`，生成实体前要像示例那样检查。
- `messages` 是模块注入的 `com.ultikits.ultitools.text.Messages` 服务，它的 `shared(Text)` 方法为所有玩家共同看到的对象（例如文字显示实体）生成文本。

显示实体由调用方管理，不再需要时调用 `display.remove()` 移除。

## 通知服务 {#notifications-migration}

自 v7.0.0 起，旧的通知方法签名不再可用。迁移调用后重新编译，不要保留原来的 `boolean` 判断。

通知服务按收件玩家的语言渲染每个 `Text`，共有十二个发送方法：四个抽象方法和八个默认重载。签名变化如下：

| 7.0 之前 | 自 v7.0.0 起 |
| --- | --- |
| 消息、标题、副标题和动作栏的 `String` 参数 | `com.ultikits.ultitools.text.Text` |
| Boss 栏 `int` 秒数 | 正的 `java.time.Duration`；默认仍为 25 秒 |
| `org.bukkit.Sound` | Adventure 的 `net.kyori.adventure.sound.Sound`，按调用方给出的来源、音量和音调播放 |
| 标题淡入、停留、淡出的 `int` tick | Adventure 的 `Title.Times`；默认仍为 500 毫秒、2.5 秒、1 秒 |
| `boolean` 返回值 | `void`；必需参数为 `null` 时抛出以参数名为消息的 `NullPointerException`，时长为零或负数时抛出 `IllegalArgumentException` |
| 两个接收调用方 Bukkit `BossBar` 的重载 | 一个接收 Adventure `BossBar.Color` 和 `BossBar.Overlay` 的完整重载 |
| `new InMemoryNotificationService()` | `new InMemoryNotificationService(Messages, Scheduler)`，更推荐注入 `NotificationService` |
| Bean 名称 `inMemoryNotificationService` 和接口全限定类名字符串 | 按类型查找：`@Autowired NotificationService` 或 `getBean(NotificationService.class)` |

6.x 的调用

```java
notificationService.sendBossBarNotification(player, "Arena closes soon", 10);
```

在通过 `@Autowired` 注入 `messages` 和 `notifications` 后改写为：

```java
notifications.sendBossBarNotification(player, Text.of(messages.key("arena.closing")), Duration.ofSeconds(10));
```

把文字移到模块的语言文件中。玩家或服主输入的内容以 `Arg.string` 传入，并在语言文件中写 `<name>` 这样的占位符，不要拼进模板；固定文字用 `Text.plain(string)`。再次发送 Boss 栏通知现在会替换文字、颜色和样式，并重新开始唯一的倒计时；6.x 中文字保持不变，重叠的倒计时还会让 Boss 栏提前消失。各方法使用的线程和已知限制见[通知](/zh/guide/essentials/notifications)。

## 配置保存与 JSON 落盘 {#config-save-and-flush}

6.x 中，路径没有在模块里登记时，`UltiToolsPlugin#saveConfig(path, type)` 抛出 `NullPointerException`。自 v7.0.0 起改为抛出 `IllegalStateException`，异常消息会指出模块和路径，并且不写任何文件。请在保存前先登记配置实体。如果 6.x 代码靠捕获 `NullPointerException` 判断是否缺少登记，请改为确认 `getConfig(path, type)` 的返回值不是 `null`。不要为此捕获 `IllegalStateException`：不在服务器线程调用 `saveConfig` 时抛出的也是这个类型。已登记的实体不是请求类型的实例时仍抛出 `ClassCastException`。参见 [`save()`](../essentials/config-file#save)。

6.x 中，`datasource.flushRate` 为负数时，JSON 存储只在后台落盘一次，之后不再落盘。自 v7.0.0 起，负数不启动周期落盘，并在启动时记录一条警告；正常停服时仍会写入数据。要恢复周期落盘，请设置为正数秒并重启服务器。参见 [JSON 存储的运维](../essentials/data-storage)。

## 重新构建并检查产物 {#rebuild-and-check}

1. 使用前文的两个构建依赖重新构建迁移后的源码。如果提高了模块的 `api-version`，按[模块版本规范](./module-versioning#版本号的选择)提升模块自己的 MAJOR 版本号。
2. 打开构建后的 JAR，检查根目录 `plugin.yml` 中的 `main`、模块 `version` 和整数 `api-version` 是否符合预期。确认新语言文件位于 `messages/<locale>.yml`，需要自行提供的私有库已打包，框架和 Paper API 未被打进产物。
3. 按[检查产物](./module-versioning#检查产物)对照你声明支持的 UltiTools 版本检查字节码中的符号引用，不要只对照编译版本。手动检查工具不是已移除的加载器审计，也不能证明运行时兼容。
4. 在匹配新基准的测试服务器验证功能：按适用情况用玩家和控制台运行命令，检查本地化输出、界面和确认操作、定时任务及有代表性的旧存储数据。也要查看启动日志；通过准入不代表所有调用路径都能正常运行。

## 在服务器上应用与恢复 {#apply-and-recover}

1. 在 6.x 完成最后一次确认启动后停服。用重新构建的 JAR 替换 `plugins/UltiTools/plugins/` 下的旧模块，每个模块只留预期副本；再替换框架 JAR，在新的 Paper 与 Java 基准上启动。更换 JAR 需要完整重启；`/ul reload` 只重载配置及适用的消息覆盖文件。
2. 自 v7.0.0 起，`/upm install`、`/upm update`、`/upm uninstall` 排队到下次启动。用 `/upm pending` 核对，可在重启前用 `/upm revoke <模块>` 撤销符合条件的请求。卸载不再立即停止运行中的模块。模块如果添加自定义附魔、贡献标签或内置数据包，请改在[引导钩子](./startup-phases#bootstrap-content)中声明，而不是在 `registerSelf()` 中声明。移除提供此类内容的模块前，备份世界并查看卸载警告。
3. 等待启动完成。自 v7.0.0 起，排队的文件变更在引导阶段应用；安装或更新须在启用阶段从预期 JAR 加载到预期版本后才确认。启动失败或中断时，框架可能移除未经确认的新装 JAR，或为未经确认的更新恢复旧 JAR。重试前先查看启动日志和 `/upm pending`，需服主处理的条目不可撤销。见[启动时应用与恢复](./module-versioning#启动时应用与恢复)。
4. 恢复模块 JAR 不会回滚数据。不支持在原地降级到 6.x；确实需要返回 6.x 时，恢复与旧版本配套的升级前备份，不要沿用 7.0 写入的文件。

## 独立 Paper 插件 {#external-paper-plugins}

自 v7.0.0 起，使用[外部插件 API](./external-plugin-api)的独立 Paper 插件也应针对新环境重新构建，并迁移实际调用的 UltiTools API。保留 `JavaPlugin` 入口和 `onEnable()` 中的 `UltiToolsAPI.connect(this)`，在 Paper 插件描述文件中声明对 `UltiTools` 的依赖。按 Paper 插件安装，不要放进 UltiTools 模块目录。

UltiTools 模块 JAR 的整数 `api-version` 要求、模块引导声明和 `/upm` 步骤不适用于这种插件；其描述文件和加载由 Paper 管理。

[module admission]: https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#module-api-floor-700-and-plain-module-loading-as-of-700
