# 配置校验

::: info 自 v6.2.0 起
配置校验注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 为配置字段提供了声明式的校验注解。

::: info 拒绝语义（v6.3.0 起）
校验失败的配置值会在加载时拒绝所属模块，不再重置。唯一的例外是 `@NotEmpty` 下为空的列表、集合或映射，它会改用声明的默认值。见下方[行为说明](#行为说明)。
:::

## 可用注解

### @Range

校验数值是否在指定范围内（包含边界）。

<<< @/../examples/src/main/java/com/ultikits/docs/validation/MyConfig.java

如果服主设置了 `maxHomes: 999`，该模块会在加载时被拒绝。控制台错误会指出模块、配置文件、字段 `maxHomes`、实际值 `999`，以及被违反的约束（`@Range(min = 1, max = 10)`）；文件本身不会被改动。

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `min` | `double` | `-Double.MAX_VALUE` | 允许的最小值（包含） |
| `max` | `double` | `Double.MAX_VALUE` | 允许的最大值（包含） |

自 v6.3.0 起，值必须满足 `min <= 值 <= max`。NaN（YAML 中的 `.nan`）超出任何范围；无穷大（`.inf`、`-.inf`）也超出范围，除非对应的边界本身就是无穷大，例如 `max = Double.POSITIVE_INFINITY`。`@Range` 只检查数字。

### @NotEmpty

校验值不为空。用在文本（`String` 或 `char`）上时，值为 null 或去除首尾空格后为空，所属模块会在加载时被拒绝。

```java
import com.ultikits.ultitools.annotations.config.NotEmpty;

@NotEmpty
@ConfigEntry(path = "serverName", comment = "服务器显示名称")
private String serverName = "My Server";
```

值为空白或缺失时，所属模块会在加载时被拒绝，见下方[行为说明](#行为说明)。

自 v6.3.0 起，`@NotEmpty` 也适用于列表、集合、映射和数组，但结果不同。加载或重载时如果值为空（文件中为空或为 `null`，或列表中每一项都无法绑定），模块会在内存中改用字段声明的默认值，并输出一条警告，写明文件、键、值的种类、文件中写的值和默认值。字段名、某一级键名，或值与默认值中的映射键看起来像机密时，两个值都会隐去。模块照常加载，文件不会被写入。

```java
@NotEmpty
@Size(min = 1, max = 15)
@ConfigEntry(path = "lines", comment = "侧边栏行（1-15 行）")
private List<String> lines = new ArrayList<>(Arrays.asList("Welcome", "Online: %online%"));
```

文件中写的是 `lines: []` 时，控制台显示：

```
File config/sidebar.yml, key 'lines': the list is empty (found []) but the setting is declared @NotEmpty; using the declared default [Welcome, Online: %online%] in memory (the file is not changed)
```

声明的默认值本身必须满足该字段的约束：不能为空，并且若字段带 `@Size` 则必须在其范围内。不满足的类无论文件中写的是什么，都会在加载时被拒绝。面板编辑如果会让该值变空，会和其他违规一样被拒绝。

默认值生效期间，面板仍显示文件中的值（`[]`）。服主命令通过 `saveOperatorChange` 写这个设置时，写入的是运行中的值，即默认值加上服主的改动，替换掉 `[]`，因为服主明确要求修改这个键。

### @Size

校验文本、集合、映射或数组的大小在指定范围内。大小指文本的长度、列表或集合的元素个数、映射的条目数和数组的长度（映射与数组自 v6.3.0 起）。

```java
import com.ultikits.ultitools.annotations.config.Size;

@Size(min = 1, max = 50)
@ConfigEntry(path = "motd", comment = "每日消息 (1-50 字符)")
private String motd = "Welcome!";

@Size(min = 1, max = 10)
@ConfigEntry(path = "allowedWorlds", comment = "允许的世界列表 (1-10 个)")
private List<String> allowedWorlds = Arrays.asList("world", "world_nether");
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `min` | `int` | `0` | 最小大小（包含） |
| `max` | `int` | `Integer.MAX_VALUE` | 最大大小（包含） |

### @Pattern

校验文本值是否匹配指定的正则表达式。文本指 `String`，或按单字符字符串匹配的 `char`（自 v6.3.0 起）。

```java
import com.ultikits.ultitools.annotations.config.Pattern;

@Pattern(regex = "^#[0-9A-Fa-f]{6}$")
@ConfigEntry(path = "chatColor", comment = "聊天颜色，十六进制格式 (#RRGGBB)")
private String chatColor = "#FFFFFF";

@Pattern(regex = "^[a-zA-Z0-9_]{3,16}$")
@ConfigEntry(path = "prefix", comment = "前缀（字母数字，3-16 字符）")
private String prefix = "Server";
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `regex` | `String` | （必填） | 要匹配的正则表达式 |

## 支持的值类型

每个注解只检查它能度量的值类型。自 v6.3.0 起，各类型的结果如下：

| 注解 | 文本（`String`、`char`） | 数字 | 列表、集合、数组 | 映射 | 其他类型 |
|---|---|---|---|---|---|
| `@Range` | 声明错误 | 违规时拒绝 | 声明错误 | 声明错误 | 声明错误 |
| `@Pattern` | 违规时拒绝 | 声明错误 | 声明错误 | 声明错误 | 声明错误 |
| `@Size` | 违规时拒绝 | 声明错误 | 违规时拒绝 | 违规时拒绝（按条目数） | 声明错误 |
| `@NotEmpty` | 违规时拒绝 | 声明错误 | 改用声明默认值并警告 | 改用声明默认值并警告 | 声明错误 |

「其他类型」包括布尔值、枚举、UUID、`Location` 等 Bukkit 值，以及你自己的值类型。数字指基本数值类型，或 `Integer`、`BigDecimal` 等 `Number`。

### 无法检查的声明

声明错误会在加载时、读取或创建配置文件之前拒绝模块，控制台用一条消息写明每个这样的字段、注解和原因。配置类中不是 `@ConfigEntry` 的字段上的约束同样如此。每个字段都按它自己的声明类型判断：`List<Integer>` 上的 `@Range` 属于错误，因为它不适用于列表本身。声明类型若能容纳注解可检查的值，例如 `Object`、`Serializable`、`Comparable`、`CharSequence` 或 `Number`，则不算错误：加载时绑定的值照常检查。绑定的值若是注解无法读取的种类，例如 `@Range` 下 `Object` 设置里的文本，则与其他违规一样处理：加载时拒绝模块，重载时拒绝重载并保留运行中的值。只有永远不可能容纳可检查值的类型才会作为声明错误被拒绝。

约束注解只对本身就是配置类 `@ConfigEntry` 设置的字段生效。值类型的字段、嵌套类的字段，以及转换器产生的任何对象上的注解，既不检查也不报告：

```java
public static class OutputItem {
    @NotEmpty                    // 不检查，也不报告
    private String material;
}

@ConfigEntry(path = "recipes")
private Map<String, OutputItem> recipes = new HashMap<>();
```

`OutputItem` 由转换器从文件构造，框架只校验设置 `recipes` 本身，从不校验其中各个值的字段。请在模块的转换器中校验这些字段，在那里可以跳过或拒绝单个条目。UltiRecipe 的 `RecipeConfig.OutputItem` 就是这种形态：模块自行检查这些字段，它面向 6.3.0 的构建删除了这两个从未生效的注解。

## 组合使用

可以在同一字段上使用多个校验注解：

```java
@NotEmpty
@Size(min = 3, max = 32)
@Pattern(regex = "^[a-zA-Z0-9_ ]+$")
@ConfigEntry(path = "displayName", comment = "显示名称（3-32 个字母数字字符）")
private String displayName = "Default Name";
```

## 完整示例

<<< @/../examples/src/main/java/com/ultikits/docs/validation/PluginConfig.java

## 行为说明

::: info 构造器解析（v6.3.0 起）
`validateFields()` 通过与 `ConfigManager` 其它位置一致的两步回退取得默认实例：先尝试 `(String)` 构造器，再尝试调用 `super("config/path.yml")` 的无参构造器。两种写法校验都会生效，只有两种构造器都不存在的类才会注册失败（见 [#314](https://github.com/UltiKits/UltiTools-Reborn/issues/314)）。
:::

只要具备两种构造器中的任意一种，配置类就能正常注册：`public MyConfig(String configFilePath)` 内部调用 `super(configFilePath)`，或是无参构造器直接调用 `super("config/path.yml")`。两种写法都受支持，声明其中一种即可。

当某个字段的实际值违反约束时：

1. 模块会在加载时被拒绝，值不会被重置，文件也不会被改写。其余模块照常加载。`@NotEmpty` 下为空的列表、集合或映射是例外：它会改用声明的默认值，见 [@NotEmpty](#notempty)。
2. 控制台错误会指出模块、配置文件、字段、实际值，以及被违反的约束，服主据此即可修复，无需猜测。
3. 文件本身不会有任何变化，服主写下的值会原样保留，直到他们自己编辑它为止。

这与「输错了自动帮你改对」不同：配置文件归服主所有，只有服主自己的修改才会改变它。修正数值后，重启服务器或重载该模块即可。
