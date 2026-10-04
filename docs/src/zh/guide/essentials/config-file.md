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

字面 `comment` 在键首次加入时写入。恰好是一个去除首尾空白后的语言 token（例如 `comment = "{config.limit}"`）时，每次加载和写入按框架当前 `language` 从模块语言目录解析。自 v6.3.0 起，`/ul reload` 重建模块语言之后还会再解析一次，因此切换 `language` 后执行 `/ul reload` 即可改写这些注释，无需重启。这次刷新只改注释行：值、服主写入的无效值以及为恢复默认而删除的键都保持原样，无法读取或解析的文件不会被改动（[#594](https://github.com/UltiKits/UltiTools-Reborn/issues/594)）。该项块注释归框架所有，服主在这里的文字会被替换；字面项已有的服主注释保持。目录缺键时保留 token 并警告一次，写 YAML 注释前清理换行和控制字符。

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

在设置完配置对象内容后，你可以不用保存它，UltiTools会在插件关闭时自动为你保存。
当然你也可以手动调用 `save` 方法来立即保存。

:::

自 v6.3.0 起，关闭先在卸载任何模块前保存已登记的脏配置。每个模块的卸载钩子和容器 `@PreDestroy` 回调运行后，在释放该所有者前再次保存它的脏配置；清理抛错时也执行。文件保护和逐实体保存错误隔离不变，运行时卸载、注册失败和旧副本替换清理不增加保存。服主只改磁盘文件不会使干净运行实体变脏。待保存代码修改可能覆盖服主值，成功覆盖后警告一次，只列文件和真正覆盖的键，不列值。面板只确认触及字段，无关待保存字段仍脏。

服务器运行时，初始化、重载和 ConfigManager 注册表操作限主线程。异步 void 操作警告且不执行；注册表 getter、JSON 读写警告并抛 `IllegalStateException`。面板更新、上传、重连回调整体排到主线程，执行后回复。实体监视器串行化持久化，但不保护模块自己异步修改字段；请安排在主线程修改和重载。

模块 `getConfig(Class)` 仍返回实体。实体旧的可变 Bukkit `getConfig()` 在 v6.3.0 通过维护者一次性兼容 carve-out 删除；它在 6.2.5 确实可用，第三方用量未知。用 `isPresentInFile("entry.path")` 查上次成功加载的存在性（null 和未声明键也算），它拆分点号，不能定位映射完整点号键。修改声明字段后调用 `save()`。

::: tip
尽管 UltiTools 允许你从代码里更改并保存配置文件，但这并不是推荐的做法：它会给用户带来意料之外的改动，并且在你的代码改动过某项配置后，还可能覆盖用户在服务器运行期间对该文件所做的修改。
配置是给用户读取和编辑的，是否应用某项改动应该由用户自己决定，程序只应响应用户的显式操作去改。
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

自 v6.3.0 起，修改保存将整份文档交给 SnakeYAML 输出，保持内容、注释文字、键顺序及支持的引号、列表、行尾、BOM、末尾换行风格，服主排版可以规整。对齐注释空格、行内空格、混合缩进、文档标记、行尾空格不保证字节不变。语义无变化不写文件，字节和修改时间不变。显式保存与当前磁盘比较，即使实体原本干净也可能覆盖服主修改。

单个列表项的注释仅在列表长度不变时保留；Bukkit 则完全不保留列表项注释。

先强制同步同目录临时文件，再原子替换。仅不支持原子移动、EBUSY/跨设备或允许的临时创建拒绝走备份后原地写。打开目标前同步 `<file>.bak`；已有备份先从当前目标原始字节通过同步临时文件和原子替换刷新。备份失败保持目标和旧备份；之后原地写失败可能留下部分目标，但完整备份保留。只有成功严格加载当前文件才删除备份，不自动还原。

不能读取、不能解析或非 UTF-8 文件在所有实体写入路径受保护。初次失败用默认值，重载失败保留运行字段；一条 SEVERE 列文件和安全原因，不泄漏源码片段。成功加载才解除保护。验证在默认值、注释和面板持久化前执行。

注册批次等所有选定实体绑定验证完成才写入；拒绝批次不改文件。接受后各文件独立保存。多文件面板先验证并暂存全部文件，然后提交且共同确认，普通进程内拒绝回滚；持久存储故障可能阻止恢复，移动中间崩溃不是安全多文件事务。

面板编辑同样是全有或全无：校验拒绝某个值，或文件写入失败时，被触及的字段恢复为原值，文件字节不变，面板收到失败结果，重试即可保存该编辑。

面板映射叶项按真实完整文件键和整个字段声明转换器处理。唯一变更保存，歧义或不存在变更拒绝整个请求并定位路径；未变显示项不算编辑。无关待保存内存和独立磁盘兄弟项保持，回复格式不变。

## 重载配置文件

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```

自 v6.3.0 起，重载比较上次有效基线、运行字段、传入文件。内存独有修改保持且脏，磁盘独有采用，冲突磁盘胜并安全定位警告。映射按完整键递归，列表和标量原子处理，整个字段缺失保留运行值。失败的重载是全有或全无的：重载失败时（例如校验拒绝某个值），内存与调用前完全一致并重新抛出异常。被拒绝的值因此不会留在字段里，被下一次重载当作覆盖在已修正文件之上的未保存修改保留下来；修正文件后再次重载即可。磁盘该映射未变时保留内存独有顺序，重载不写入它；这不是并发映射插入顺序策略。

框架构造可提前识别的新模块副本前，按文件路径排序保存旧副本脏配置。失败拒绝构造并保留旧副本；提前无法识别时，成功替换后警告丢弃文件和键，不事后保存旧副本。卸载释放注册表所有者，关闭先保存后释放。

## 已知限制

自 v6.3.0 起，[#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578) 记录特殊锚定容器、复杂符号链接路径、Unicode 风格定位成本和直接别名 token 注释所有权。别名注释可能影响源锚并重复写入。[#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580) 记录首子键前有注释的有效块锚被拒绝；保护保留字节，不表示值可以读取。[#545](https://github.com/UltiKits/UltiTools-Reborn/issues/545) 仍是多文件崩溃持久化限制。
