# 配置校验

::: info 自 v6.2.0 起
配置校验注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 为配置字段提供了声明式的校验注解。当配置值校验失败时，会自动重置为字段的默认值，并在控制台输出警告日志。

## 可用注解

### @Range

校验数值是否在指定范围内（包含边界）。

```java
import com.ultikits.ultitools.annotations.config.Range;

@Getter
@Setter
@ConfigEntity("config/config.yml")
public class MyConfig extends AbstractConfigEntity {

    @Range(min = 1, max = 10)
    @ConfigEntry(path = "maxHomes", comment = "每个玩家的最大家数量 (1-10)")
    private int maxHomes = 5;

    @Range(min = 0.0, max = 100.0)
    @ConfigEntry(path = "taxRate", comment = "税率百分比 (0-100)")
    private double taxRate = 5.0;

    public MyConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

如果服主设置了 `maxHomes: 999`，该值会被重置为 `5`（默认值），并在控制台显示警告。

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

如果值为空白或缺失，将重置为 `"My Server"`。

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

```java
@Getter
@Setter
@ConfigEntity("config/config.yml")
public class PluginConfig extends AbstractConfigEntity {

    @Range(min = 0, max = 300)
    @ConfigEntry(path = "teleport.warmup", comment = "传送等待时间（秒）(0-300)")
    private int teleportWarmup = 3;

    @Range(min = 0, max = 3600)
    @ConfigEntry(path = "teleport.cooldown", comment = "传送冷却时间（秒）(0-3600)")
    private int teleportCooldown = 60;

    @Range(min = 1, max = 100)
    @ConfigEntry(path = "home.maxHomes", comment = "每个玩家的最大家数量 (1-100)")
    private int maxHomes = 5;

    @NotEmpty
    @ConfigEntry(path = "messages.prefix", comment = "插件消息前缀")
    private String messagePrefix = "[MyPlugin]";

    @Size(min = 1, max = 20)
    @ConfigEntry(path = "worlds.allowed", comment = "插件生效的世界列表")
    private List<String> allowedWorlds = Arrays.asList("world");

    @Pattern(regex = "^(DIAMOND|GOLD|IRON|STONE|WOOD)$")
    @ConfigEntry(path = "gui.borderItem", comment = "GUI 边框材料")
    private String borderItem = "DIAMOND";

    public PluginConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

## 行为说明

当校验失败时：
1. 无效值会被替换为字段的**默认值**（即 Java 类中设置的初始值）
2. 控制台会输出一条**警告日志**，指出哪个配置值无效
3. 修正后的配置会自动保存

这确保你的插件始终使用有效的配置值运行，即使服主在配置中输入了错误值。
