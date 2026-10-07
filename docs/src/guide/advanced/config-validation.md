# Config Validation

::: info Since v6.2.0
Config validation annotations are available starting from UltiTools-API v6.2.0.
:::

UltiTools provides declarative validation annotations for configuration fields.

::: info Refusal semantics as of v6.3.0
A config value that fails validation refuses the owning module at load, instead of being reset. The one exception is an empty list, set or map under `@NotEmpty`, which runs its declared default. See [Behavior](#behavior) below.
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

As of v6.3.0 a value must satisfy `min <= value <= max`. NaN (`.nan` in YAML) is out of every range, and an infinity (`.inf`, `-.inf`) is out of range unless that bound is itself infinite, for example `max = Double.POSITIVE_INFINITY`. `@Range` checks numbers only.

### @NotEmpty

Validates that a value is not empty. On text (a `String`, or a `char`), a value that is null or blank after trimming whitespace refuses the owning module at load.

```java
import com.ultikits.ultitools.annotations.config.NotEmpty;

@NotEmpty
@ConfigEntry(path = "serverName", comment = "Display name of the server")
private String serverName = "My Server";
```

A blank or missing value refuses the owning module at load; see [Behavior](#behavior) below.

As of v6.3.0, `@NotEmpty` also applies to lists, sets, maps and arrays, with a different outcome. When a load or reload finds the value empty (empty or `null` in the file, or a list whose every entry failed to bind), the module runs on the field's declared default in memory and logs one warning naming the file, the key, the value kind, the value as written and the default. Both values are redacted when the field name, a key segment, or a map key inside the value or the default looks like a secret. The module loads, and the file is not written.

```java
@NotEmpty
@Size(min = 1, max = 15)
@ConfigEntry(path = "lines", comment = "Sidebar lines (1-15)")
private List<String> lines = new ArrayList<>(Arrays.asList("Welcome", "Online: %online%"));
```

With `lines: []` in the file, the console shows:

```
File config/sidebar.yml, key 'lines': the list is empty (found []) but the setting is declared @NotEmpty; using the declared default [Welcome, Online: %online%] in memory (the file is not changed)
```

The declared default has to satisfy the field's constraints itself: it must not be empty, and it must lie inside the field's `@Size` if there is one. A class whose default does not is refused at load, whatever the file holds. A panel edit that would empty the value is refused like any other violation.

While the default runs, the panel still shows the file's value (`[]`). An operator command that writes this setting through `saveOperatorChange` writes the running value, the default plus the operator's change, in place of `[]`, because the operator asked for that key to change.

### @Size

Validates that text, a collection, a map or an array has a size within the specified bounds. The size is a text's length, a list's or set's size, a map's number of entries and an array's length (maps and arrays as of v6.3.0).

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

Validates that a text value matches a regular expression. Text is a `String`, or a `char` matched as a one-character string (as of v6.3.0).

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

## Supported Value Kinds

Each annotation checks the value kinds it can measure. As of v6.3.0 the outcome per kind is:

| Annotation | Text (`String`, `char`) | Number | List, set, array | Map | Anything else |
|---|---|---|---|---|---|
| `@Range` | declaration error | refused on violation | declaration error | declaration error | declaration error |
| `@Pattern` | refused on violation | declaration error | declaration error | declaration error | declaration error |
| `@Size` | refused on violation | declaration error | refused on violation | refused on violation (entries) | declaration error |
| `@NotEmpty` | refused on violation | declaration error | declared default with a warning | declared default with a warning | declaration error |

"Anything else" covers booleans, enums, UUIDs, Bukkit values such as `Location`, and your own value types. A number is a primitive number or a `Number` such as `Integer` or `BigDecimal`.

### Unsupported Declarations

A declaration error refuses the module at load, before its configuration file is read or created. One console message names every such field, the annotation and the reason. The same applies to a constraint on a field of a config class that is not a `@ConfigEntry`. Each field is judged by its own declared type: `@Range` on a `List<Integer>` is an error, because it does not apply to the list itself. A declared type that can hold a value the annotation checks, such as `Object`, `Serializable`, `Comparable`, `CharSequence` or `Number`, is not a constraint error: the value bound at load is checked. Only `Object` binds without a converter; the others need a module converter (`@ConfigConverterFor`), or the module is refused with `no config converter for ...`. A bound value of a kind the annotation cannot read, such as text in an `Object` setting under `@Range`, is a violation like any other: the module is refused at load, and a reload is refused with the running values kept. Only a type that can never hold a checkable value is refused as a declaration error.

The constraint annotations take effect only on fields that are themselves `@ConfigEntry` settings of a config class. An annotation on a field of a value type, a nested class or anything a converter produces is never checked and not reported:

```java
public static class OutputItem {
    @NotEmpty                    // not checked and not reported
    private String material;
}

@ConfigEntry(path = "recipes")
private Map<String, OutputItem> recipes = new HashMap<>();
```

A converter builds `OutputItem` from the file, and the framework validates only the setting `recipes` itself, never the fields of the values inside it. Validate such fields in your module's converter, where you can skip or refuse the one entry. UltiRecipe's `RecipeConfig.OutputItem` has this shape: the module checks those fields itself, and its 6.3.0 build removes the two annotations, which never took effect.

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

1. The module is refused at load. The value is not reset, and the file is not rewritten. Other modules continue loading normally. An empty list, set or map under `@NotEmpty` is the exception: it runs its declared default, as described under [@NotEmpty](#notempty).
2. The console error names the module, the config file, the field, the actual value, and the constraint that was violated, so the operator can fix the file without guessing.
3. Nothing about the file itself changes. The value the operator wrote stays exactly as they wrote it until they edit it themselves.

This is different from a typo silently working around itself: a config file belongs to the server operator, and only the operator's own edit changes it. Restart the server, or reload the module, after correcting the value.
