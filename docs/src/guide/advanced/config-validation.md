# Config Validation

::: info Since v6.2.0
Config validation annotations are available starting from UltiTools-API v6.2.0.
:::

UltiTools provides declarative validation annotations for configuration fields.

::: info Refusal semantics as of v6.3.0
A config value that fails validation refuses the owning module at load, instead of being reset. See [Behavior](#behavior) below.
:::

## Available Annotations

### @Range

Validates that a numeric value falls within a specified range (inclusive).

<<< @/../examples/src/main/java/com/ultikits/docs/validation/MyConfig.java

If a server admin sets `maxHomes: 999`, the module is refused at load. The console error names the module, the config file, the field `maxHomes`, the actual value `999`, and the violated constraint (`@Range(min = 1, max = 10)`); the file itself is left untouched.

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

A blank or missing value refuses the owning module at load; see [Behavior](#behavior) below.

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

<<< @/../examples/src/main/java/com/ultikits/docs/validation/PluginConfig.java

## Behavior

::: info Constructor resolution, as of v6.3.0
`validateFields()` obtains its default instance through the same two-step fallback `ConfigManager` uses elsewhere: a `(String)` constructor first, then a no-arg constructor calling `super("config/path.yml")`. Validation now fires on both shapes; only a class with neither constructor fails to register (see [#314](https://github.com/UltiKits/UltiTools-Reborn/issues/314)).
:::

A config class registers successfully as soon as either constructor shape resolves — `public MyConfig(String configFilePath)` calling `super(configFilePath)`, or a no-arg constructor calling `super("config/path.yml")` directly. Both are supported; declaring one is enough.

When a field's live value violates its constraint:

1. The module is refused at load. The value is not reset, and the file is not rewritten. Other modules continue loading normally.
2. The console error names the module, the config file, the field, the actual value, and the constraint that was violated, so the operator can fix the file without guessing.
3. Nothing about the file itself changes. The value the operator wrote stays exactly as they wrote it until they edit it themselves.

This is different from a typo silently working around itself: a config file belongs to the server operator, and only the operator's own edit changes it. Restart the server, or reload the module, after correcting the value.
