# Config Validation

::: info Since v6.2.0
Config validation annotations are available starting from UltiTools-API v6.2.0.
:::

UltiTools provides declarative validation annotations for configuration fields. When a config value fails validation, it is automatically reset to the field's default value and a warning is logged.

## Available Annotations

### @Range

Validates that a numeric value falls within a specified range (inclusive).

```java
import com.ultikits.ultitools.annotations.config.Range;

@Getter
@Setter
@ConfigEntity("config/config.yml")
public class MyConfig extends AbstractConfigEntity {

    @Range(min = 1, max = 10)
    @ConfigEntry(path = "maxHomes", comment = "Maximum number of homes (1-10)")
    private int maxHomes = 5;

    @Range(min = 0.0, max = 100.0)
    @ConfigEntry(path = "taxRate", comment = "Tax rate percentage (0-100)")
    private double taxRate = 5.0;

    public MyConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

If a server admin sets `maxHomes: 999`, it will be reset to `5` (the default) and a warning will appear in the console.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `min` | `double` | `-Double.MAX_VALUE` | Minimum allowed value (inclusive) |
| `max` | `double` | `Double.MAX_VALUE` | Maximum allowed value (inclusive) |

### @NotEmpty

Validates that a String value is not null or empty (after trimming whitespace).

```java
import com.ultikits.ultitools.annotations.config.NotEmpty;

@NotEmpty
@ConfigEntry(path = "serverName", comment = "Display name of the server")
private String serverName = "My Server";
```

If the value is blank or missing, it resets to `"My Server"`.

### @Size

Validates that a Collection or String has a size/length within the specified bounds.

```java
import com.ultikits.ultitools.annotations.config.Size;

@Size(min = 1, max = 50)
@ConfigEntry(path = "motd", comment = "Message of the day (1-50 characters)")
private String motd = "Welcome!";

@Size(min = 1, max = 10)
@ConfigEntry(path = "allowedWorlds", comment = "List of allowed worlds (1-10)")
private List<String> allowedWorlds = Arrays.asList("world", "world_nether");
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `min` | `int` | `0` | Minimum size (inclusive) |
| `max` | `int` | `Integer.MAX_VALUE` | Maximum size (inclusive) |

### @Pattern

Validates that a String value matches a regular expression.

```java
import com.ultikits.ultitools.annotations.config.Pattern;

@Pattern(regex = "^#[0-9A-Fa-f]{6}$")
@ConfigEntry(path = "chatColor", comment = "Chat color in hex format (#RRGGBB)")
private String chatColor = "#FFFFFF";

@Pattern(regex = "^[a-zA-Z0-9_]{3,16}$")
@ConfigEntry(path = "prefix", comment = "Prefix (alphanumeric, 3-16 chars)")
private String prefix = "Server";
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `regex` | `String` | (required) | The regular expression pattern to match |

## Combining Annotations

You can use multiple validation annotations on the same field:

```java
@NotEmpty
@Size(min = 3, max = 32)
@Pattern(regex = "^[a-zA-Z0-9_ ]+$")
@ConfigEntry(path = "displayName", comment = "Display name (3-32 alphanumeric chars)")
private String displayName = "Default Name";
```

## Complete Example

```java
@Getter
@Setter
@ConfigEntity("config/config.yml")
public class PluginConfig extends AbstractConfigEntity {

    @Range(min = 0, max = 300)
    @ConfigEntry(path = "teleport.warmup", comment = "Teleport warmup in seconds (0-300)")
    private int teleportWarmup = 3;

    @Range(min = 0, max = 3600)
    @ConfigEntry(path = "teleport.cooldown", comment = "Teleport cooldown in seconds (0-3600)")
    private int teleportCooldown = 60;

    @Range(min = 1, max = 100)
    @ConfigEntry(path = "home.maxHomes", comment = "Maximum homes per player (1-100)")
    private int maxHomes = 5;

    @NotEmpty
    @ConfigEntry(path = "messages.prefix", comment = "Chat prefix for plugin messages")
    private String messagePrefix = "[MyPlugin]";

    @Size(min = 1, max = 20)
    @ConfigEntry(path = "worlds.allowed", comment = "Worlds where the plugin is active")
    private List<String> allowedWorlds = Arrays.asList("world");

    @Pattern(regex = "^(DIAMOND|GOLD|IRON|STONE|WOOD)$")
    @ConfigEntry(path = "gui.borderItem", comment = "Border item material")
    private String borderItem = "DIAMOND";

    public PluginConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

## Behavior

When validation fails:
1. The invalid value is replaced with the field's **default value** (the value set in the Java class)
2. A **warning** is logged to the server console indicating which config value was invalid
3. The corrected config is saved automatically

This ensures your plugin always operates with valid configuration values, even if a server admin makes a typo.
