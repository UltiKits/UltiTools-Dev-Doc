# 配置文件

7.0.0 尚未发布。本页以 UltiTools-API 7.0 为准。使用 6.x 时，请参阅[归档的 v6.4.0 配置指南](/zh/v6.4.0/guide/essentials/config-file.html)；升级时请参阅[从 6.x 升级到 7.0](/zh/guide/advanced/upgrading-to-7)。

## 创建 YAML 配置文件

在 Java 配置类里声明键、默认值和注释。框架读取 `plugins/UltiTools/pluginConfig/<模块名>/` 下的配置，目录名来自模块根 `plugin.yml` 的 `name`。例如，`@ConfigEntity("config/config.yml")` 配合接收路径的构造器，会使用 `plugins/UltiTools/pluginConfig/<模块名>/config/config.yml`。首次初始化时，如果文件不存在，框架按声明的默认值和注释生成文件；已有文件则只在能安全写入时补缺项。这里不需要在 JAR 中放一份同名 YAML。如果 JAR 的 `config/` 下确实带了一份（例如 `src/main/resources/config/config.yml`），只要模块配置目录里还没有这个文件，框架会在初始化配置实体之前把它复制过去；配置实体随后以这份自带文件为起点，只补入其中缺少的设置，而不是按 Java 里的默认值和注释生成文件。

## 操作配置文件

### 创建配置文件对象

根据你的配置文件的键值对结构，创建一个类，继承 `AbstractConfigEntity` 类。

<<< @/../examples/src/main/java/com/ultikits/docs/config/SomeConfig.java

下面是一个完整的 7.0 单文件配置类。`@ConfigEntry` 指定 YAML 键和注释，字段初始值就是默认值。示例直接声明访问方法，不需要 Lombok。

```java
package com.example.mymodule.config;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;

@ConfigEntity("config/config.yml")
public class ExampleConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "features.chat", comment = "Enable chat features")
    private boolean chatEnabled = true;

    public ExampleConfig(String configFilePath) {
        super(configFilePath);
    }

    public boolean isChatEnabled() {
        return chatEnabled;
    }

    public void setChatEnabled(boolean chatEnabled) {
        this.chatEnabled = chatEnabled;
    }
}
```

::: warning 构造函数要求
构造函数保持廉价、无副作用；验证和保存准备可能构造临时实例。
:::

#### @ConfigEntity

`value` 指定模块配置目录下的相对路径。扫描注册单文件时优先调用 `public MyConfig(String configFilePath)`；没有这个构造器才尝试公开无参构造器，此时 `super("config/config.yml")` 里的路径应与注解一致。`SomeConfig` 示例用的是无扩展名的单文件路径；通常使用 `.yml`，例如 `config/config.yml`。

目录模式要求路径在注册时已经是一个目录。如果路径不存在，框架按单文件处理，不会把它创建为目录。框架仅扫描直属的 `.yml` 文件，不递归，每个文件用同一个配置类的 `(String)` 构造器实例化。要让新服务器上也有这个目录，把其中的文件放在 JAR 的 `config/` 下，例如 `src/main/resources/config/warps/spawn.yml`：`config/` 下自带的文件会在注册之前复制出来，注册时目录已经存在：

```java
@ConfigEntity("config/warps")
public class WarpConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "enabled")
    private boolean enabled = true;

    public WarpConfig(String path) {
        super(path);
    }
}
```

```java
List<WarpConfig> warps = module.getConfigs(WarpConfig.class);
WarpConfig spawn = module.getConfig("config/warps/spawn.yml", WarpConfig.class);
```

`module` 是当前 `UltiToolsPlugin` 实例。按路径找不到已注册的实体时，`getConfig` 返回 `null`。

#### @ConfigEntry

`@ConfigEntry` 把字段绑定到 YAML。`path` 和 `comment` 默认是空字符串，`previousComments` 默认为空数组。省略 `path` 时使用字段名。

`path = "features.chat"` 可对应嵌套写法或 `features.chat: false` 这样的扁平键；多层路径也可以混合两种写法，如 `a.b:` 下的 `c: 1` 对应 `a.b.c`。`@ConditionalOnConfig` 和 `isPresentInFile` 使用同样的查找规则。启动补缺和写入不会再创建同一设置的第二份；同一设置写成多种形式时，即使值相同也会拒绝加载或重载。映射内部的键则是完整的键，例如 `g.m` 不会被拆开。

