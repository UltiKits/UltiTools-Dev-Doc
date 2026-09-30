# 配置文件

UltiTools提供了优雅的单例模式的封装API，让你可以像操作对象一样操作配置文件。

## 创建 YAML 配置文件

首先，你需要在 `resources` 文件夹中创建一个 `config` 文件夹。按照你的需求放入你的插件配置文件。这些配置文件会被原封不动的放入UltiTools插件的集体配置文件夹中展示给用户。

## 操作配置文件

### 创建配置文件对象

根据你的配置文件的键值对结构，创建一个类，继承 `AbstractConfigEntity` 类。

<<< @/../examples/src/main/java/com/ultikits/docs/config/SomeConfig.java

::: warning 构造函数必须廉价且无副作用（自 v6.3.0 起）

框架会构造并丢弃该类的临时实例：每次加载、重载、面板写入尝试各两个，每次 `save()` 一个，服务器停止时每个配置一个。
请让构造函数保持上面示例中 `super(configFilePath)` 这种单行写法。

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

`path` 属性用于指定该配置项在配置文件中键的路径；

`comment` 属性用于指定该配置项的注释；

自 v6.3.0 起，如果 `comment` 恰好是一个语言键，例如 `comment = "{config.limit}"`，框架会按服务器当前的 `language` 从模块的语言文件（`lang/en.json`、`lang/zh.json` 或对应的 `.yml`）中取出文字作为注释，这样同一个配置项就能以模块支持的每种语言提供注释。框架每次写这个配置文件时都会写入这段文字，包括服主文件里已有的键：首次启动写入默认值、保存、关服保存、面板写入，以及升级后或切换 `language` 后的第一次启动。服主在这类配置项上手写的注释会被替换，设置值的含义不变，注释已经一致时启动不会写文件。重写改动的不只是注释行：与框架的每一次写文件一样，整个文件会重新输出，服主加的引号会被去掉，行内列表 `[a, b]` 变成多行，`yes` 变成 `true`，`1.50` 变成 `1.5`，写在列表项旁边的注释会丢失；值的含义不变。升级后第一次启动和切换 `language` 后各发生一次。语言文件里带换行的文字会写成多行注释。语言文件里没有这个键时，写入的就是这个键本身，并记一条警告，写明模块、文件、配置项和键名。其他注释（包括只是在文字中含有 `{player}` 这类占位符的注释）按原样写入，并且只在该键首次加入文件时写入。

`parser` 属性用于指定该配置项的解析器。解析器用于将配置文件中的对象转换为配置项的类型。默认的解析器是 `DefaultConfigParser` ，
它可以处理大多数情况，但并不是所有情况。如果你需要解析一个更复杂的对象，你可以创建一个继承 `ConfigParser` 类的类，并在 `parser` 属性中指定它。

::: tip 内置解析器示例
`StringHashMapParser` 是框架内置、可直接复用的实现，完整类名为 `com.ultikits.ultitools.interfaces.impl.pasers.StringHashMapParser`，通过 `@ConfigEntry(parser = StringHashMapParser.class)` 直接引用即可，不需要另外自己实现一个解析器。下方代码仅用于展示其实现逻辑，请导入上面给出的框架类，不要导入这个示例文件。
<<< @/../examples/src/main/java/com/ultikits/docs/config/StringHashMapParser.java
:::

#### 数值字段

YAML 会把 `1800` 这样的整数读成整数类型。自 v6.3.0 起，包装类型 `Long`、`Float`、`Double` 的字段也能载入这样的值，与基本类型 `long`、`float`、`double` 的字段一致。在此之前，整数无法直接写入其他数值类型的包装类字段，因此这类字段只在首次启动（写入默认值时）能正常载入，之后每次启动和重载都会失败。框架只做拓宽转换，所以包装类型字段能接受的值与其对应的基本类型完全相同。

