# 配置文件

UltiTools提供了优雅的单例模式的封装API，让你可以像操作对象一样操作配置文件。

## 创建 YAML 配置文件

首先，你需要在 `resources` 文件夹中创建一个 `config` 文件夹。按照你的需求放入你的插件配置文件。这些配置文件会被原封不动的放入UltiTools插件的集体配置文件夹中展示给用户。

## 操作配置文件

### 创建配置文件对象

根据你的配置文件的键值对结构，创建一个类，继承 `AbstractConfigEntity` 类。

<<< @/../examples/src/main/java/com/ultikits/docs/config/SomeConfig.java

::: warning 构造函数要求（自 v6.3.0 起）
构造函数保持廉价、无副作用；验证和保存准备可能构造临时实例。
:::

#### @ConfigEntity

`@ConfigEntity` 注解用于标记一个配置文件的位置，需要一个字符串参数，用于指定配置文件在插件配置文件夹中的路径。通常这个路径与你在开发过程中resource文件夹目录中的路径是相同的。

但是这里的字符串也可以指向一个文件夹。如果你指定的是一个文件夹，则该文件夹下只有 `.yml` 文件会被加载为当前配置类，其余类型会被静默跳过。

```java
@Getter
@Setter
@ConfigEntity("test")  // 这里是一个文件夹
public class TestConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "testString")
    private String testString = "test";
    ...
}
```

::: warning 注意

如果你指定的是一个文件夹，那么你需要确保文件夹下的所有配置文件都是可被同一配置类读取的。这里的检测不会检测子文件夹。

:::

你可以通过 `UltiToolsPlugin#getConfigs` 方法来获取所有被加载的配置类。

```java
List<TestConfig> configs = BasicFunctions.getInstance().getConfigs(TestConfig.class);
```

或者你可以直接指定一个文件夹内的配置文件的路径来获取配置类。

```java
TestConfig config = BasicFunctions.getInstance().getConfig("test/test1.yml", TestConfig.class);
```

#### @ConfigEntry

`@ConfigEntry` 注解用于标记一个配置项，

自 v6.3.0 起，`path` 中的点仍表示嵌套路径，例如 `chat.aliases`。绑定映射里的键则完整保留，支持 `g.m`、`o.O`、`wave.`。6.2 已经拆开的文件原样读取，不自动合并；`Map<String, String>` 中形状为嵌套映射的值跳过并警告。

自 v6.3.0 起，服主把设置写成带点的扁平键时就是该设置：对 `path = "features.chat"`，`features.chat: false` 这一行读作 `false`，与 6.2 经 Bukkit 读取时相同；点以任何方式拆分都算（`a.b.c` 写成 `a.b:` / `c: 1` 也可以）。框架不会再补一份嵌套写法：启动补键、`save()`、`saveOperatorChange`、`saveOperatorMapEntry` 和面板编辑都只写这一行。`@ConditionalOnConfig` 和 `isPresentInFile` 按同样规则读取。同一文件里一个设置写了两种形式（`features.chat: false` 和 `features:` / `chat: true`）时，即使值相同，也在模块代码运行前拒绝加载该模块，提示只写文件和设置，不写值。此规则只针对设置路径，绑定映射里的键仍完整保留。

字面 `comment` 在插入该键时写入。恰好是一个去除首尾空白后的语言 token（例如 `comment = "{config.limit}"`）时，按框架当前 `language` 从模块语言目录解析。自 v6.3.0 起，框架只改写它能认出是自己写的注释行：该项的注释整体或末尾连续几行，与框架对模块 jar 自带任一语言目录中的文字、模块当前解析出的文字、原样 token，或 `previousComments` 中登记的旧版出厂文字写出的形式逐字节相同（该项的缩进、`# ` 加文字）。服主在该项上方写的注释、改过的框架注释和所有字面注释逐字节保留。启动和 `/ul reload` 会把框架自己的注释行刷新为当前语言；保存、服主操作写入和面板编辑不改写任何注释。目录缺键时保留 token 并警告一次，写 YAML 注释前清理换行和控制字符。

模块修改了某个 token 注释在语言目录中的文字后，已升级的服务器上仍是旧文字。把旧文字登记下来，它就会继续随语言切换：

