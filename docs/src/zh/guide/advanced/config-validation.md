# 配置校验

本页以 UltiTools-API 7.0 为准；使用 6.x 时，请参阅[归档的 v6.5.0 指南](/zh/v6.5.0/guide/advanced/config-validation.html)。

UltiTools 为配置字段提供了声明式的校验注解。

## 可用注解

### @Range

校验数值是否在指定范围内（包含边界）。

<<< @/../examples/src/main/java/com/ultikits/docs/validation/MyConfig.java

如果模块名是 `MyModule`，而服主设置 `maxHomes: 999`，框架会拒绝加载模块并保留文件。以下是错误中的配置校验原文；它不随语言设置翻译：

```text
Module 'MyModule' refused to load: configuration file 'config/config.yml' violates its validation constraints (1): field 'maxHomes' value 999 is out of range [1.0, 10.0]. The file was not modified - fix the value(s) and restart.
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `min` | `double` | `-Double.MAX_VALUE` | 允许的最小值（包含） |
| `max` | `double` | `Double.MAX_VALUE` | 允许的最大值（包含） |

值必须满足 `min <= 值 <= max`。NaN（YAML 中的 `.nan`）超出任何范围；无穷大（`.inf`、`-.inf`）也超出范围，除非对应的边界本身就是无穷大，例如 `max = Double.POSITIVE_INFINITY`。`@Range` 只检查数字。

### @NotEmpty

校验值不为空。用在文本（`String` 或 `char`）上时，值为 null 或去除首尾空格后为空，所属模块会在加载时被拒绝。

```java
import com.ultikits.ultitools.annotations.config.NotEmpty;

@NotEmpty
@ConfigEntry(path = "serverName", comment = "服务器显示名称")
private String serverName = "My Server";
```

缺少键与写入空值不同：缺少键时使用声明默认值（重载还会比较内存修改）；空白字符串或显式 `null` 的 `String` 值通不过 `@NotEmpty`。

`@NotEmpty` 也适用于集合、映射和数组，但结果不同。加载或重载时如果值为空（文件中为空或为 `null`，或列表中每一项都无法绑定），模块会在内存中改用字段声明的默认值，并输出一条警告，写明文件、键、值的种类、文件中写的值和默认值。字段名、某一级键名，或值与默认值中的映射键看起来像机密时，两个值都会隐去。模块照常加载，文件不会被写入。

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

校验文本、集合、映射或数组的大小在指定范围内。大小指文本的长度、列表或集合的元素个数、映射的条目数和数组的长度。

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

校验文本值是否匹配指定的正则表达式。文本指 `String`，或按单字符字符串匹配的 `char`。

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

各注解支持的值类型如下。对于声明为其他 `Collection` 类型的字段，例如队列，也适用集合列的规则：

| 注解 | 文本（`String`、`char`） | 数字 | 集合、数组 | 映射 | 其他类型 |
|---|---|---|---|---|---|
| `@Range` | 声明错误 | 违规时拒绝 | 声明错误 | 声明错误 | 声明错误 |
| `@Pattern` | 违规时拒绝 | 声明错误 | 声明错误 | 声明错误 | 声明错误 |
| `@Size` | 违规时拒绝 | 声明错误 | 违规时拒绝 | 违规时拒绝（按条目数） | 声明错误 |
| `@NotEmpty` | 违规时拒绝 | 声明错误 | 改用声明默认值并警告 | 改用声明默认值并警告 | 声明错误 |

「其他类型」包括布尔值、枚举、UUID、`Location` 等 Bukkit 类型，以及不能容纳任何受支持值的自定义类型。数字指基本数值类型或 `Number` 的子类型，例如 `Integer` 或 `BigDecimal`；字段类型还必须能由转换器绑定。

### 无法检查的声明

声明错误会在加载时、读取或创建配置文件之前拒绝模块，控制台用一条消息写明每个这样的字段、注解和原因。配置类中不是 `@ConfigEntry` 的字段上的约束同样如此。每个字段都按它自己的声明类型判断：`List<Integer>` 上的 `@Range` 属于错误，因为它不适用于列表本身。声明类型若能容纳注解可检查的值，例如 `Object`、`Serializable`、`Comparable`、`CharSequence` 或 `Number`，则不算约束错误：加载时绑定的值照常检查。其中只有 `Object` 无需转换器即可绑定，其余类型需要模块转换器（`@ConfigConverterFor`），否则模块会以 `no config converter for ...` 被拒绝。绑定的值若是注解无法读取的种类，例如 `@Range` 下 `Object` 设置里的文本，则与其他违规一样处理：加载时拒绝模块，重载时拒绝重载并保留运行中的值。只有永远不可能容纳可检查值的类型才会作为声明错误被拒绝。

约束注解只对本身就是配置类 `@ConfigEntry` 设置的字段生效。值类型的字段、嵌套类的字段，以及转换器产生的任何对象上的注解，既不检查也不报告：

```java
public static class OutputItem {
    @NotEmpty                    // 不检查，也不报告
    private String material;
}

@ConfigEntry(path = "recipes")
private Map<String, OutputItem> recipes = new HashMap<>();
```

`OutputItem` 由转换器从文件构造，框架只校验设置 `recipes` 本身，从不校验其中各个值的字段。请在模块的转换器中校验这些字段，在那里可以跳过或拒绝单个条目。

## 组合使用

`Object` 设置上的约束必须同时满足，不是按运行时类型择一使用。`@Range` 与 `@Pattern`、`@Size` 或 `@NotEmpty` 组合时，种类不能满足全部注解的普通非空内置值会被拒绝。`@Range + @Pattern` 和 `@Range + @Size` 仍允许 null 加载；`@NotEmpty` 拒绝 null。`Object` 字段中的空容器在 `@NotEmpty` 下会被拒绝，不会改用声明默认值：容器默认值替代依据声明的容器类型，而不是运行时值。需要这种替代时应将字段声明为列表、集合、映射或数组，并选择适用于该值类型的约束（[#635](https://github.com/UltiKits/UltiTools-Reborn/issues/635)）。

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

单文件配置实体支持公开的 `(String)` 构造器，或者公开的无参构造器。框架先尝试前者，将配置路径传给 `super(configFilePath)`；不存在才尝试后者，后者应调用 `super("config/config.yml")` 等固定路径。校验声明默认值也会按该顺序创建临时实例，所以构造器应无副作用。目录配置的每个文件要用 `(String)` 构造器，见[配置文件](/zh/guide/essentials/config-file)。

- **启动失败**：只拒绝所属模块，文件不变。改正配置后重启；模块未加载，不能用 `/ul reload` 把它加载回来。
- **重载失败**：失败的配置实体保留调用前的运行值，文件不变。改正后再次重载。此前已成功重载的其他文件不回滚；见[配置文件重载](/zh/guide/essentials/config-file#重载配置文件)。
- **编辑被拒绝**：`validateProposedProperties` 和 `updateProperties` 的校验错误报告声明键（如 `allowed-commands`），不是 Java 字段名。修正拟写入的值后重试，不用重启。普通拒绝不会改变文件或运行值。

启动和重载的详情使用 Java 字段名。`@Range` 报告实际数值，`@Size` 报告实际长度或条目数，`@Pattern` 报告实际值（疑似秘密时隐藏）。校验失败不会用默认值静默修复文件；上文的 `@NotEmpty` 容器回退只发生于绑定，且只改内存。