`0.5` 这样的小数会被读成 `Double`。自 v6.3.0 起，`float` 或 `Float` 字段（以及 `Float` 列表元素）在小数按 float 读回来一样时接受它，所以 `0.1`、`0.3`、`1.5` 都能载入，框架自己写出的 float 也总能读回（[#534](https://github.com/UltiKits/UltiTools-Reborn/issues/534)）。位数超过 float 能保存的值（例如 `0.123456789`）保留默认值并记一条警告；需要这种精度时请使用 `double` 或 `Double`。

#### 集合、映射与形状不对的值

自 v6.3.0 起，配置值按字段声明的类型绑定。`List<Integer>` 拿到的是 `Integer`，元素类型为 `Set`、`Long`、`Double`、`Boolean` 或枚举时同样会转换；映射的键和值会转换成映射声明的类型，值类型是你自己的类时仍然拿到原始的映射，与以前一致。旧版本写进文件的带引号数字（例如 `'30'`）会作为数字载入。无法转换的元素（例如 `List<Integer>` 里的 `abc`）会被跳过，并记一条警告，写明文件、带元素位置的键、原值和声明类型，其余配置照常加载；空的列表项也同样跳过。`List`、`Set`、`SortedSet`、`Queue`、`EnumSet`、`Map`、`SortedMap`、`ConcurrentMap` 和 `EnumMap` 字段都支持，自定义 `parser` 的读写与以前完全一致。在此之前，列表的每个元素都按文字绑定，因此 `contains(30)` 这类按类型查找永远匹配不上。

值的形状与字段不符时（例如声明为 `Map` 的地方写成了列表或单个值，数字字段里写了文字，或文字字段里写了 `2024-01-01` 这样的日期），字段保持声明的默认值，并记一条警告，写明文件、键、声明类型和文件里实际的内容。模块照常加载，服主的文件也不会被改写。在此之前，配置加载会抛出异常，模块无法启动。值本身的键名或其中任何一个键名像密钥时（例如 `password`、`token`），警告不会打印原值。

映射的键不能含点。配置文件用 `.` 作路径分隔符，`my.rule` 这样的键读回时会变成 `my` → `rule`，加引号也没用。自 v6.3.0 起，框架不再悄悄改名，而是明确告知：写映射时（保存、首次启动写入默认值、面板写入）会跳过这样的键，并记一条警告写明文件、配置项和键名；启动或重载时在文件里发现这样的键，也会警告服主改名。映射键请改用 `-` 或 `_`。配置的其他行为（包括通过 `getConfig()` 读取的路径）与以前一致。

自 v6.3.0 起，`int`、`long`、`Integer` 或 `Long` 类型的字段还可以用来控制任务间隔或命令冷却：`@Scheduled` 见[绑定到配置项的时间](/zh/guide/advanced/scheduled-tasks#绑定到配置项的时间)，`@CmdCD` 见[配置项绑定的冷却时间](/zh/guide/essentials/cmd-executor#配置项绑定的冷却时间)。该配置类必须为模块恰好注册一次，因此指向目录的 `@ConfigEntity` 不能用于绑定。被绑定的字段不要再加 [`@Range`](/zh/guide/advanced/config-validation)：绑定自带范围检查，而 `/ul reload` 期间违反 `@Range` 会中止该模块其余的重载步骤（[#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509)）。

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

::: info 关闭时保存（v6.3.0 起）
自 v6.3.0 起，插件关闭时 UltiTools 只保存自上次加载或保存以来被你的代码改动过的配置。
模块没有改动的配置不会被重写，服主在服务器运行期间对该文件所做的修改在重启后依然保留。
如果模块改动过该配置，文件仍会被重写；若这次写入覆盖了服主在磁盘上所做的修改，控制台会输出一条 WARNING；若框架上次读取该文件时无法解析其 YAML，则该文件完全不会被重写，并有另一条 WARNING 说明。
:::

::: warning 配置写入持有锁（v6.3.0 起）
同一个配置的加载、保存、面板写入与关服保存依次执行，因此 WebSocket 线程上的面板写入与关服保存不会交错。
你自己调用的 `save()` 会等待其中正在进行的那一个，上面提到的临时实例构造也在持锁期间发生，这是构造函数必须廉价的另一个原因。
模块自身在任何线程上对字段所做的修改不在此锁的覆盖范围内。
:::

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

你无需担心配置文件的加载与保存等问题，UltiTools会自动为你做好一切。

::: info 注释（v6.3.0 起）
Bukkit 在保存时会保留已有注释，UltiTools 显式设置了 `options().parseComments(true)`，不依赖默认值。首次新增的键也会连同其 `@ConfigEntry(comment)` 一并写入；服主已有的键保留自己的注释，除非该注释是一个语言键（见上文 `@ConfigEntry`）。
:::

一个纯粹外观上的副作用：SnakeYAML 保存时会把双引号字符串值重新写成单引号，值本身不变，只是引号风格变化。自 v6.3.0 起，这只在文件确实被保存时发生：没有任何改动的配置在插件关闭时不会被重写。

## 重载配置文件

`UltiToolsPlugin` 提供了 `getConfigManager#reloadConfigs` 方法，你可以在需要的时候调用它来重新加载配置文件。

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```