配置文件成功解析并通过初始化校验后，框架会列出最多 10 个没有声明的最小键子树，并在有更多时报告剩余数量。继承的声明也算；声明的映射、集合、数组或转换器管理的值拥有其子树。普通重载和保存不重复报告。未声明的键可能仍由模块手工读取，不要仅凭警告删除它。日志原文不受语言设置影响，不含值：

```text
Module 'MyModule', file 'config/config.yml', key 'obsolete': no @ConfigEntry declaration for this key/subtree; left unchanged
Module 'MyModule', file 'config/config.yml': 2 more keys have no @ConfigEntry declaration (not listed); left unchanged
```

::: info 配置注释令牌（自 v7.0.0 起）
形如 `{config.lock.timeout}` 的注释由模块的 `messages/` 目录按服务器后备语言解析。
:::

字面 `comment` 在插入该键时写入。去除首尾空白后恰好是一个令牌的注释，按[注解文本规则](/zh/guide/essentials/messages#module-annotation-text)取纯文本，查找时也可回退到模块的源语言。找不到时保留令牌，每次配置加载对该字段最多告警一次，例如 `Module MyModule, file config/config.yml, path 'lock.timeout': missing comment catalogue key 'config.lock.timeout'`。写入 YAML 注释前会清理换行和控制字符。

启动和 `/ul reload` 只刷新框架能识别为自己写过的令牌注释：整段或连续末尾几行必须逐字匹配任一随包译文、当前解析文字、原样令牌或 `previousComments` 中登记的文字。其他注释保持原样；如果手写文字恰好匹配，也会被当作框架注释。保存、服主命令写入和面板编辑不刷新注释。

自 v7.0.0 起，不再从 `lang/` 读取译文；将旧注释键移至 `messages/<locale>.yml`。如果已落盘的出厂译文与新译文不同，在 `previousComments` 中列出旧文字：

```java
@ConfigEntry(path = "lock.timeout", comment = "{config.lock.timeout}",
        previousComments = {"Lock timeout in seconds"})
private int lockTimeout = 30;
```

在模块的 `src/main/resources/messages/en.yml` 中定义该键：

```yaml
config.lock.timeout: "Maximum time to wait for the lock"
```

更换覆盖译文或后备语言后，原注释如果不再匹配已知文字，会作为服主内容保留。若想恢复当前生成的注释，只删除附在该设置上的旧注释，不删键，也不要留下裸 `#`；如果该设置已没有附带注释，下次成功且可写的启动或重载会补回。自定义字段类型见[配置转换器](/zh/guide/advanced/config-converters)。

#### 数值字段

基本类型和包装类型使用相同数值转换规则。面板 JSON 中 long 范围内的整数使用 `Long`，超出 long 范围的整数以 `BigInteger` 精确保留；小数使用 `Double`。整数收窄必须值精确且在范围内，`'30'` 等数值文字可以绑定整数。小数绑定 `float`/`Float` 时，读出的 float 最短可打印十进制必须与原十进制数值相同：`0.03`、`1.50` 可用，`0.100000001` 不可用。无效字段使用声明默认值并记录定位警告；更多十进制精度使用 `double`，float 接受不表示二进制精确。

`int`、`long`、`Integer`、`Long` 还可以驱动任务间隔和命令冷却，见[配置绑定时间](/zh/guide/advanced/scheduled-tasks#绑定到配置项的时间)与[配置绑定冷却](/zh/guide/essentials/cmd-executor#配置项绑定的冷却时间)。配置必须恰好注册一次，目录实体不能绑定。避免同时使用 [`@Range`](/zh/guide/advanced/config-validation)，绑定已有范围检查。

#### 集合与 null

完整继承泛型参与列表、集合、队列、映射、数组和枚举转换。无效集合/映射元素跳过并警告，整个字段形状无效时使用最初声明默认值。警告定位文件、键、位置、类型，并隐藏密钥形状的值。自 v6.3.2 起，跳过值的警告把原始值和原因显示在同一条日志行中；密钥形状的值仍会隐藏，绑定不会修复磁盘上的原值。未知声明类型在读写任何配置文件前拒绝模块加载；登记转换器，不把原始映射偷偷传入自定义类。

整个 null 字段和映射中的 null 值仍可往返，基本类型 null 无效。类型化集合（包括 `List<Object>`）和引用数组（包括 `Object[]`）写入时省略 null 元素，每个字段记录一条定位警告。读取时，文件中类型化集合里的 null 元素同样被跳过并给出定位警告；声明为 `Object` 的普通数据槽保持普通数据。UUID 和枚举使用普通文字，注册的 Bukkit `ConfigurationSerializable` 使用别名映射。读进 `Object` 槽的 Bukkit 对象仍是普通映射。未知运行时 Java 对象拒绝保存，不触碰文件。

#### 保存的位置（`Location`） {#saved-locations}

自 v7.0.0 起，Paper 26.3 保存 `Location` 时用 `world_key`，格式为 `命名空间:路径`，不是世界名。只有旧 `world`（世界名）的 6.x 数据仍可读，无需批量改写。如果两者都有，`world_key` 优先。手动换世界时，从目标世界已保存的位置复制 `world_key`，不要根据世界名猜；若保留旧 `world`，也将它改成同一个世界的名称。只改 `world` 不会生效。

键无效，或对应世界不存在、尚未加载时，Paper 不会回退到 `world`。Paper 记录 `unknown world`，其序列化层返回 `null`；UltiTools 把它当成转换失败（例如原因 `Alias <alias> did not produce org.bukkit.Location`），而不是成功读出空值。整个字段无效时绑定使用声明默认值；类型化集合或映射中的无效项跳过。重载仍按本页下方的三方比较与校验规则处理；框架不会因此修复磁盘上的原值。单独声明为 Bukkit `World` 的字段仍使用世界名，不是 `world_key`。

#### @Getter 和 @Setter

`@Getter` 和 `@Setter` 则为Lombok注解，用于自动生成 `getter` 和 `setter` 方法。

### 获取配置文件对象

继承了 `UltiToolsPlugin` 的主类中，有一个 `getConfig` 方法，用于获取配置文件对象。 

你需要获取插件主类的实例，然后调用 `getConfig` 方法。

```java
SomeConfig someConfig = module.getConfig(SomeConfig.class);
```

然后，你就可以使用 `getter` 和 `setter` 方法来操作配置文件了。

```java
boolean something = someConfig.getSomething();
```

::: tip 设置与保存
服务器关闭时不会保存任何配置。代码做出需要写入文件的改动时，请调用 `save()`。
:::

服务器关闭、模块卸载或模块被替换时都不写任何配置。从未保存的模块改动以一条 WARNING 列出（只列文件和键，不列值），随后丢弃；`ConfigManager#saveAll()` 不再写入并已标记弃用。服务器运行期间服主对文件所做的修改不会因关闭而被改动。上次加载时无法读取或解析的文件改为提示一次。面板只确认触及的字段，无关的未保存字段仍未保存。

服务器运行时，初始化、重载和 ConfigManager 注册表操作限主线程。异步 void 操作警告且不执行；注册表 getter、JSON 读写警告并抛 `IllegalStateException`。面板更新、上传、重连回调整体排到主线程，执行后回复。实体监视器串行化持久化，但不保护模块自己异步修改字段；请安排在主线程修改和重载。

`UltiToolsPlugin#getConfig(Class<T>)` 返回配置实体；它不是 Bukkit 的可变 YAML 对象。`isPresentInFile("entry.path")` 查上次加载读到的键而非字段当前值，显式 `null` 和未声明的键也算存在。遇到无法读取或解析的文件时，不能用它认定键存在。修改声明字段后，用实体的 `save()` 或模块的 `saveConfig(String path, Class<T> type)` 显式保存；两者都声明 `throws IOException`。

::: tip 由谁写入配置
配置是给服主读取和编辑的。只在服主要求某项改动时写入，优先使用 `saveOperatorChange` 或 `saveOperatorMapEntry`（见[保存配置文件](#保存配置文件)）。
如果你的插件需要自行持久化数据，请改用[数据存储](/zh/guide/essentials/data-storage)。
:::

## 注册配置文件

### 自动注册

在模块主类启用 `@UltiToolsModule`，并将带 `@ConfigEntity` 的类放在扫描包中。`config` 默认是 `true`；直接使用 `@EnableAutoRegister` 时也是如此。参阅[自动注册](/zh/guide/advanced/auto-register)。

### 手动注册

关闭自动配置注册后，框架从 `getAllConfigs()` 取实体；配置类仍须有 `@ConfigEntity`。

```java
@Override
public List<AbstractConfigEntity> getAllConfigs() {
    return List.of(new SomeConfig("some/path/to/config"));
}
```

不要把这两种方式混用。自动注册开启时，框架仍会调用 `getAllConfigs()` 来核对覆盖实现，不会再用它注册实体。与扫描结果重复的条目不重复注册；如果覆盖实现要求注册某个扫描未找到的实体，模块会被拒绝加载。

## 配置校验

UltiTools 提供了校验注解来防止无效的配置值。详情请参阅[配置校验](/zh/guide/advanced/config-validation)指南。

<<< @/../examples/src/main/java/com/ultikits/docs/config/MyConfig.java

可用的校验注解：`@Range`、`@NotEmpty`、`@Size`、`@Pattern`（来自 `com.ultikits.ultitools.annotations.config` 包）。

`validateProposedProperties` 或 `updateProperties` 的校验拒绝会给出声明的配置键（例如 `allowed-commands`，而不是 Java 字段 `allowedCommands`），并说明编辑未应用。文件和运行值保持不变；修正提议值后重新编辑即可，无需重启。加载和重载校验仍使用各自的诊断。

## 保存配置文件

### 写入约定

框架绝不覆盖服主写的配置，除非服主要求了这项改动。代码可以写什么，取决于文件归谁所有：

| 文件 | 代码可以写入 |
|---|---|
| 模块自带的配置文件（`config.yml`、`spawn.yml`） | 文件不存在时首次创建；补入文件缺少的声明键和框架自己的注释，只插入；服主通过命令、面板或 GUI 明确要求修改的那一项 |
| 服主自己创建的文件（礼包、菜单） | 服主执行创建操作时创建文件；编辑时只写编辑的部分 |

除此之外一律不写：不在关闭、卸载或替换时保存，不修复无效值，不规整排版，也不清理 6.2 按点号拆开的映射键。

所有写入都经过同一个写入闸门。每次写入声明自己拥有的键；渲染后，这些键之外的每个字节必须与读取时相同，且文件仍须是读取时的内容。否则不写入：一条 WARNING 列出文件、键和原因，不列值，程序继续使用内存中的值。

显式写入被安全检查拒绝时抛出 `ConfigWriteRefusedException`，文件不变。发布文件时的 I/O 故障会抛出 `IOException`。如果原地写入失败，框架会尝试恢复原文件；恢复也失败时会报警、保留备份并禁止后续写入，直到成功重载。见[原子替换](#原子替换)。

::: tip 7.0 的消息语言文件
自 v7.0.0 起，新的 `messages/<语言>.yml` 语言文件中的文本不通过复制文件来定制。服主只把要改的键写进覆盖文件，见[服主覆盖文件](/zh/guide/essentials/messages#operator-overrides)。
:::

### `save()`

`saveConfig(path, type)` 只保存当前模块中按该路径登记的配置实体。自 v7.0.0 起，如果该路径从未登记，即使磁盘上已有同名文件，也会抛出 `IllegalStateException`，异常消息会指出模块和路径。此时不会创建、登记或写入任何文件。如果已登记的实体不是请求类型的实例，则抛出 `ClassCastException`，异常消息会指出模块、路径、请求类型和已登记实体的类型。先登记配置实体再保存；若已持有登记过的实体，也可以直接调用它的 `save()`。如果 6.x 代码曾为处理缺少登记而捕获 `NullPointerException`，请先登记实体，或改为捕获 `IllegalStateException`。

`save()` 只写模块自上次加载或保存以来改过的设置，并且只在文件该处仍是读取时的值时才写。声明为 `Map` 的设置按条目写入；列表，以及 `Location`、`Vector` 这类 Bukkit 值，要么整体写入，要么不写。保存从不补入文件缺少的键，从不改写注释，也从不删除模块没有删除的映射条目。

因此，服主在磁盘上改过的值、删掉的键，以及框架无法使用的值（`interval: 3O0`）都不会被覆盖。模块的改动留在内存中，一条 WARNING 列出该键。比较依据是上次读取的文字：服主不经 `/ul reload` 直接在磁盘上改过某个设置后，即使值不变（例如把 `64` 改成 `64.0`），模块对该设置的下一次改动也不会写入，直到重载重新读取文件。没有内容可写的保存不改动文件字节和修改时间。

### 服主命令

用 `saveOperatorChange` 写入服主要求修改的声明设置，用 `saveOperatorMapEntry` 只改一个映射条目。以下示例假定 `spawn.location` 声明为一个 `Location` 字段，而不是多个子字段：

```java
// /setspawn：把声明的 Location 设置作为一个值写入
config.setSpawn(player.getLocation());
config.saveOperatorChange("spawn.location");

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

映射条目的写入还可以取决于该条目是否已在文件中。把 `EntryPresence` 作为 `saveOperatorMapEntry` 的第一个参数传入：新建条目的命令用 `MUST_BE_ABSENT`，这样不会替换服主在上次重载之后手动添加的同名条目；修改已有条目的命令用 `MUST_BE_PRESENT`，这样不会把服主删掉的条目写回去。模块不必自己读取文件：

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

条件不成立时不写入，并抛出 `com.ultikits.ultitools.config.ConfigEntryPresenceException`。它是 `ConfigWriteRefusedException`：`getRequired()` 给出不成立的条件，`getReason()` 给出条目的键路径。框架对此只记 FINE 级日志，由你的命令告诉服主。条件为 `null` 时抛 `IllegalArgumentException`。不传 `EntryPresence` 时，`saveOperatorMapEntry` 不要求条目必须存在或缺失。

### 被拒绝的写入

文件无法读取或解析、使用了 YAML 锚点、别名或合并键、读取后被改动，或者排版无法被渲染器逐字节写回时，写入会被拒绝。排版引起的拒绝会给出要修改的行号，例如 `the file's layout outside the keys this write owns would change (line 16)`。

YAML 库在应用、渲染或校验一次写入时抛出的运行时异常也按拒绝处理。把映射写入一个值为 `null` 且带行内注释的条目（`foo: ~  # placeholder`）就是这样的排版。原因会给出键、失败的步骤和异常类名，例如 `the file cannot be written at autoreply.rules.foo: rendering the document failed (EmitterException)`。

会使该文件所有写入都被拒绝的排版包括：只含空格的行、值后面的行尾空格、用多个空格对齐的行内注释、冒号后多于一个空格、流式方括号内侧的空格（`[ a ]`）、`---` 或 `...` 标记、缩进比下面的键更深的注释、同一文件中的两种缩进宽度，以及混用的换行符。框架和各模块自带的文件都没有这类排版。服主改掉警告指出的那一行（如果原因是“文件在读取后已被改动”，则先执行 `/ul reload`），再重做一次改动即可。

补缺项时，框架可以保留未修改的块标量（`|`、`>`）原有写法、截断标记、行内注释和尾部空行。无法证明写入能保留原文时，框架拒绝写入；此时请手工添加键。

0 字节文件、只有空行的文件和只含行首注释的文件视为空文件：启动时补入声明的键。只含空格的文件、含缩进注释的纯注释文件和只含 BOM 的文件按排版拒绝。

紧跟在某个“冒号后没有值”的键（如 `c:`）之后的插入同样会在每次启动时被拒绝，原因为 `a key this write owns shares line N with a key it does not own`（[#628](https://github.com/UltiKits/UltiTools-Reborn/issues/628)，未修复）。要把文字设置留空，请写 `key: ''`，这种写法会保留且不会被拒绝。

### 读取器无法读取的排版

文件无法读取、不是有效 UTF-8 或无法解析时，启动会使用通过校验的声明默认值（不覆盖文件），重载会拒绝更新并保留原运行值。启动时的 SEVERE 原文为 `Cannot load <file>: <cause>; file will not be overwritten`。重载失败的原因原文为 `Cannot reload <file>: <cause>; the file and the running values are unchanged`。`<cause>` 是安全的错误信息，例如解析行列或异常类名，不含源配置片段。修复文件并成功重载后才能再次写入。

### 删除的键、被清空的节与留空的设置

删除一个键就是服主重置设置的方法：下次启动时，框架会把文件缺少的声明键连同默认值和注释补回。要让文本设置留空，服主写空字符串（`key: ''`）；对文本设置，空字符串读作“留空”，启动、重载或保存其他设置时都不会改写它。数字、true/false 等非文本设置没有“留空”的值：在那里写 `''` 会以一条 WARNING 报告，内存中使用声明默认值，文件里的 `''` 保持不变。如果你的模块文档说明如何重置或清空某个设置，请照此说明。

所在的节被服主清空的键也会补回（[#620](https://github.com/UltiKits/UltiTools-Reborn/issues/620)）。如果删除的是节里的最后一个键，节的键名会单独留在一行、冒号后什么都没有（`messages:`），读作“没有值”；删光所有子键多半是误删，所以补键会展开这一行，而不是每次启动都被拒绝。这一行是写入在补入的键之外唯一可以改动的行：它按原样保留键、注释文字和换行符，只有空白可能被规整（冒号前的空格、注释前的空格、行尾空格），所以 `messages :   # reset  ` 会变成 `messages: # reset`。节的值变成恰好是补入的那些键。服主在这一行下面注释掉的子键行留在原处、位于补回的键下面，前提是这些注释行紧跟节所在行、连成一段，并位于文件的缩进处；若前面有空行、两段注释被空行隔开，或注释比文件缩进更深，则每次启动都会拒绝补键，文件不变。`saveOperatorChange`、`saveOperatorMapEntry` 和面板编辑同样如此，所以向被清空的 `rules:` 添加第一条规则的命令会被写入，而不是被拒绝。

写成显式空值的节（`messages: {}`、`messages: ~` 或 `messages: null`）是服主自己写的值，绝不会被改动。在它下面插入会被拒绝，原因为 `the section messages (line 3) is written as an explicit empty value, which the framework does not change; to have keys added below it, delete that value so the line ends after the colon, or add the keys by hand`（[#610](https://github.com/UltiKits/UltiTools-Reborn/issues/610)）；`saveOperatorMapEntry` 会以这个原因抛出 `ConfigWriteRefusedException`。

缺少的设置插入到文件已有的那个节下面，绝不写成该节的第二种形式（[#614](https://github.com/UltiKits/UltiTools-Reborn/issues/614)）。文件中 `a.b:` 下有 `c: 3`、模块声明了 `a.b.d` 时，启动会把 `d:` 写在 `a.b:` 下面，而不是另加一份嵌套的 `a:` / `b:`——Bukkit 的 `YamlConfiguration` 会把后者当作替换了扁平的节。如果该节的另一个设置把路径的剩余部分写成一个带点键（`a:` / `  b.c: 3`），缺少的设置会以同样的形式写在它旁边（`  b.d: 2`）；兄弟设置拆分方式不同时无法决定，拒绝插入。如果文件把这个节写了几种形式，设置会插入到其中唯一一个还持有该节其他声明设置的形式下；没有或不止一个形式持有时拒绝插入，写明文件和设置，内存中使用声明默认值。

### 模块代管的服主文件

`com.ultikits.ultitools.config.OperatorFiles` 用于在服主明确编辑时，写入模块代服主管理的 YAML 文件，例如礼包文件。它只写指定的键，经过同一个写入闸门，并且只在文件仍是读取时的字节时写入：

```java
OperatorFiles.Snapshot snapshot = OperatorFiles.read(kitFile);
Map<List<String>, Object> edit = new LinkedHashMap<>();
edit.put(Arrays.asList(kitName, "items"), serializedItems); // 只能是普通数据
OperatorFiles.WriteResult result = OperatorFiles.write(snapshot, edit);
```

结果为 `WRITTEN`、`UNCHANGED`、`FILE_CHANGED`（`read` 之后文件被改动）或 `REFUSED`（排版或锚点问题，闸门会记一条 WARNING）。列表中的每一项是一个完整的键，名字里含 `.` 也仍是一个键。`OperatorFiles` 从不创建、删除或重命名文件，也不用于 `@ConfigEntity` 文件。

### 选择性启用的崩溃安全 YAML 写入

`com.ultikits.ultitools.config.CrashSafeYamlFiles` 为模块在服主明确创建或编辑文件时提供严格的单文件发布。模块必须主动采用它：现有模块、`OperatorFiles.write`、`@ConfigEntity` 保存和面板写入不会自动切换。它不用于自动保存、凭据、框架状态、任意字节、文件修复、删除或改名，也不是多文件事务。

| 方法 | 用途与结果 |
|---|---|
| `write(OperatorFiles.Snapshot, Map<List<String>, Object>)` | 只编辑指定的完整键路径，返回 `WRITTEN`、`UNCHANGED`、`FILE_CHANGED` 或 `REFUSED`。目标缺失时返回 `FILE_CHANGED`，不会重新创建。 |
| `create(File, Map<String, Object>)` | 仅在没有任何已有目录项时发布完整的普通数据根映射，返回 `WRITTEN`、`FILE_CHANGED` 或 `REFUSED`，从不返回 `UNCHANGED`。已有文件、目录或悬空符号链接均为 `FILE_CHANGED`，即使内容相同。父目录必须已存在。 |

两个方法都声明 `throws IOException`，在 I/O 前复制并校验参数。参数或键为 null、写入路径无效、值不是普通数据时抛 `IllegalArgumentException`，Bukkit 对象应先序列化。含点的键完整保留，允许 null 值，创建时允许空根映射。两个方法都不修改模块的运行对象。

```java
OperatorFiles.Snapshot snapshot = OperatorFiles.read(kitFile);
OperatorFiles.WriteResult edited = CrashSafeYamlFiles.write(snapshot,
        Collections.singletonMap(Arrays.asList(kitName, "items"), serializedItems));
OperatorFiles.WriteResult created = CrashSafeYamlFiles.create(newKitFile,
        Collections.singletonMap("items", serializedItems));
```

仅在 `WRITTEN` 后更新运行状态，编辑时 `UNCHANGED` 也可以。`FILE_CHANGED` 表示快照已不再允许该编辑，或创建目标已存在；`REFUSED` 表示闸门无法安全执行操作。编辑复用普通数据、指纹以及解析、渲染、重新解析检查，未拥有的每个字节（包括注释、未知键、BOM、行尾）必须保持相同。无法解析、使用锚点或无法保留排版的 YAML 会被拒绝，不会被修复。空编辑和语义无变化的编辑返回 `UNCHANGED`，不暂存、不改变元数据。

#### 文件系统与元数据要求

`File` 和快照入口使用 JVM 默认文件系统。实际发布要求本地默认 POSIX 文件系统上的普通文件，具备原生原子 rename/link 语义和可用的 POSIX 属性。普通 Windows 文件系统不受支持。已有的末级符号链接或非普通编辑目标会被拒绝，不会被跟随；先解析真实父目录，再接上末级文件名。请传入可信的模块路径，该 API 不提供路径沙箱。

已有文件保留九位 POSIX 权限、所有者和组，在提交前应用到暂存 inode 并校验，失败则中止发布。目标没有写权限位或进程不可写时拒绝。暂存文件在写入内容前以 `0600` 排他创建，需要改变所有者或组时先收紧为 `0000`，之后设置并校验最终权限。新文件保留进程创建的所有者和组，权限为 `0600`。非 POSIX 文件系统，或父目录、目标、暂存文件暴露 Java ACL view 时，会被拒绝。

该入口不复制 ACL。没有 Java ACL view 不证明不存在 Linux ACL、默认 ACL、安全标签或 xattr。需要保留这些属性、特殊权限位、备用数据流、inode 身份、硬链接关系、创建时间或任意标记的文件，不应采用它。替换会创建新的 inode，已有硬链接别名仍保留旧内容；并非每种不兼容元数据布局都能被检测。

#### 发布与中断

同目录的 `<文件名>.ultitools-stage-<32 位小写十六进制>.tmp` 在发布前接收完整 UTF-8 内容和承诺的元数据，执行 `FileChannel.force(true)` 并成功关闭。已有文件编辑通过 `ATOMIC_MOVE` 提交；创建则以原生 POSIX 硬链接排他发布完整暂存文件，不把原子移动当作“仅在不存在时创建”。不支持原子替换或硬链接发布时抛 `IOException`，不退回复制、普通移动、原地截断或日志方案。

操作系统和文件系统正常工作时，进程崩溃会留下旧内容、原本不存在的目标，或完整新内容。发布后的目录同步尽力执行，失败会警告；`WRITTEN` 表示完整发布，不表示普遍的断电持久性。操作系统崩溃、突然断电、远程存储、设备或控制器故障及文件系统恢复不在保证内。同一 JVM 的闸门写入串行执行，提交前重新检查字节、类型和承诺的元数据，但没有跨进程锁；外部编辑、改名或 chmod 仍可能发生在最后检查之后。不要让不协调的写入方共用这些文件。

#### 遗留临时文件

没有启动扫描、日志、重放、自动提升或回滚。清理只删除本次调用创建的那个普通临时文件，并且必须由非 null 文件键继续证明身份。清理失败或身份不确定时，警告会给出临时文件名；后续调用不复用或删除它。提交前的清理失败不掩盖原始错误，提交后的清理失败仍返回 `WRITTEN`；创建可能留下指向完整新内容的第二个硬链接。严格读取不运行旧的临时文件或备份维护逻辑。

中断后，先停止服务器和其他写入方，再检查目标及指明的遗留文件。不要假定临时文件更新或更权威，也不要自动将它变为正式文件。只删除已确认不再需要的临时文件；无法确认时保留它，使用独立可信的备份或模块明确的重新创建操作。遗留文件可能按最终 POSIX 权限保存新数据，请像保护 YAML 文件本身一样保护它。

### 原子替换

普通配置写入和 `OperatorFiles.write` 可以回退到备份后原地写入；上文的选择性入口不使用这种回退。

单个列表项的注释仅在列表长度不变时保留；Bukkit 则完全不保留列表项注释。

先强制同步同目录临时文件，再原子替换。仅不支持原子移动、EBUSY/跨设备或允许的临时创建拒绝走备份后原地写。备份文件名为 `<file>.ultitools-backup-<16 位十六进制>`，在打开目标前同步；本次运行已为同一文件写过、且内容未变的备份，先从当前目标通过同步临时文件和原子替换刷新。服主自己的 `<file>.bak` 不会被读取、写入或删除。备份失败保持目标和旧备份。如果之后的原地写在打开目标后失败（写到一半中断，或 force 失败），框架先从备份写回目标原来的字节并删除备份，然后才把 `IOException` 交给调用方，因此文件保持写入前的内容。面板批次以同样方式放回它打开过的每个文件，并报告失败。

如果放回本身也失败，一条 SEVERE 列出文件和备份（从不含内容），备份保留。此后在重载之前，该配置把文件视为读取后已被改动：服主操作写入和面板编辑会以 “the file changed since it was read” 被拒绝，`save()` 不写入。服主对比文件与备份，必要时用备份覆盖文件，然后重载。成功的原地写入所用的备份，在下一次成功严格加载该文件、且备份内容仍与写入时一致时删除。

文件无法读取、无法解析或不是有效 UTF-8 时，所有实体写入路径都受保护。成功加载后才解除保护。

注册批次等所有选定实体绑定验证完成才写入；拒绝批次不改文件。接受后各文件独立保存，经过写入闸门，并且只在文件仍是注册时读取的字节时写入。多文件面板先验证并暂存全部文件，然后提交且共同确认，普通进程内拒绝回滚；持久存储故障可能阻止恢复，移动中间崩溃不是安全多文件事务。

面板先校验并暂存触及的文件，再一起提交；普通拒绝会还原已写的文件，不提交运行值，并返回失败。存储故障也可能阻止恢复；这不是跨文件的崩溃安全事务。

面板映射叶项按真实完整文件键和整个字段声明转换器处理。唯一变更保存，歧义或不存在变更拒绝整个请求并定位路径；未变显示项不算编辑。无关待保存内存和独立磁盘兄弟项保持。

面板编辑经写入闸门只写它指定的键：在这些键处替换服主改过的值（即服主的同意），文件的其余每个字节保持不变。闸门拒绝的文件会收到注明原因的错误回复。编辑 `Location` 这类 Bukkit 值中的一个字段时，写入的是文件中原样的整个值、只改该字段，其余字段保持服主写的文字（`y: 64` 不变），并且只在文件仍是读取时的值时写入；否则回复要求先重载。

## 重载配置文件

```java
UltiToolsPlugin.getConfigManager().reloadConfigs(module);
```

这个调用只重载文件。配置绑定、模块消息覆盖、注释刷新和 `onReload()` 只在 `/ul reload` 时执行。

重载比较上次有效基线、运行字段、传入文件。内存独有修改保持且脏，磁盘独有采用，冲突磁盘胜并安全定位警告。映射按完整键递归，列表和标量原子处理。服主从文件中删掉的整个字段使用声明默认值，并警告一次列出该键；但模块自上次加载或保存后改过该字段时保留模块的值。两种情况都不写文件。单个配置实体的失败重载是全有或全无的：重载失败时（例如校验拒绝某个值），内存与调用前完全一致并重新抛出异常。被拒绝的值因此不会留在字段里，被下一次重载当作覆盖在已修正文件之上的未保存修改保留下来；修正文件后再次重载即可。文件无法读取或解析时同样如此：重载抛出列出该文件的 `ConfigurationException`。模块自己调用 `reload()` 且只捕获 `IOException` 的，应同时捕获 `ConfigurationException` 并在自己的回复里报告。磁盘该映射未变时保留内存独有顺序，重载不写入它；这不是并发映射插入顺序策略。

模块重载不是跨文件事务。首个失败文件会停止该模块剩余的重载步骤：此前成功的文件保留新值，失败的文件保留旧运行值。此时不会重读模块消息覆盖、执行最后的令牌注释刷新或调用 `onReload()`。完整重载仍会处理其他模块。

自 v7.0.0 起，完整 `/ul reload` 先重读框架配置、后备语言和框架消息覆盖，再重载各模块。`/ul reload <模块名>` 不重读这些全局设置。成功重载模块配置后，框架应用配置绑定，重读该模块消息覆盖，按当前后备语言刷新框架拥有的令牌注释，再调用 `onReload()`。改 JAR 仍须重启；重载不重新注册命令。参阅[消息重载](/zh/guide/essentials/messages#reloading)。

新版本副本替换旧副本时不保存旧副本的任何配置。新副本按文件现状读取；激活后警告一次，列出旧副本被丢弃的文件和键。卸载释放注册表所有者，不写入任何内容。

模块重载失败时，默认目录的控制台消息分别是 `Module '<module>' failed to reload: <error>` 和 `模块 '<module>' 重载失败：<error>`；具体原因可能仍是英文。

## 已知限制

普通写入和选择性启用的崩溃安全写入都不承诺跨文件的崩溃安全事务。请勿让外部进程与服务器同时写同一文件。需要留在 6.x 的模块，可在页首链接的归档指南查阅旧版 YAML 解析限制。
