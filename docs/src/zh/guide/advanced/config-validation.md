# 配置校验

::: info 自 v6.2.0 起
配置校验注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 为配置字段提供了声明式的校验注解。

::: info 拒绝语义（v6.3.0 起）
校验失败的配置值会在加载时拒绝所属模块，不再重置。见下方[行为说明](#行为说明)。
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

### @NotEmpty

校验字符串值不为 null 或空（去除首尾空格后）。

```java
import com.ultikits.ultitools.annotations.config.NotEmpty;

@NotEmpty
@ConfigEntry(path = "serverName", comment = "服务器显示名称")
private String serverName = "My Server";
```

值为空白或缺失时，所属模块会在加载时被拒绝，见下方[行为说明](#行为说明)。

### @Size

校验集合或字符串的大小/长度在指定范围内。

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

校验字符串值是否匹配指定的正则表达式。

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

1. 模块会在加载时被拒绝，值不会被重置，文件也不会被改写。其余模块照常加载。
2. 控制台错误会指出模块、配置文件、字段、实际值，以及被违反的约束，服主据此即可修复，无需猜测。
3. 文件本身不会有任何变化，服主写下的值会原样保留，直到他们自己编辑它为止。

这与「输错了自动帮你改对」不同：配置文件归服主所有，只有服主自己的修改才会改变它。修正数值后，重启服务器或重载该模块即可。