```java
@ConfigEntry(path = "lock.timeout", comment = "{config.lock.timeout}",
        previousComments = {"Lock timeout in seconds"})
private int lockTimeout = 30;
```

自 v6.3.0 起，`parser` 保持默认即使用声明类型转换器注册表。显式非默认旧解析器收到的恰好是 6.2 给它们的输入：通过全新的 Bukkit `YamlConfiguration#get` 得到的隔离输入，保留 6.2 配置节拆分点号键的行为，并在根值、列表和映射内部反序列化 `==` 别名；显式使用旧解析器的 `Object` 字段也一样。这条输入路径不使用注册表转换器，输出仍经过普通数据边界并保留包装数值拓宽。Bukkit 自身的别名限制不变：Vector 坐标为整数时反序列化为 null，带小数部分时正常反序列化。六项相关声明在 6.3.0 首次带 `forRemoval`，公告删除版本为 6.4.0。新代码使用[配置转换器](/zh/guide/advanced/config-converters)，不再继承 `DefaultConfigParser`。

#### 数值字段

自 v6.3.0 起，基本类型和包装类型使用相同数值转换规则。面板 JSON 中 long 范围内的整数使用 `Long`，超出 long 范围的整数以 `BigInteger` 精确保留；小数仍使用既有 `Double` 路径。整数收窄必须值精确且在范围内，`'30'` 等数值文字可以绑定整数。小数绑定 `float`/`Float` 时，读出的 float 最短可打印十进制必须与原十进制数值相同：`0.03`、`1.50` 可用，`0.100000001` 不可用。无效字段使用声明默认值并记录定位警告；更多十进制精度使用 `double`，float 接受不表示二进制精确。

