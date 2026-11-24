# 模块版本规范

本页说明的是**你的模块**所使用的版本号。`UltiTools-API` 自身的版本号遵循另一套约定，见[与框架版本号的区别](#与框架版本号的区别)。

## 版本号的选择

判断的依据是一个问题：服主换上新的 JAR 之后，还需不需要做别的事？

| | 含义 | 服主需要做什么 |
|---|---|---|
| MAJOR | 升级需要人工介入 | 手动修改配置、迁移数据、重新学习被改名或删除的命令与权限节点，或者先升级 UltiTools |
| MINOR | 新增功能，向后兼容 | 直接替换 JAR。原有配置继续可用，新功能可能需要在配置中开启 |
| PATCH | 修复与内部改动，包括仅涉及 CI 与构建的改动 | 直接替换 JAR，无需其它操作 |

之所以用「服主要做什么」而不是「改动有多大」作为标准，是因为两者并不相关。重写模块的内部实现，只要配置文件与命令保持不变，就是一次 PATCH；而重命名一个权限节点即使只改了一行，也是 MAJOR，因为所有授予过该节点的服务器都会失去这项权限。

### 检查清单

- [ ] 服主需要手动修改配置文件吗？→ MAJOR
- [ ] 已有数据需要迁移吗？→ MAJOR
- [ ] 有命令或权限节点被删除或改名吗？→ MAJOR
- [ ] `plugin.yml` 的 `api-version` 提高了吗？→ MAJOR
- [ ] 以上四项都不是，但有新功能？→ MINOR
- [ ] 以上四项都不是，也没有新功能？→ PATCH

第四项覆盖的是前三项照顾不到的情况，因为此时模块本身没有任何变化。提高 `api-version` 意味着使用旧版框架的服主无法直接替换 JAR，必须先升级 UltiTools，按上面的标准这属于 MAJOR。即使这次发布只是一次源码未改的重新构建也是如此，而[描述符变更](#描述符变更)正是会导致这类发布的情形。

## 与框架版本号的区别

`UltiTools-API` 的 [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md) 说明，它的版本号是产品阶段的标识，而不是严格的 semver 约定，框架的 MINOR 版本可能移除 API。

::: tip 向框架本身贡献代码，而不只是使用它
如果你打算向 `UltiTools-Reborn` 提交 pull request，请注意它的贡献语言政策和本文档站不同：新增的注释、javadoc、workflow 注释与 PR 标题正文都要求以英文为主、中文作为补充。
CI 会对 `src/main` 的注释与 javadoc、workflow 文件与一个测试包强制执行这条规则，对照一份很小的、明确列出的白名单。
这是框架仓库自己的政策，不是这个双语文档站的要求。
:::

这看起来与上面的规则矛盾，实际上并不矛盾，两者的区别值得先理解清楚。

框架的版本号会被解析和链接。Maven 依据它选择构件，已编译的下游插件在运行时链接到它的类。这两件事都是兼容性问题，而一个需要回答兼容性问题的数字不能是自由格式的标识。

模块的版本号同样会被程序读取，但用途只有比较两个版本的先后，不用于判断兼容性：

| 使用方 | 用途 |
|---|---|
| `PluginManager.hasNewerVersionLoaded` | 代码通过 `PluginManager#register(...)` 再注册一个已加载模块（同一个主类）的实例时，比较两个版本，拒绝较旧的那个 |
| `PluginManager.unregisterSupersededVersions` | 同样是这种情况下，正在注册的实例更新时，卸载被它取代的已加载版本。自 v6.3.0 起走完整的卸载流程，卸载失败会记在旧版本名下，不影响新版本继续加载。同样自 v6.3.0 起，旧版本的面板 responder、EventBus 处理器和补全器在新实例刷新容器、运行 `registerSelf()` 之前就被释放，所以新实例可以注册旧版本占用的面板消息类型；新实例随后加载失败时，这些登记会还给旧版本，旧版本照常运行 |
| `UpdateManager.checkModuleUpdates` | 比较已加载版本与已发布版本，提示有更新可用 |

三者都通过 `VersionComparatorUtil.compare` 判断 A 是否大于 B，都不关心这个差异属于 MAJOR、MINOR 还是 PATCH。

模块目录里同一个模块的两个 JAR 不会走到前两项。所有模块 JAR 共用一个类加载器，两个副本解析到的是同一个类，不会并排加载。通过 API 准入的副本中，由哪个提供类取决于文件名而不是版本号，见[同一模块的两个副本](#同一模块的两个副本)。

也没有任何机制从 Maven 解析一个模块供另一个模块使用。官方模块中没有一个在 pom 中声明对兄弟模块的依赖；以多模块工程构建的模块（例如已停止维护的 `UltiBot`）依赖的是它自己的子模块，那属于该构建的内部结构，不是模块之间的依赖。因此约束框架版本号的那条理由不适用于模块的版本号。如果你把自己的模块发布出去供他人编译和链接，这条理由就同样适用于你的模块：你的版本号从此需要回答兼容性问题，此时需要的是一套比框架更严格、能够保证兼容性的约定，而不是框架那套更宽松的约定。

所以两者的区别在于：版本号的顺序会被程序使用，而 MAJOR、MINOR、PATCH 的含义不会。由此产生一条强制要求，其余部分交给编写者判断。

::: tip 唯一的强制要求
版本号必须单调递增并保持可比较。从 `1.10.0` 退回 `1.9.0`，或者中途更换编号方案，会导致更新检查漏掉更新的版本或提示一个更旧的版本，也会导致对同一模块的第二次注册保留错误的实例。
:::

除此之外，版本号的形态是写给服主看的信息，所以它的规则可以与框架不同，两者都不算错。

## 对 `UltiTools-API` 的 pin

模块将框架声明为 `provided`：

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>${ultitools.version}</version>
    <scope>provided</scope>
</dependency>
```

`provided` 表示模块在编译时使用 pin 指定的版本，在运行时使用服务器上实际安装的框架。这种不对称是这套机制的关键：

- 针对较旧的 API 编译时，编译器写入字节码的每一个符号在那个版本中都存在，因此模块不会因为引用了比服务器更新的内容而出现 `NoSuchMethodError`。但它仍可能因为其它原因出现同样的异常，见[框架引起的兼容性中断](#框架引起的兼容性中断)。
- 针对较新的 API 编译时，模块可能引用到服务器上的框架没有的方法，第一次执行到该调用点时出现 `NoSuchMethodError`。

第一条的适用范围需要注意。它描述的是静态链接的引用在一个方向上的情况，不是一条普遍保证：之后的框架版本仍然可能移除或者修改模块正在使用的内容，而通过反射访问的内容从一开始就不在这条保证的范围内，因为编译器没有记录它们。

因此 pin 落后于最新正式版属于正常状态，不是需要修正的偏差。只在模块确实开始使用新 API 时才提高 pin；但升级到 v7.0.0 是新的 API 基线，6.x 模块必须重新构建，见[6.x 模块升到 7.0](#modules-6x-to-7)。

### pin 与 `api-version`

pin 不是模块的运行时下限。这是两个互相独立的数字，其中只有一个会被检查：

| 数字 | 决定什么 | 由谁检查 |
|---|---|---|
| `pom.xml` 中的 `UltiTools-API` 版本 | 字节码记录的是哪一版的描述符 | 没有。它是 `provided`，不会进入 JAR，框架在运行时也读不到它 |
| `plugin.yml` 中的 `api-version` | 声明的运行时下限 | 在 6.x 中由 `PluginManager.isUltiToolsVersionCompatible` 在加载时检查；这是模块准入前唯一被检查的框架版本。自 v6.3.0 起，`/upm` 安装或更新模块时也检查它。自 v7.0.0 起，主类解析前先由 `ModuleJarAdmission` 检查整数和 `700` 下限，再由 `PluginManager.isUltiToolsVersionCompatible` 检查是否要求更新的框架；`/upm` 也检查接受范围，见[按 API 级别选择版本](#按-api-级别选择版本) |

提高 pin 不会提高下限。两个数字不一致本身不是问题：只要字节码引用的成员在声明的下限中都已存在，针对更新的 pin 构建出的产物照样可以在该下限上运行。真正会出问题的是字节码引用了 `api-version` 所声明的框架版本没有的符号，这时那个服务器会放行这个 JAR，并在执行到对应调用点时失败。

在 6.x 中，只有 `api-version` 与模块可以运行在哪些框架版本上有关。模块被放行前检查的项目不止这一个：JAR 会先经过结构校验，自 v7.0.0 起，主类解析之前还由 `ModuleJarAdmission` 检查声明。之后的 `passesCompatibilityGates` 检查 `!hasNewerVersionLoaded && isUltiToolsVersionCompatible`；其中的更新实例检查用于代码通过 `PluginManager#register` 第二次注册同一个主类的情况。这些检查中的 `api-version` 声明框架级别，不证明每个引用的 API 都存在。

## 框架引起的兼容性中断

较旧的 pin 只提供上一节所说的那一条保证。模块自身的代码没有任何改动，仍然可能出现链接错误，因为字节码链接到的目标由服务器上安装的框架决定，不由模块的构建过程决定。

::: warning 构建成功不等于兼容
一次成功的构建只能说明源码仍然可以编译。导致已发布 JAR 出错的是字节码中记录的描述符，而编译过程不会显示它。
:::

[JLS 的二进制兼容性一章][jls13]列出了可能造成这类问题的全部变更。下面举例说明本项目已发布或已公告的 API 移除（包括 7.0 原生 API 迁移）与描述符变更，不是完整清单。

### API 被移除

框架的 MINOR 版本可能移除 API，具体见 `COMPATIBILITY.md`。出现哪种链接错误取决于被移除的内容：移除类型得到 `NoClassDefFoundError`，移除方法、构造器或字段得到 `NoSuchMethodError` 或 `NoSuchFieldError`。第二种并非假设，当前的移除清单中包含一个构造器，不只有类型。

提高 pin 并重新构建会产生两种结果，在运行之前无法确定是哪一种：

- 构建失败。移除因此暴露出来，你在这里发现问题，而不是在服主的服务器上，接下来需要从被移除的 API 迁移出去。
- 构建通过。某个保留下来的成员接管了这次调用，重新构建出的产物已经修复。

这两种结果都不会修复已经发布出去的那个 JAR，它会一直出错，直到你发布重新构建的版本。第二种结果因此更需要注意：构建通过看起来像是没有问题，而实际上修复品在你手中，需要你主动发布出去。

构建通过并不难出现，因为这次检查只覆盖源码中明确写出名字的内容。源码隐式引用到的部分都可能被重新解析到别处：

- 重载接管了调用。`m(String)` 被移除，`m(Object)` 保留，未经修改的源码会编译到保留的那个上。
- 被移除的类型没有出现在源码中。`factory.create().run()` 中 `create()` 的返回类型由编译器推断，把 `create()` 改为返回替代类型之后源码仍然可以编译，而旧的字节码中引用的还是被删除的那个类型。

只有在发布提高后的 pin 时才会产生代价：针对更新的框架构建可能记录更新的描述符，这意味着需要同时提高 `api-version`，而那会让仍在使用旧版框架的服务器无法升级。因此提高 pin 适合用来做检查，不适合用来做修复：在一次临时构建中提高 pin，观察哪些地方编译不通过，从这些 API 迁移出去，然后单独决定正式发布使用的 pin 是否需要变动。

对于带有废弃通告的 API，应关注通告，在移除正式发布之前完成迁移。下文的 7.0 移除项在 6.x 中没有预先标记为废弃；v7.0.0 是新的 API 基线。

::: tip 从废弃通告里读出移除期限
自 v6.3.0 起，框架里每一个 `@Deprecated(forRemoval = true)` 成员都携带一个 `{@removeIn X.Y.Z}` javadoc 标签，指明移除会落在哪个具体版本。
一旦项目版本到达该目标而成员仍在源码中声明，框架自己的 CI 就会在构建期失败，这个标签是被强制执行的承诺。
完整列表见框架仓库的 [`compatibility/DEPRECATIONS.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/compatibility/DEPRECATIONS.md)，一次性查看所有 `ANNOUNCED` 状态的移除项及其期限。
:::

### 6.x 模块升到 7.0 {#modules-6x-to-7}

自 v7.0.0 起，6.x 模块不能直接加载到 7.0。将构建依赖更新为 UltiTools-API 7.0，迁移已删除的 API，针对目标 Paper 重新构建，并在 JAR 根目录的 `plugin.yml` 中声明整数 `api-version: 700`（或更高）。仅修改旧 JAR 的声明不会修复已删除 API 的引用。高于当前框架 API 级别的声明仍会被拒绝。

7.0 按原样加载模块，保留共享的 parent-first `URLClassLoader`，但不再做加载期字节码适配、服务端 API 探测、启动或离线链接审计。仍然保留的容器跳过诊断描述已观察到的缺失类和处理器，不代表框架会补全缺失能力。

存在可读 `plugin.yml` 和 `main:` 时，下列检查都在解析主类之前进行。文件不可读或没有 `main:` 仍走原有的元数据拒载消息。

| 被拒情形 | 消息含义 |
| --- | --- |
| 整数低于 `700`，如 `630` | 声明低于当前框架要求的最低级别，须安装重新构建的模块 |
| 缺少 `api-version` | 没有有效声明；读到的值显示为 `<missing>`（英文）或 `<缺失>`（中文） |
| 空值或非整数，如 `'26.3'`、`1.21`、`abc` | 没有有效声明；只写 `api-version:` 不带值时显示 `<missing>`（英文）或 `<缺失>`（中文）。空字符串（`api-version: ''`）和其他值带单引号显示，如 `''` 或 `'1.21'`，不是低级别拒载 |

缺失和非整数共用一条消息模板，低级别使用另一条。带引号的整数 `'700'` 也有效。以下逐字引用语言文件中的原始模板（不含日志前缀）；`%s`、`%d` 及中文的位置参数在运行时替换为 JAR 名、声明值或读到的值、最低级别和当前框架版本（两条模板中的顺序不同）：

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

因整数与最低级别检查被拒的 JAR（缺失、非整数或低于 `700`）不进入共享类路径，不能向其他模块提供主类或辅助类；每个拒载计入一次 `Failed`，无关模块继续加载。例如，同一主类的 `m-6.3.0.jar`（630）和 `m-7.0.0.jar`（700）并存时，旧副本被拒，新副本提供类，即使新文件名排序靠后。启动时的重复副本警告仍会列出这两个文件，并指明类从 `m-7.0.0.jar` 加载。框架不自动删除旧文件；均通过准入的副本之间仍按文件名排序，不按模块版本选最新。

升级框架前，先在旧框架下让每个待处理的 `/upm update` 完成一次启动确认；不保留的更新先按[更新与卸载](#在服务器上更新和卸载)说明取消（`/upm uninstall` 也会卸载模块并删除其 JAR，应先备份需要保留的文件）。不要带着等待确认的 6.x 更新升级到 7.0：它可能被拒载并触发旧事务回滚，而恢复的旧 JAR 同样低于 700。完成或取消更新后，停服，将模块替换为重新构建的 7.0 版本，只保留预期的一份 JAR，再升级框架并启动。

### 7.0 原生物品与音效 API

::: warning 未发布的 v7.0.0 迁移说明
自 v7.0.0 起，框架不再提供 XSeries，也不再提供跨版本材质和音效兼容层。
站内其他位置的 6.x 用法仅适用于对应的框架版本。
:::

替换下列已移除的公开符号后，针对 7.0 重新编译模块：

| v7.0.0 移除的符号 | 替代方式 |
| --- | --- |
| `com.ultikits.ultitools.utils.XVersionUtils` | 直接调用 Paper 和 Adventure API，完整方法对照见下表 |
| `com.ultikits.ultitools.entities.Sounds` | Paper 的 `org.bukkit.Sound` |
| `com.ultikits.ultitools.entities.Colors#getCode()` | 原生 `Material.<COLOR>_STAINED_GLASS_PANE`，或 7.0 新增的 `Colors#getGlassPaneMaterial()` |

`Colors` 枚举本身仍保留，自 v7.0.0 起新增 `getGlassPaneMaterial()`；6.x 没有这个 getter。`new ItemStack(Material.CYAN_STAINED_GLASS_PANE)` 在 6.x 和 7.0 上都能使用。自 v7.0.0 起，`ItemStackBuilder` 整体删除，包括带 XSeries 参数类型的入口；见 [7.0 的物品构建与存储](#item-construction-7)。

在 7.0 中把材质名转换为物品，请使用 `Material.matchMaterial`。它接受当前材质名（如 `DIAMOND`）和带命名空间的 key（如 `minecraft:stone`）；框架不查询旧名称，也不回退为其他物品。把材质交给 `ItemSpec.builder` 之前，先排除 `null`、纯方块和空气的结果，写法见 [7.0 的物品构建与存储](#item-construction-7)。

以下原生写法自 v7.0.0 起适用，使用 `org.bukkit.Material`、`org.bukkit.Sound`、`org.bukkit.enchantments.Enchantment`、`org.bukkit.inventory.ItemFlag` 和 Adventure 的 `net.kyori.adventure.text.Component`：

| 6.x 写法 | 7.0 原生替代 |
| --- | --- |
| XSeries 材质或 `XVersionUtils` 物品工厂 | `new ItemStack(Material.STONE)`，或 `itemRenderer.render(ItemSpec.builder(Material.STONE).build(), player)` |
| 将 `XVersionUtils.getSound(Sounds.ENTITY_ENDERMAN_TELEPORT)` 传给 `playSound` | `player.playSound(player.getLocation(), Sound.ENTITY_ENDERMAN_TELEPORT, volume, pitch)`（音量和音调沿用原调用） |
| 用 XSeries 附魔产生隐藏附魔的发光效果 | `ItemSpec.builder(Material.PAPER).glint(true).build()`，再渲染（只显示光泽，不添加附魔） |
| `XVersionUtils.sendActionBar(player, "Ready")` | `player.sendActionBar(Component.text("Ready"))` |

音效和附魔 API 在游戏逻辑执行时调用，不要放在静态初始化或枚举构造器中。纯视觉的光泽用 `ItemSpec.Builder#glint(true)`，已有物品栈用 `ItemMeta#setEnchantmentGlintOverride(Boolean)`；两者都不添加附魔。彩色玻璃使用 `new ItemStack(Colors.CYAN.getGlassPaneMaterial())`；现有 GUI 的玻璃颜色和按钮材质不变。

#### XVersionUtils 全部方法的替代方式

自 v7.0.0 起，已发布 6.5.0 类中的全部 15 个公开方法在 Paper 26.3 上按下表替换。其中 `color` 是保留的 `Colors` 枚举值，物品构造器是 `org.bukkit.inventory.ItemStack`。「没有直接等价物」指单个 Paper 调用无法保留整个辅助方法的行为，需要在自己的代码中保留表内说明的检查。

| 已移除的 6.x 方法 | Paper 26.3 替代与需要保留的行为 |
| --- | --- |
| `getColoredPlaneGlass(Colors color)` | `new ItemStack(Material.valueOf(color.name() + "_STAINED_GLASS_PANE"))`；固定颜色可直接使用如 `Material.CYAN_STAINED_GLASS_PANE` |
| `getColoredWool(Colors color)` | `new ItemStack(Material.valueOf(color.name() + "_WOOL"))` |
| `getSign()` | `new ItemStack(Material.OAK_SIGN)` |
| `getEndEye()` | `new ItemStack(Material.ENDER_EYE)` |
| `getEmailMaterial(boolean isRead)` | `new ItemStack(isRead ? Material.FILLED_MAP : Material.PAPER)` |
| `getHead(OfflinePlayer player)` | `new ItemStack(player.isOp() ? Material.DRAGON_HEAD : Material.PLAYER_HEAD)`；旧辅助方法仅选择头颅类型，不设置玩家皮肤 |
| `getGrassBlock()` | `new ItemStack(Material.GRASS_BLOCK)` |
| `registerNewObjective(Scoreboard scoreboard, String name, String criteria, String displayName)` | 没有直接等价物：先调用 `scoreboard.getObjective(name)`，存在就返回；不存在时调用 `scoreboard.registerNewObjective(name, Criteria.DUMMY, displayName)`。旧辅助方法忽略 `criteria`，始终创建 dummy 类型的计分项 |
| `getSound(Sounds sound)` | 使用 `Sound.ENTITY_ENDERMAN_TELEPORT` 或其他同名原生常量；调用方也要替换已删除的 `Sounds` 类型 |
| `getBed(Colors bedColor)` | `new ItemStack(Material.valueOf(bedColor.name() + "_BED"))` |
| `getItemDurability(ItemStack itemStack)` | 没有直接等价物：若 `itemStack.getItemMeta()` 是 `org.bukkit.inventory.meta.Damageable`，返回 `itemStack.getType().getMaxDurability() - damageable.getDamage()`，否则返回 `0`。单独的 `getDamage()` 是已损耗值，不是剩余耐久 |
| `getItemInHand(Player player, boolean isMainHand)` | `isMainHand ? player.getInventory().getItemInMainHand() : player.getInventory().getItemInOffHand()` |
| `sendActionBar(Player player, String message)` | 纯文本使用 `player.sendActionBar(Component.text(message))` |
| `sendPlayerList(Player player, String header, String footer)` | `player.setPlayerListHeaderFooter(header, footer)` 保留字符串调用；Adventure 纯文本可用 `player.sendPlayerListHeaderAndFooter(Component.text(header), Component.text(footer))` |
| `getBlockFace(Block placedBlock)` | 没有直接等价物：读取 `placedBlock.getBlockData()`；若它是 `org.bukkit.block.data.Directional`，返回 `directional.getFacing()`，否则返回 `org.bukkit.block.BlockFace.NORTH` |

模块若继续使用 XSeries，必须用 Maven Shade 或 Gradle Shadow 自行打包依赖并重定位包名（shade + relocate）。不能依赖框架提供，也不能只声明为 `provided`/`compileOnly`：由框架加载的 UltiTools 模块不能使用 Paper 的 `plugin.yml` `libraries:` 机制。[6.x 的运行库说明](/zh/guide/introduction)不是 7.0 的依赖供应承诺。

### 7.0 的物品构建与存储 {#item-construction-7}

::: warning 未发布的 v7.0.0 物品 API
自 v7.0.0 起，`com.ultikits.ultitools.utils.ItemStackBuilder` 已删除。请改用 `ItemSpec` 和注入的 `ItemRenderer` 构建物品，再重新编译。
:::

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

模块存储的物品无需改动。`ItemStackUtils` 保留五个方法，可读取 6.x 保存的字符串，写入 6.x 无法读取的新格式；升级前请备份存储的物品。见[物品与物品存储](/zh/guide/essentials/items)。

### 7.0 的调度与声明式 GUI

自 v7.0.0 起（尚未发布），模块作者会遇到两处 API 变化。请按上文针对 7.0 重新构建模块。

- **调度。** 用 `@Autowired` 注入 `com.ultikits.ultitools.scheduling.Scheduler`；每个模块实例拥有一个，卸载模块会取消其任务，`@Scheduled` 也运行在其上。异步重复任务按固定频率运行，绑定到实体的任务在实体被移除时结束（玩家则在断开连接时）。详见[调度器 API](/zh/guide/advanced/scheduled-tasks#调度器-api)。框架自身的工作改由其调度器运行，模块代码无需改动；可观察到的影响见[框架调度的工作](/zh/guide/advanced/scheduled-tasks#框架调度的工作)。
- **声明式 GUI。** `DeclarativeGui` 不再继承 obliviate 的 `Gui`。构造器接收模块的 `UiService`、`Scheduler` 以及 `Text` 标题，行数固定为 1 到 6；`InventoryType` 构造器、`IconWrapper`、`RenderNodeDiffer`、`DiffResult` 和 `getPlayer()`（改为 `viewer()`）已删除；`ItemDisplay` 接收 `ItemSpec`，点击使用 `onClick(GridAction)`。详见[7.0 的变化](/zh/guide/advanced/declarative-gui#_7-0-的变化)。

### 7.0 的进度弹窗与悬浮字

::: warning 尚未发布的 v7.0.0 删除项
自 v7.0.0 起，`com.ultikits.ultitools.widgets.Toast`、`NotificationService#sendToastNotification` 和 `com.ultikits.ultitools.widgets.Hologram` 已删除。
请按下文迁移调用方，再针对 7.0 重新构建。
:::

**进度弹窗（Toast）。** 旧实现借助进度（advancement）弹窗，依赖已弃用、跨版本不稳定的服务端内部接口，消息中的引号还可能破坏生成的 JSON。框架不提供替代的辅助类。`NotificationService` 提供 `sendTitleNotification`、`sendSubTitleNotification`、`sendActionBarNotification`、`sendBossBarNotification` 和 `sendMessageNotification`（聊天消息），其中部分重载还接收一个 `Sound`。请改用这些方法或聊天。7.0 中这些方法改为接收 `Text` 和 Adventure 类型，参见 [7.0 的通知服务](#notification-service-7)。

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

- `World#spawn` 必须在拥有目标位置的线程上调用。在其它线程上时，先通过模块注入的 `Scheduler` 切换线程，例如 `scheduler.region(location).run(...)`，详见[调度器 API](/zh/guide/advanced/scheduled-tasks#调度器-api)。框架自身的工作改由其调度器运行，模块代码无需改动；可观察到的影响见[框架调度的工作](/zh/guide/advanced/scheduled-tasks#框架调度的工作)。
- `Location#getWorld()` 可能返回 `null`，生成实体前要像示例那样检查。
- `messages` 是模块注入的 `com.ultikits.ultitools.text.Messages` 服务，它的 `shared(Text)` 方法为所有玩家共同看到的对象（例如文字显示实体）生成文本。

显示实体由调用方管理，不再需要时调用 `display.remove()` 移除。

### 7.0 的通知服务 {#notification-service-7}

::: warning 尚未发布的 v7.0.0 通知 API
自 v7.0.0 起，`NotificationService` 改为接收 `Text`、`Duration` 和 Adventure 类型，所有方法都返回 `void`。
针对 6.x 编译的模块与它不保持二进制兼容，请迁移调用并重新构建。
:::

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

### 7.0 的文本与语言

::: warning 未发布的 v7.0.0 文本引擎
自 v7.0.0 起，模块随包提供 `messages/<语言>.yml` 语言文件，并通过注入的 `Messages` 服务发送文本。
6.x 语言文件不会被转换；`i18n(...)` 路径暂时仍可使用。
:::

- **语言文件。** 把文本移到 `src/main/resources/messages/<语言>.yml`，使用小写点分键和 MiniMessage 值。那里不解释 `§` 和 `&` 颜色码，并且只读取 `.yml` 文件。请重新编写文本；6.x 的 `lang/` 文件、句子键和自定义语言名称不会被转换。
- **源语言。** 模块自身文本不是英文时，在模块的 `plugin.yml` 中声明 `source-language`；默认为 `en`。
- **发送文本。** 用 `@Autowired` 注入 `com.ultikits.ultitools.text.Messages`，用 `messages.key(path)` 构造键，用 `messages.send(...)` 发送，每个玩家就会看到自己客户端语言的版本。玩家或服主的输入以 `Arg.string` 传入，绝不拼进模板。实体名称、文本展示实体和共享 Boss 栏使用 `messages.shared(Text)`。
- **默认值。** 新装时 `language` 与 `fallback-language` 均为 `auto`；主机时区不是中国时区时，控制台和后备语言为英文。见[语言选择](/zh/guide/essentials/messages#language-selection)。

`i18n(...)` 路径、`getLanguageCode()` 和 `getConfiguredLanguage()` 在调用方迁移期间仍保留在 7.0 中；移除它们是之后单独的改动。见[消息与语言](/zh/guide/essentials/messages)。

### 描述符变更

这种情形更难发现，因为没有任何内容被移除，也没有可以标记为废弃的对象。方法的描述符同时包含参数类型和返回类型，其中任何一项发生变化，都会在相同的名字下产生一个不同的符号。

这种情况发生过两次。

**6.1.1 到 6.2.0，一个 MINOR 版本。** 移除 Spring 时修改了 `UltiToolsPlugin` 上一个字段的类型，由 Lombok 生成的 `getContext()` 返回类型随之改变。所有已经编译的、调用了该方法的模块都得到 `NoSuchMethodError`。这次改动没有移除任何内容，也没有标记废弃，从源码上看是一次内部整理。公开字段的类型发生变化时同理：已编译的 `getfield` 仍然带着旧的描述符，失败于 `NoSuchFieldError`。

**6.2.0 到 6.2.1，一个 PATCH 版本。** 数据 API 上的 `AbstractDataEntity` 被替换为 `BaseDataEntity<String>`，改变了 5 个类型上共 14 个公开成员的描述符：`DataOperator` 的 `exist(T)`、`getById`、`insert(T)`、`update(T)`，`Query` 的 `first()`，以及它们的实现类。这次改动没有移除也没有新增任何成员，每个受影响的成员都保留了原来的名字。

第二次发生在 PATCH 版本，说明没有哪个版本级别可以免于这种情况。版本策略安排的是有意进行的移除，而非预期的二进制中断按定义就不在安排之内，PATCH 也不例外。

只使用 `.query()….first()` 的模块没有调用任何 `DataOperator` 方法，同样会受到影响，而一份按 `DataOperator` 组织的清单不会覆盖到这类模块。

#### 双向影响

一个符号保留名字而改变描述符时，两个方向都会受影响。同一个模块、同一份源码，只改变 pin：

| 构建时的 pin | 运行在框架 6.2.0 上 | 运行在框架 6.2.1 及以后 |
|---|---|---|
| 6.2.0 | 正常 | `NoSuchMethodError`，查找 `(AbstractDataEntity)`，该符号已不存在 |
| 6.2.1 | `NoSuchMethodError`，查找 `(BaseDataEntity)`，该符号尚未存在 | 正常 |

因此「针对新框架重新构建」并不是一次能让旧服务器保持原状的修复，它改变的是哪一侧可以运行。两个方向出错的原因相同，所以具体的处理方式取决于缺失符号引用的是哪一代类型，见[输出的判读](#输出的判读)。

#### 需要执行的操作

只重新构建并不足够。pin 仍然停留在旧版本时，构建会重新生成旧的描述符，新产物的失败方式与之前完全相同。因此只要保留原来的直接调用点，就需要把 pin 提高到包含新描述符的框架版本并重新构建。下面的第三种方式可以避开这个前提。

这只完成了一半，而且按上面那张表，是没有被检查的那一半。重新构建出的 JAR 记录的是新的描述符，它在更旧的框架上会抛出 `NoSuchMethodError`。如果 `api-version` 保持不变，旧服务器会正常放行这个新 JAR，然后在第一次调用时出错。因此需要同时提高 `api-version`，而按本页开头的检查清单，这会使该次发布成为 MAJOR。

提高到产物实际需要的版本，而不是机械地跟随 pin。提高 pin 本身并不意味着产物需要更新的框架：如果这次重新构建只是把某次调用重新指向了两个版本中都存在的成员，或者你提高 pin 只是为了做检查，那么字节码可能仍然可以在原有的下限上运行，此时提高 `api-version` 会把一次兼容的修复变成一次没有必要的 MAJOR 发布。下一节说明如何确认这一点；在没有确认的情况下，跟随 pin 是保守的取值方式。

### 检查产物

「这个 JAR 能否在框架 X 上运行」是可以确认的。确认方式不是重新构建，而是把字节码引用的符号与该框架实际声明的内容作比较：

```bash
# 在 UltiTools-Dev-Doc 的 checkout 中执行
python3 scripts/symcheck.py 你的模块.jar UltiTools-API-<你声明的下限>.jar
```

退出码为 0 表示没有缺失的符号。非零时会列出缺失的内容，该 JAR 在那个框架上第一次执行到对应调用点时就会出错。

比较的对象应当是你在 `api-version` 中声明的版本，而不是你 pin 的版本。这是两个不同的问题，而前者才是用户会遇到的那个。

这里的 `scripts/symcheck.py` 是文档仓库的手动符号比较工具，不是 7.0 已删除的框架启动或离线服务端链接审计。符号检查通过也不能替代 v7.0.0 的整数 700 下限或重新构建要求。

#### 输出的判读

先区分两种情形，它们需要的处理不同：

- 这个名字完全不存在，没有任何重载保留下来，或者类本身不在。这属于 API 被移除，参照该版本的移除清单，需要的是源码迁移。
- 存在同名的符号，只是描述符不同。这属于描述符变更，此时才适用下面的表格。

对于描述符变更，观察缺失符号引用的是哪一代类型：

| 缺失符号引用的类型 | 说明 | 处理方式 |
|---|---|---|
| 较新的类型，例如 `BaseDataEntity` | 产物需要的版本高于它声明的下限 | 提高 `api-version`，pin 不需要改动 |
| 较旧的类型，例如 `AbstractDataEntity` | pin 停留在旧版本，产物比声明的下限更旧 | 提高 pin 并重新构建。此时提高 `api-version` 没有作用，反而会让情况更糟 |

这两种情况容易混淆，而处理方式相反，因此值得先把符号本身读清楚。

脚本不能代替你作这个判断。它接收的是一个模块 JAR 和一个框架 JAR，可以确认某个符号不存在，但无法确认原因，也读不到你的 pin。

还有两种情况脚本会明确说明而不作推断。继承链超出这两个 JAR 范围的引用会被列为「无法判定」，并且不影响退出码；这种情况出现在框架类继承自 API JAR 未包含的类型时，例如服务端 API 或某个界面库，此时模块调用继承来的方法是正常的。另外，如果 `javap` 本身执行失败，脚本会直接终止，而不是继续分析不完整的输出。

手工检查还会遇到一个细节：常量池中记录的是调用点上接收者的静态类型，而不是声明该成员的类。在自己的插件类中调用继承来的框架方法时，记录下来的所属类是你自己的类，形如 `com/example/MyPlugin.getContext:()…`。因此只筛选所属类已经位于框架包内的引用，会遗漏所有继承调用，而插件都继承 `UltiToolsPlugin`，这类调用占多数。

::: tip 手工检查的局限
对单个类执行 `javap -s` 可以查看某个成员的描述符，但这里的问题是整个 JAR 中有没有引用到目标框架不存在的符号，这需要比较两个构件。
:::

### 同时支持两个框架版本

无法同时适配两侧的是静态链接的调用点，描述符在编译期就已确定，一个调用点只匹配一侧。可选的方式有三种，代价依次递增：

1. 接受更高的下限。这是默认的选择：旧服务器继续使用旧版本的 JAR，新版本服务新框架。
2. 按框架版本区间发布不同的构件，同时维护两条线。
3. 编写适配层，改用反射调用（`getMethod("getContext").invoke(plugin)` 返回 `Object`，再以同样的方式访问 `getBean`），或者按框架版本延迟加载不同的适配器。反射调用点不会链接到任何一个描述符，因此一个构件可以同时运行在两侧。代价是这条路径失去了编译期检查，问题只在运行时暴露，而且框架下一次修改该成员时不会产生任何构建警告。

第三种方式是可行的，不必因为它排在最后就排除它，但它把构建期的失败换成了运行时的失败，因此只在确实需要继续支持旧服务器时才值得采用。

这也说明了「pin 落后属于正常状态」的适用范围。那条规则说的是不要在没有理由的情况下改动 pin，而描述符变更是一个理由，上面的判断过程指向这里的其它情形也是。

### 其它链接错误

如果遇到的链接错误不属于上面两种情形，那么它属于 JLS 中的其它类别，例如实例方法被改为 `static` 会得到 `IncompatibleClassChangeError`，成员的可见性被收窄会得到 `IllegalAccessError`，此外还有更多种类。可以用一个问题判断方向：框架是否移除了某些内容？

- 是。那么它应当出现在移除清单上。如果不在，请提交一个 issue，这属于流程上的疏漏，不只是你这一侧的问题。
- 否。尝试上面所说的重新构建流程：提高 pin，重新构建，提高 `api-version`。如果重新构建时**编译不通过**，说明这次变更同时破坏了源码兼容性，需要的是迁移而不是重新构建。

自 v6.3.0 起，加载模块声明的主类时，如果框架 API 链接错误点名了 `com.ultikits.ultitools` 下的类型，日志会输出一行英文 `SEVERE`，包含 JAR 名、`plugin.yml` 中声明的 `version` 和 `api-version`（未声明的项不列出），以及 `Cause:` 后的原始异常消息。看到 `built against an older UltiTools-API version` 时，应将模块升级到为当前框架构建的版本，并参照 `COMPATIBILITY.md`；如果声明的 `api-version` 高于已安装框架的版本，提示会改为 `requires a newer UltiTools-API`，此时应升级框架。完整堆栈只在 `FINE` 级别输出（Paper 默认日志配置下不可见），这类拒载也不会作为错误报告发送到面板。缺少第三方类或 Bukkit 类时，仍输出带堆栈的通用 `SEVERE` 报错。自 v6.3.2 起，这条诊断和跳过类摘要都直接链接到公开兼容性记录。例如，UltiLogin 1.0.0 装在 v6.3.2 上时：

```text
[UltiTools-API] Module 'UltiLogin-1.0.0.jar' (version 1.0.0, api-version 620) declares main: 'com.ultikits.plugins.login.UltiLogin', but it was built against an older UltiTools-API version and is not compatible with this one -- refusing to load. Upgrade it to a release of the module built for the current UltiTools-API version -- see https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md for the list of APIs removed or changed in this release. Cause: java.lang.IncompatibleClassChangeError: class com.ultikits.plugins.login.UltiLogin overrides final method com.ultikits.ultitools.abstracts.UltiToolsPlugin.unregisterSelf()V
```

自 v6.3.0 起，这样被拒绝的模块会计入启动摘要 `[UltiTools-API] Succeeded loaded <s>, Failed <f>.` 中的 `Failed`。本次启动中其它未能加载的模块 JAR 也同样计入：读取主类时被拒绝的、因缺少必需插件或依赖成环而被排除的，以及注册失败的。已加载模块的第二个通过 API 准入的副本不计入；自 v7.0.0 起，因 API 声明被拒的副本仍各计入一次 `Failed`。模块目录中的 JAR 全部被拒绝时，摘要为 `Succeeded loaded 0, Failed <n>.`；`No UltiTools plugin found.` 只在目录中没有任何模块 JAR 时出现。v6.3.0 之前，摘要只统计进入注册阶段的模块，所以一次拒绝了模块的启动仍可能打印 `Failed 0`。

自 v6.3.0 起，主类仍重写 `unregisterSelf()` 或 `reloadSelf()`（二者自 6.3.0 起为 `final`）的模块会在加载时被整体拒绝，日志为上面的 `built against an older UltiTools-API version` 一行；在 `@PluginDependency(depends = ...)` 中声明依赖它的模块也会被拒绝，与任何缺失的硬依赖相同。只在 `softDepends`、`loadBefore` 或 `loadAfter` 中提到它的模块仍会加载，其余无关模块同样照常加载。修复办法是换用为当前 UltiTools-API 版本构建的模块版本；模块作者需把重写中的工作移到 `onUnregister()` 或 `onReload()`。

[jls13]: https://docs.oracle.com/javase/specs/jls/se21/html/jls-13.html

### 新增的注解属性

缺失的方法或字段会以链接错误的形式明确失败，缺失的注解属性则不会：JVM 会丢弃运行时注解类型中没有声明的属性，并且不输出任何日志。自 v6.3.0 起，`@Scheduled(config = ..., periodKey = ..., delayKey = ...)` 和 `@CmdCD(config = ..., key = ...)` 可以从配置项读取间隔或冷却时间。使用了它们的模块在 6.2.x 框架上仍然可以加载，此时被绑定的 `@Scheduled` 只会在加载时执行一次，而不是按间隔重复执行，被绑定的 `@CmdCD` 则完全不会执行冷却。

提高 pin 无法避免这种情况，原因见 [pin 与 `api-version`](#pin-与-api-version)。在 6.x 中，使用了任一种绑定的模块必须声明至少 `630`（面向 6.3.0 时为 `api-version: 630`），这样旧框架会在加载时拒绝它。自 v7.0.0 起，无论是否使用绑定，模块都必须针对 7.0 重新构建并声明至少 `700`。为了让这个错误在你开发所用的版本上就暴露出来，6.3.0 自身也会拒绝使用了绑定、却声明了更低 `api-version` 的模块，并给出模块名、绑定和所需的下限。`@Scheduled(period = 6000)`、`@CmdCD(60)` 这类已有的字面量用法不受影响，无需修改。

## 同一模块的两个副本

自 v7.0.0 起，被 API 准入检查拒绝的 JAR 不参加下面的类加载顺序，且各计入一次 `Failed`；旧副本不再遮蔽通过准入的新副本。框架不自动清理旧副本，服主应只保留一份。

自 v6.3.0 起，UltiTools 按文件名顺序（按普通字符串比较）读取 `plugins/UltiTools/plugins/` 中的 JAR，并按同样的顺序构建模块类加载器。v6.3.0 之前的顺序是文件系统列出的顺序，Java 并不规定这个顺序，所以同一个目录在另一台机器上可能加载另一个副本。

模块 JAR 由其 `plugin.yml` 的 `main:` 项识别。两个或更多通过准入的 JAR 声明同一个 `main:` 类时，类来自按上述顺序排在最前、且带有这个类的那个 JAR，其余副本被拒绝。只要有 JAR 提供类，启动时就会输出一条警告，列出声明该主类的每一个副本（自 v7.0.0 起也包括被 API 检查拒绝的副本），以及类实际加载自哪个 JAR：

```text
[UltiTools-API] 以下 JAR 文件都声明了同一个模块主类 com.example.MyModule：MyModule-1.0.0.jar, MyModule-1.1.0.jar。该模块的类只从 MyModule-1.0.0.jar 加载，其余副本不会加载；请只保留其中一个。
```

自 v7.0.0 起，启动时只有这个排在最前的副本的早期钩子可能运行，且只运行一次；见[启动阶段与早期钩子](/zh/guide/advanced/startup-phases#重复副本与顺序)。

这里不比较版本号。上例中较旧的 `1.0.0` 继续运行，原因是它的文件名排在前面，与两份 `plugin.yml` 中写的版本无关。v6.3.0 之前，每个被拒绝的副本各自输出一条错误日志，而不是这一条警告。

`/upm uninstall` 会删除所有副本。自 v6.3.0 起，它删除每一个 `plugin.yml` 的 `main:` 指向该模块主类的 JAR，不论这个 JAR 声明的 `name:` 是什么，并在回复中列出每一个被删除的文件。

只要这样的副本会胜出，`/upm update` 就拒绝更新该模块。自 v6.3.0 起，它在下载任何东西之前，先在模块目录中查找另一个声明了该模块 `main:`、且文件名排在新 JAR 文件名之前的 JAR。自 v7.0.0 起，因 API 声明被拒的副本不作为这种阻挡更新的类路径副本。找到时，新版本在这里永远无法加载：那个副本会继续提供模块的类，每次启动都会把更新回滚。所以命令不暂存任何东西，并在回复中列出新 JAR 和每一个这样的副本。移走它们后再次执行 `/upm update` 即可，中间不需要重启。文件名排在新 JAR 之后的副本不会阻止更新，上文的启动警告仍会列出它。

## 按 API 级别选择版本

自 v6.3.0 起，`api-version` 会在两处被检查：启动时由模块加载器检查，见 [pin 与 `api-version`](#pin-与-api-version)；`/upm` 从 UltiCloud 安装或更新模块时也会检查。

UltiCloud 从发布到它上面的每个 JAR 的 `plugin.yml` 中读取 `api-version`，与该版本一起保存。没有整数 `api-version` 的 JAR 在上传时被拒绝，见 [UltiKits CLI](/zh/guide/advanced/ultikits-cli#模块的-api-级别)。UltiCloud 开始读取级别之前发布的版本，记为面向 6.3.0 之前的框架构建。

服务器会被提供、也会安装哪些版本，取决于它运行的框架：

| 服务器运行的框架 | 提供并安装的版本 |
|---|---|
| UltiTools-API 7.0 起 | 整数 `api-version` 从 700 到框架自身的 API 级别（7.0.0 为 700） |
| UltiTools-API 6.3.0 至 6.x | `api-version` 从 630 到框架自身的 API 级别（6.3.0 为 630） |
| UltiTools-API 6.3.0 之前 | 只有 `api-version` 低于 630 的版本 |

6.3.0 至 6.x 的服务器在查询模块版本时带上自己的级别（`apiLevel`，以及 `minApiLevel=630`）：6.3.0 在每个目录请求中都带，自 v6.3.1 起只在模块版本路由上带。6.3.0 之前的框架不带级别，UltiCloud 把这样的请求视为来自 6.3.0 之前的框架，所以已发布的 6.2.x 服务器不会被提供为 6.3.0 构建的版本。这适用于 `/upm install`、`/upm install <模块> <版本>`、`/upm versions`、`/upm update` 以及启动时的更新检查。更新检查只报告本服务器能安装的版本，从不提及需要更新 UltiTools-API 的版本。`/upm list` 仍列出目录中的全部模块；对没有兼容版本的模块点击安装，会回复原因。

自 v6.3.2 起，启动更新检查完成之前（包括管理器尚未创建时），`/upm check`、`/upm update <模块>` 和 `/upm update all` 回复 `更新检查仍在进行，请稍后重试。`。命令不读取部分结果，更新命令不下载或暂存任何内容。它们读取已完成的启动检查结果，不会发起新检查，请等待完成后重试。检查已经完成但部分查询失败时，则报告 `更新检查未完成：无法确认 <名称> 的最新版本。`。

自 v7.0.0 起，模块版本请求改为 `apiLevel` 和 `minApiLevel=700`，`/upm install` 与 `/upm update` 下载后也使用同一整数解析和 700 下限；高于框架自身级别的下载仍被拒绝。下面的 630 范围和回复示例保留为 6.x 行为，不适用于 7.0。

`/upm` 还会检查下载到的文件。`/upm install` 先把 JAR 写入模块目录，文件名是模块加载器永远不读的 `<id>-<version>.jar.part`，然后重新读取其中的 `plugin.yml`；`/upm update` 对它下载到 `.ultikits/upm-transactions/` 的副本做同样的检查。`api-version` 缺失、不是整数、低于 630 或高于框架级别的模块会被拒绝：下载的文件被删除，模块目录不写入任何东西。对 `/upm update` 来说，暂存的下载被丢弃，不记录任何更新。回复会写明模块声明的级别、框架的级别和接受的范围。使用 `language: zh` 时：

```text
无法安装 ultirecipe：云端没有可以安装在本服务器上的版本。本 UltiTools-API 的 API 级别是 630，只安装声明 api-version 630 到 630 的模块。模块目录没有任何改动。
已拒绝安装 ultirecipe 1.0.0：下载的 JAR 声明 api-version 620。本 UltiTools-API 的 API 级别是 630，只安装声明 api-version 630 到 630 的模块。下载的文件已删除，模块目录没有任何改动。
ultirecipe 没有可以安装在本服务器上的版本。本 UltiTools-API 的 API 级别是 630，只安装声明 api-version 630 到 630 的模块。
```

第一行是 UltiCloud 回答没有兼容版本时安装命令的回复，第二行是下载到的 JAR 声明了其它级别时的回复，第三行是 `/upm versions` 没有兼容版本时的回复。因同样原因被拒绝的更新回复 `<模块> 的更新未能暂存：`，后接原因。

对模块作者来说，这有三点影响：

- 要让模块能在 6.3.0 上通过 `/upm` 安装，应以整数形式声明 `api-version: 630`。为 6.2.x 构建的版本（`api-version: 620`）在 6.3.0 上会被 `/upm` 拒绝。官方模块的 6.2.x 构建都覆盖了 6.3.0 改为 final 的 `UltiToolsPlugin.unregisterSelf()`，本来也无法加载。
- 把 `api-version` 提高到 630 以上，除了加载器会在级别更低的框架上拒绝它之外，这些服务器也看不到这个版本。
- 服主手动复制到模块目录的 JAR 只按加载器的规则判断，与 `/upm` 无关。

`PluginInstallUtils.installLatestPlugin`、`installPlugin` 和 `updatePlugin` 签名不变，对这样被拒绝的模块返回 `false`。

::: warning 不过滤的目录
目录忽略 `apiLevel` 时（例如自建的 `api-url`），`/upm versions` 和更新检查可能列出 `/upm install` 或 `/upm update` 下载后才拒绝的版本。
这种情况下由下载后的检查保护服务器。
:::

## 在服务器上更新和卸载

自 v6.3.0 起，`/upm update <模块>` 不再在服务器运行期间替换 JAR。它把新版本下载到服务器根目录下的 `.ultikits/upm-transactions/` 并记录下来，在下次启动之前模块目录不会有任何变化。下次启动时，在任何模块加载之前，旧 JAR 被移到一旁保留，新 JAR 被移入。模块加载完成后，只有观察到你的模块确实从新 JAR 以新版本加载，这次更新才会保留；否则新 JAR 被移除、旧 JAR 放回原处，启动日志列出两个版本，并说明恢复的版本会在下次启动时加载。

对模块作者来说，这有两点影响：

- 新 JAR 的 `plugin.yml` 必须声明 UltiCloud 为它提供的那个版本。声明了其它版本的下载会在任何记录写入之前被拒绝。
- 无法加载的发布，例如出现链接错误或 `registerSelf()` 抛出异常，会被回滚，而不是留在服务器上。

移动失败时，例如目录只读或文件被占用，模块目录保持不变，当前版本照常加载。启动日志会报告这一情况，下次对该模块执行 `/upm update` 时也会再次报告。`plugins/` 与服务器根目录不在同一个文件系统上时，移动会被拒绝，并输出一条列出两个目录的错误日志。

自 v6.3.0 起，更新只会移动、替换或删除 SHA-256 与其记录一致的文件：下载的 JAR，或它移到一旁保留的旧 JAR。如果这些文件中的某一个被其它东西改动了，或者更新需要空出的位置上出现了文件（例如新 JAR 文件名下的一份副本），更新不会对任何文件做任何操作。它会把记录保留为“等待管理员处理”的状态，启动日志会列出每一个不符合的文件，以及预期的哈希和实际找到的哈希。之后的启动只会重复这条日志，不做其它操作；在处理之前，对该模块执行 `/upm update` 和 `/upm uninstall` 都会被拒绝。处理方法：检查日志中列出的文件，从 `.ultikits/upm-transactions/` 取回需要的 JAR，然后删除日志中列出的更新记录及其同名文件夹。

`/upm uninstall <模块>` 通过框架完整的卸载流程卸载该模块的每一个已加载实例，删除它的 JAR，并取消该模块仍在等待下次启动的更新，不论命令里用的是该模块的哪一个名称。当下无法删除的 JAR，例如在 Windows 上运行中的服务器会一直占用每一个模块 JAR，会被记录下来，并在下次启动时、任何模块加载之前删除。

自 v6.3.0 起，下次启动在删除已记录的 JAR 之前，会先确认它仍是卸载时记录的那个文件。如果读取这个 JAR 失败而无法确认，它会保留在原处，因此该模块在这次启动中仍可能加载；启动日志会以 SEVERE 级别报告这个 JAR 和读取错误，这次删除继续保持记录，留到再下一次启动。

如果这次删除也无法记录，例如文件系统是只读的，`/upm uninstall` 的回复只列出需要手动删除的模块 JAR，并另起一行说明这次删除未能记录，因此下次启动不会删除它们。

如果模块自己的卸载钩子抛出异常，包括它没有声明的受检异常，框架仍会释放该模块注册的全部内容：命令、监听器、计划任务、Tab 补全器、EventBus 处理器和面板响应器，并关闭它的容器。`/upm uninstall` 的回复先是一行错误，说明模块已从已加载列表移除、但其卸载过程抛出了异常（详情见控制台），随后是一行说明该模块的 JAR 已删除。

## 各模块的现状

为 UltiTools-API 6.3.0，每个官方模块都发布了新的 MAJOR 版本：`2.0.0`，UltiEconomy 为 `3.0.0`。在此之前，有两个模块在本页存在之前各自作了判断，而且结论相反：一个用 MINOR 表示 bug 修复，另一个用 MAJOR 表示新功能，都不符合上面的表格。这些较早的版本没有回溯修改版本号，因为已经发布的版本号服主可能已经记录在某处。