`int`、`long`、`Integer`、`Long` 还可以驱动任务间隔和命令冷却，见[配置绑定时间](/zh/guide/advanced/scheduled-tasks#绑定到配置项的时间)与[配置绑定冷却](/zh/guide/essentials/cmd-executor#配置项绑定的冷却时间)。配置必须恰好注册一次，目录实体不能绑定。避免同时使用 [`@Range`](/zh/guide/advanced/config-validation)，绑定已有范围检查。

#### 集合与 null

自 v6.3.0 起，完整继承泛型参与列表、集合、队列、映射、数组和枚举转换。无效集合/映射元素跳过并警告，整个字段形状无效时使用最初声明默认值。警告定位文件、键、位置、类型，并隐藏密钥形状的值。未知声明类型在读写任何配置文件前拒绝模块加载；登记转换器，不把原始映射偷偷传入自定义类。

整个 null 字段和映射中的 null 值仍可往返，基本类型 null 无效。类型化集合（包括 `List<Object>`）和引用数组（包括 `Object[]`）写入时省略 null 元素，每个字段记录一条定位警告。读取时，文件中类型化集合里的 null 元素同样被跳过并给出定位警告，与 6.2 一致；声明为 `Object` 的普通数据槽保持普通数据。UUID 和枚举使用普通文字，注册的 Bukkit `ConfigurationSerializable` 使用别名映射。未显式使用旧解析器时，读进 `Object` 槽的 Bukkit 对象仍是普通映射。未知运行时 Java 对象拒绝保存，不触碰文件。

#### @Getter 和 @Setter

`@Getter` 和 `@Setter` 则为Lombok注解，用于自动生成 `getter` 和 `setter` 方法。

### 获取配置文件对象

继承了 `UltiToolsPlugin` 的主类中，有一个 `getConfig` 方法，用于获取配置文件对象。 

你需要获取插件主类的实例，然后调用 `getConfig` 方法。

```java
SomeConfig someConfig = SomePlugin.getInstance().getConfig(SomeConfig.class);
```

然后，你就可以使用 `getter` 和 `setter` 方法来操作配置文件了。

```java
boolean something = someConfig.getSomething();
```

::: tip 设置与保存
自 v6.3.0 起，服务器关闭时不会保存任何配置。代码做出需要写入文件的改动时，请调用 `save()`。
:::

自 v6.3.0 起，服务器关闭、模块卸载或模块被替换时都不写任何配置。从未保存的模块改动以一条 WARNING 列出（只列文件和键，不列值），随后丢弃；`ConfigManager#saveAll()` 不再写入并已标记弃用。服务器运行期间服主对文件所做的修改不会因关闭而被改动。上次加载时无法读取或解析的文件改为提示一次。面板只确认触及的字段，无关的未保存字段仍未保存。

服务器运行时，初始化、重载和 ConfigManager 注册表操作限主线程。异步 void 操作警告且不执行；注册表 getter、JSON 读写警告并抛 `IllegalStateException`。面板更新、上传、重连回调整体排到主线程，执行后回复。实体监视器串行化持久化，但不保护模块自己异步修改字段；请安排在主线程修改和重载。

模块 `getConfig(Class)` 仍返回实体。实体旧的可变 Bukkit `getConfig()` 在 v6.3.0 通过维护者一次性兼容 carve-out 删除；它在 6.2.5 确实可用，第三方用量未知。用 `isPresentInFile("entry.path")` 查上次成功加载的存在性（null 和未声明键也算），它拆分点号，不能定位映射完整点号键。修改声明字段后调用 `save()`。

::: tip 由谁写入配置
配置是给服主读取和编辑的。只在服主要求某项改动时写入，优先使用 `saveOperatorChange` 或 `saveOperatorMapEntry`（见[保存配置文件](#保存配置文件)）。
如果你的插件需要自行持久化数据，请改用[数据存储](/zh/guide/essentials/data-storage)。
:::

## 注册配置文件

### 自动注册

因为UltiTools提供了自动注册功能，所以你无需手动注册配置文件，只需要在你的配置文件类上添加 `@ConfigEntity` 注解即可。

请查看[这篇文章](/zh/guide/advanced/auto-register)来了解更多关于自动注册的内容。

### 手动注册

你可以重写你的插件主类中的 `getAllConfigs` 方法来注册配置文件。
这条路径仅在插件主类未启用自动配置注册（`@EnableAutoRegister` 或 `@UltiToolsModule`，其 `config` 属性默认为 `true`）时才会生效：一旦启用，`getAllConfigs` 就不会被调用，即使你重写了它。`@ConfigEntity` 在两条路径下都是必需的，但它本身并不决定哪条路径生效。

```java
@Override
public List<AbstractConfigEntity> getAllConfigs() {
    return Collections.singletonList(new SomeConfig("some/path/to/config"));
}
```

## 配置校验 <Badge type="tip" text="v6.2.0+" />

从 v6.2.0 开始，UltiTools 提供了校验注解来防止无效的配置值。详情请参阅[配置校验](/zh/guide/advanced/config-validation)指南。

<<< @/../examples/src/main/java/com/ultikits/docs/config/MyConfig.java

可用的校验注解：`@Range`、`@NotEmpty`、`@Size`、`@Pattern`（来自 `com.ultikits.ultitools.annotations.config` 包）。

## 保存配置文件

### 写入约定

自 v6.3.0 起，框架绝不覆盖服主写的配置，除非服主要求了这项改动。代码可以写什么，取决于文件归谁所有：

| 文件 | 代码可以写入 |
|---|---|
| 模块自带的配置文件（`config.yml`、`spawn.yml`） | 文件不存在时首次创建；补入文件缺少的声明键和框架自己的注释，只插入；服主通过命令、面板或 GUI 明确要求修改的那一项；语言切换后，仍与出厂文字相同的值重新渲染 |
| 服主自己创建的文件（礼包、菜单） | 服主执行创建操作时创建文件；编辑时只写编辑的部分 |

除此之外一律不写：不在关闭、卸载或替换时保存，不修复无效值，不规整排版，也不清理 6.2 按点号拆开的映射键。

所有写入都经过同一个写入闸门。每次写入声明自己拥有的键；渲染后，这些键之外的每个字节必须与读取时相同，且文件仍须是读取时的内容。否则不写入：一条 WARNING 列出文件、键和原因，不列值，程序继续使用内存中的值。

对显式写入来说，`IOException` 总是表示文件保持原来的字节。被拒绝时是 `ConfigWriteRefusedException`；发布文件失败时是普通 `IOException`，自 v6.3.0 起框架会先把文件放回原样再抛出（见[原子替换](#原子替换)）。因此，在 `IOException` 时撤回内存改动的模块会与文件保持一致。

官方语言文件是唯一的例外。它们归框架所有，升级时可能被替换；要定制文字，请复制官方文件并改名，编辑副本，再在主配置中选择它（见[国际化](/zh/guide/essentials/i18n)）。

### `save()`

自 v6.3.0 起，`save()` 只写模块自上次加载或保存以来改过的设置，并且只在文件该处仍是读取时的值时才写。声明为 `Map` 的设置按条目写入；列表，以及 `Location`、`Vector` 这类 Bukkit 值，要么整体写入，要么不写。保存从不补入文件缺少的键，从不改写注释，也从不删除模块没有删除的映射条目。

因此，服主在磁盘上改过的值、删掉的键，以及框架无法使用的值（`interval: 3O0`）都不会被覆盖。模块的改动留在内存中，一条 WARNING 列出该键。比较依据是上次读取的文字：服主不经 `/ul reload` 直接在磁盘上改过某个设置后，即使值不变（例如把 `64` 改成 `64.0`），模块对该设置的下一次改动也不会写入，直到重载重新读取文件。没有内容可写的保存不改动文件字节和修改时间。

### 服主命令

按服主要求只修改一项内容的命令，使用 v6.3.0 新增的两个方法之一。服主的请求即表示同意：在指定的键处，模块的值替换文件中的内容，其余一律不写。

```java
// /setspawn：只写六个位置设置
config.setSpawn(player.getLocation());
config.saveOperatorChange("spawn.location.world", "spawn.location.x", "spawn.location.y",
        "spawn.location.z", "spawn.location.yaw", "spawn.location.pitch");

// /autoreply add <name>：只写一个映射条目，服主手加的条目保留
config.getRules().put(name, rule);
try {
    config.saveOperatorMapEntry("autoreply.rules", name);
} catch (ConfigWriteRefusedException refused) {
    config.getRules().remove(name); // 让内存与文件保持一致
    sender.sendMessage("未保存：" + refused.getReason());
}
```

用 `saveOperatorChange` 指定整个映射设置会整体写入，并丢掉服主手加的条目；只改一个条目的命令应使用 `saveOperatorMapEntry`。被拒绝时抛出 `com.ultikits.ultitools.config.ConfigWriteRefusedException`，它是 `IOException`，`getReason()` 说明原因、不含任何值：请回复服主未保存及原因，并撤回内存中的改动，使运行状态与文件一致。路径不是已声明的配置项时抛 `IllegalArgumentException`。两个方法都在服务器主线程执行。

### 存在性条件

自 v6.3.0 起，映射条目的写入还可以取决于该条目是否已在文件中。把 `EntryPresence` 作为 `saveOperatorMapEntry` 的第一个参数传入：新建条目的命令用 `MUST_BE_ABSENT`，这样不会替换服主在上次重载之后手动添加的同名条目；修改已有条目的命令用 `MUST_BE_PRESENT`，这样不会把服主删掉的条目写回去。模块不必自己读取文件：

```java
// /autoreply add <name>：仅当文件里还没有同名规则时才新建
config.getRules().put(name, rule);
try {
    config.saveOperatorMapEntry(EntryPresence.MUST_BE_ABSENT, "autoreply.rules", name);
} catch (ConfigEntryPresenceException exists) {
    config.getRules().remove(name);
    sender.sendMessage("文件里已有名为 " + name + " 的规则；执行 /ul reload 后即可看到。");
} catch (ConfigWriteRefusedException refused) {
    config.getRules().remove(name);
    sender.sendMessage("未保存：" + refused.getReason());
}
```

条件在写入闸门据以校验这次写入的同一次读取上判断；此后保存的改动会让闸门以文件已被改动为由拒绝写入。条目存在，指它的完整键路径在框架读取该设置的位置上存在：嵌套键或扁平的带点键，再接映射键，每个都是一个完整的键。值为 `null` 的条目（`name: ~`）算存在；上级键缺失、为 `null`、为空映射（`{}`）或不是映射时，条目算不存在；缺失或只有注释的文件不含任何条目。

条件不成立时不写入，并抛出 `com.ultikits.ultitools.config.ConfigEntryPresenceException`。它是 `ConfigWriteRefusedException`：`getRequired()` 给出不成立的条件，`getReason()` 给出条目的键路径。框架对此只记 FINE 级日志，由你的命令告诉服主。条件为 `null` 时抛 `IllegalArgumentException`。原来的两参数 `saveOperatorMapEntry` 不变。

### 被拒绝的写入

文件无法读取或解析、使用了 YAML 锚点、别名或合并键、读取后被改动，或者排版无法被渲染器逐字节写回时，写入会被拒绝。排版引起的拒绝会给出要修改的行号，例如 `the file's layout outside the keys this write owns would change (line 16)`。

自 v6.3.0 起，YAML 库在应用、渲染或校验一次写入时抛出的运行时异常也按拒绝处理。把映射写入一个值为 `null` 且带行内注释的条目（`foo: ~  # placeholder`）就是这样的排版。原因会给出键、失败的步骤和异常类名，例如 `the file cannot be written at autoreply.rules.foo: rendering the document failed (EmitterException)`。此前该异常会直接传到调用方，只在 `IOException` 时回滚的模块会保留内存中的改动。

会使该文件所有写入都被拒绝的排版包括：只含空格的行、值后面的行尾空格、用多个空格对齐的行内注释、冒号后多于一个空格、流式方括号内侧的空格（`[ a ]`）、`---` 或 `...` 标记、后面跟空行的块标量、缩进比下面的键更深的注释、同一文件中的两种缩进宽度，以及混用的换行符。框架和各模块自带的文件都没有这类排版。服主改掉警告指出的那一行（如果原因是“文件在读取后已被改动”，则先执行 `/ul reload`），再重做一次改动即可。

0 字节文件、只有空行的文件和只含行首注释的文件视为空文件：启动时补入声明的键。只含空格的文件、含缩进注释的纯注释文件和只含 BOM 的文件按排版拒绝。

自 v6.3.0 起，紧跟在某个“冒号后没有值”的键（如 `c:`）之后的插入同样会在每次启动时被拒绝，原因为 `a key this write owns shares line N with a key it does not own`（[#628](https://github.com/UltiKits/UltiTools-Reborn/issues/628)，未修复）。要把文字设置留空，请写 `key: ''`，这种写法会保留且不会被拒绝。

### 读取器无法读取的排版

自 v6.3.0 起，有两种合法的 YAML 排版无法被框架保留注释的读取器（Paper 自带的 SnakeYAML 2.2）读取。这样的文件按无法解析处理：永不写入，启动时模块使用声明的默认值（重载则保留运行中的值），并由 SEVERE 日志 `Cannot load <file>: <parser location>; file will not be overwritten` 指出该文件。文件的每个字节都保持不变，改正排版后其中的值才会生效。

- 块锚点的第一个子键之前有注释，例如 `defaults: &defaults` 之后是 `# note` 和 `setting: inherited`，两行都缩进两个空格（[#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580)）。把注释移到锚点键上方，或移到第一个子键下方。
- 块标量（`content: |-` 或 `>`）后面依次是缩进大于 0 列的注释、空行、另一条注释（[#617](https://github.com/UltiKits/UltiTools-Reborn/issues/617)）。删掉两条注释之间的空行，或删掉其中一条注释。

### 删除的键、被清空的节与留空的设置

删除一个键就是服主重置设置的方法：下次启动时，框架会把文件缺少的声明键连同默认值和注释补回。要让文本设置留空，服主写空字符串（`key: ''`）；对文本设置，空字符串读作“留空”，启动、重载或保存其他设置时都不会改写它。数字、true/false 等非文本设置没有“留空”的值：在那里写 `''` 会以一条 WARNING 报告，内存中使用声明默认值，文件里的 `''` 保持不变。如果你的模块文档说明如何重置或清空某个设置，请照此说明。

自 v6.3.0 起，所在的节被服主清空的键也会补回（[#620](https://github.com/UltiKits/UltiTools-Reborn/issues/620)）。如果删除的是节里的最后一个键，节的键名会单独留在一行、冒号后什么都没有（`messages:`），读作“没有值”；删光所有子键多半是误删，所以补键会展开这一行，而不是每次启动都被拒绝。这一行是写入在补入的键之外唯一可以改动的行：它按原样保留键、注释文字和换行符，只有空白可能被规整（冒号前的空格、注释前的空格、行尾空格），所以 `messages :   # reset  ` 会变成 `messages: # reset`。节的值变成恰好是补入的那些键。服主在这一行下面注释掉的子键行留在原处、位于补回的键下面，前提是这些注释行紧跟节所在行、连成一段，并位于文件的缩进处；若前面有空行、两段注释被空行隔开，或注释比文件缩进更深，则每次启动都会拒绝补键，文件不变。`saveOperatorChange`、`saveOperatorMapEntry` 和面板编辑同样如此，所以向被清空的 `rules:` 添加第一条规则的命令会被写入，而不是被拒绝。

写成显式空值的节（`messages: {}`、`messages: ~` 或 `messages: null`）是服主自己写的值，绝不会被改动。在它下面插入会被拒绝，原因为 `the section messages (line 3) is written as an explicit empty value, which the framework does not change; to have keys added below it, delete that value so the line ends after the colon, or add the keys by hand`（[#610](https://github.com/UltiKits/UltiTools-Reborn/issues/610)）；`saveOperatorMapEntry` 会以这个原因抛出 `ConfigWriteRefusedException`。

自 v6.3.0 起，缺少的设置插入到文件已有的那个节下面，绝不写成该节的第二种形式（[#614](https://github.com/UltiKits/UltiTools-Reborn/issues/614)）。文件中 `a.b:` 下有 `c: 3`、模块声明了 `a.b.d` 时，启动会把 `d:` 写在 `a.b:` 下面，而不是另加一份嵌套的 `a:` / `b:`——Bukkit 的 `YamlConfiguration` 会把后者当作替换了扁平的节。如果该节的另一个设置把路径的剩余部分写成一个带点键（`a:` / `  b.c: 3`），缺少的设置会以同样的形式写在它旁边（`  b.d: 2`）；兄弟设置拆分方式不同时无法决定，拒绝插入。如果文件把这个节写了几种形式，设置会插入到其中唯一一个还持有该节其他声明设置的形式下；没有或不止一个形式持有时拒绝插入，写明文件和设置，内存中使用声明默认值。

### 模块代管的服主文件

自 v6.3.0 起，`com.ultikits.ultitools.config.OperatorFiles` 用于在服主明确编辑时，写入模块代服主管理的 YAML 文件，例如礼包文件。它只写指定的键，经过同一个写入闸门，并且只在文件仍是读取时的字节时写入：

```java
OperatorFiles.Snapshot snapshot = OperatorFiles.read(kitFile);
Map<List<String>, Object> edit = new LinkedHashMap<>();
edit.put(Arrays.asList(kitName, "items"), serializedItems); // 只能是普通数据
OperatorFiles.WriteResult result = OperatorFiles.write(snapshot, edit);
```

结果为 `WRITTEN`、`UNCHANGED`、`FILE_CHANGED`（`read` 之后文件被改动）或 `REFUSED`（排版或锚点问题，闸门会记一条 WARNING）。列表中的每一项是一个完整的键，名字里含 `.` 也仍是一个键。`OperatorFiles` 从不创建、删除或重命名文件，也不用于 `@ConfigEntity` 文件。

### 原子替换

单个列表项的注释仅在列表长度不变时保留；Bukkit 则完全不保留列表项注释。

先强制同步同目录临时文件，再原子替换。仅不支持原子移动、EBUSY/跨设备或允许的临时创建拒绝走备份后原地写。自 v6.3.0 起，备份文件名为 `<file>.ultitools-backup-<16 位十六进制>`，在打开目标前同步；本次运行已为同一文件写过、且内容未变的备份，先从当前目标通过同步临时文件和原子替换刷新。服主自己的 `<file>.bak` 不会被读取、写入或删除。备份失败保持目标和旧备份。自 v6.3.0 起，如果之后的原地写在打开目标后失败（写到一半中断，或 force 失败），框架先从备份写回目标原来的字节并删除备份，然后才把 `IOException` 交给调用方，因此文件保持写入前的内容。面板批次以同样方式放回它打开过的每个文件，并报告失败。

如果放回本身也失败，一条 SEVERE 列出文件和备份（从不含内容），备份保留。此后在重载之前，该配置把文件视为读取后已被改动：服主操作写入和面板编辑会以 “the file changed since it was read” 被拒绝，`save()` 不写入。服主对比文件与备份，必要时用备份覆盖文件，然后重载。成功的原地写入所用的备份，在下一次成功严格加载该文件、且备份内容仍与写入时一致时删除。

不能读取、不能解析或非 UTF-8 文件在所有实体写入路径受保护。初次失败用默认值，并以一条 SEVERE 列出文件和安全原因，不泄漏源码片段。自 v6.3.0 起，重载这样的文件会保留运行字段、不改动文件，并抛出列出文件和同一安全原因的 `ConfigurationException`；`/ul reload <模块>` 随之回复该模块重载失败及原因。成功加载才解除保护。验证在默认值、注释和面板持久化前执行。

注册批次等所有选定实体绑定验证完成才写入；拒绝批次不改文件。接受后各文件独立保存，经过写入闸门，并且只在文件仍是注册时读取的字节时写入。多文件面板先验证并暂存全部文件，然后提交且共同确认，普通进程内拒绝回滚；持久存储故障可能阻止恢复，移动中间崩溃不是安全多文件事务。

面板编辑同样是全有或全无：校验拒绝某个值，或文件写入失败时，被触及的字段恢复为原值，文件字节不变，面板收到失败结果，重试即可保存该编辑。

面板映射叶项按真实完整文件键和整个字段声明转换器处理。唯一变更保存，歧义或不存在变更拒绝整个请求并定位路径；未变显示项不算编辑。无关待保存内存和独立磁盘兄弟项保持，回复格式不变。

自 v6.3.0 起，面板编辑经写入闸门只写它指定的键：在这些键处替换服主改过的值（即服主的同意），文件的其余每个字节保持不变。闸门拒绝的文件会收到注明原因的错误回复。编辑 `Location` 这类 Bukkit 值中的一个字段时，写入的是文件中原样的整个值、只改该字段，其余字段保持服主写的文字（`y: 64` 不变），并且只在文件仍是读取时的值时写入；否则回复要求先重载。

## 重载配置文件

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```

自 v6.3.0 起，重载比较上次有效基线、运行字段、传入文件。内存独有修改保持且脏，磁盘独有采用，冲突磁盘胜并安全定位警告。映射按完整键递归，列表和标量原子处理。服主从文件中删掉的整个字段使用声明默认值，并警告一次列出该键；但模块自上次加载或保存后改过该字段时保留模块的值。两种情况都不写文件。失败的重载是全有或全无的：重载失败时（例如校验拒绝某个值），内存与调用前完全一致并重新抛出异常。被拒绝的值因此不会留在字段里，被下一次重载当作覆盖在已修正文件之上的未保存修改保留下来；修正文件后再次重载即可。文件无法读取或解析时同样如此：重载抛出列出该文件的 `ConfigurationException`。模块自己调用 `reload()` 且只捕获 `IOException` 的，应同时捕获 `ConfigurationException` 并在自己的回复里报告。磁盘该映射未变时保留内存独有顺序，重载不写入它；这不是并发映射插入顺序策略。

`/ul reload` 重建模块语言之后、模块自己的重载钩子之前，框架经写入闸门、按重新读取的文件，把它能认出的自己的注释行改写为新语言，不写任何值、键或其它注释行。

自 v6.3.0 起，新版本副本替换旧副本时不保存旧副本的任何配置。新副本按文件现状读取；激活后警告一次，列出旧副本被丢弃的文件和键。卸载释放注册表所有者，不写入任何内容。

## 已知限制

自 v6.3.0 起，[#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578) 记录特殊锚定容器、复杂符号链接路径、Unicode 风格定位成本和直接别名 token 注释所有权。别名注释可能影响源锚并重复写入。[#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580) 与 [#617](https://github.com/UltiKits/UltiTools-Reborn/issues/617) 是读取器无法读取的两种排版（见[读取器无法读取的排版](#读取器无法读取的排版)）；保护保留文件字节，不表示其中的值可以读取。[#545](https://github.com/UltiKits/UltiTools-Reborn/issues/545) 仍是多文件崩溃持久化限制。
