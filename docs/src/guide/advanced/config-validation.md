# Config Validation

This guide targets UltiTools-API 7.0. For 6.x, see the [archived v6.5.0 guide](/v6.5.0/guide/advanced/config-validation.html).

UltiTools provides declarative validation annotations for configuration fields.

## Available Annotations

### @Range

Validates that a numeric value falls within a specified range (inclusive).

<<< @/../examples/src/main/java/com/ultikits/docs/validation/MyConfig.java

If the module is named `MyModule` and an operator sets `maxHomes: 999`, the framework refuses the module and leaves the file intact. The validation reason appears as follows; this text is not translated:

```text
Module 'MyModule' refused to load: configuration file 'config/config.yml' violates its validation constraints (1): field 'maxHomes' value 999 is out of range [1.0, 10.0]. The file was not modified - fix the value(s) and restart.
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `min` | `double` | `-Double.MAX_VALUE` | Minimum allowed value (inclusive) |
| `max` | `double` | `Double.MAX_VALUE` | Maximum allowed value (inclusive) |

A value must satisfy `min <= value <= max`. NaN (`.nan` in YAML) is out of every range, and an infinity (`.inf`, `-.inf`) is out of range unless that bound is itself infinite, for example `max = Double.POSITIVE_INFINITY`. `@Range` checks numbers only.

### @NotEmpty

Validates that a value is not empty. On text (a `String`, or a `char`), a value that is null or blank after trimming whitespace refuses the owning module at load.

```java
import com.ultikits.ultitools.annotations.config.NotEmpty;

@NotEmpty
@ConfigEntry(path = "serverName", comment = "Display name of the server")
private String serverName = "My Server";
```

An absent key is not an explicit empty value. An absent key uses the declared default on startup; reload also takes live changes into account. A blank string or an explicit null `String` value fails `@NotEmpty`.

`@NotEmpty` also applies to collections, maps and arrays, with a different outcome. When a load or reload finds the value empty (empty or `null` in the file, or a list whose every entry failed to bind), the module runs on the field's declared default in memory and logs one warning naming the file, the key, the value kind, the value as written and the default. Both values are redacted when the field name, a key segment, or a map key inside the value or the default looks like a secret. The module loads, and the file is not written.

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

Validates that text, a collection, a map or an array has a size within the specified bounds. The size is a text's length, a list's or set's size, a map's number of entries and an array's length.

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

Validates that a text value matches a regular expression. Text is a `String`, or a `char` matched as a one-character string.

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

Each annotation checks the value kinds it can measure. The collection column also applies to other supported `Collection` types, such as queues:

| Annotation | Text (`String`, `char`) | Number | Collection, array | Map | Anything else |
|---|---|---|---|---|---|
| `@Range` | declaration error | refused on violation | declaration error | declaration error | declaration error |
| `@Pattern` | refused on violation | declaration error | declaration error | declaration error | declaration error |
| `@Size` | refused on violation | declaration error | refused on violation | refused on violation (entries) | declaration error |
| `@NotEmpty` | refused on violation | declaration error | declared default with a warning | declared default with a warning | declaration error |

"Anything else" includes booleans, enums, UUIDs, Bukkit values such as `Location`, and custom types that cannot hold a supported value. A number is a numeric primitive or a subtype of `Number`, such as `Integer` or `BigDecimal`; the field type also needs to be convertible.

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

A converter builds `OutputItem` from the file, and the framework validates only the setting `recipes` itself, never the fields of the values inside it. Validate such fields in your module's converter, where you can skip or refuse the one entry.

## Combining Annotations

Constraints on an `Object` setting are checked together, not as alternatives selected by its runtime type. `@Range` with `@Pattern`, `@Size` or `@NotEmpty` refuses ordinary non-null built-in values whose kind cannot satisfy every annotation. Null still loads with `@Range + @Pattern` or `@Range + @Size`; `@NotEmpty` refuses null. An empty container held in an `Object` field under `@NotEmpty` is refused rather than replaced by its declared default: container-default substitution uses the declared container type, not the runtime value. Declare a list, set, map or array field when you need that substitution, and choose constraints appropriate to its value kind ([#635](https://github.com/UltiKits/UltiTools-Reborn/issues/635)).

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

A single-file config entity supports either a public `(String)` constructor or a public no-argument constructor. The framework tries the former first, passing the path to `super(configFilePath)`. If it is absent, the no-argument constructor should call `super("config/config.yml")` or another fixed path. Validation uses the same order to construct a temporary default instance, so keep the constructors side-effect-free. Directory entries need the `(String)` constructor for each file; see [Configuration](/guide/essentials/config-file).

- **Startup refusal:** only the owning module is refused, and the file is unchanged. Fix the value and restart; `/ul reload` cannot load a module that was refused at startup.
- **Reload refusal:** the failing config entity keeps its pre-reload values and its file is unchanged. Correct the value and reload again. Earlier files that already reloaded are not rolled back; see [Configuration file reload](/guide/essentials/config-file#configuration-file-reload).
- **Edit refusal:** `validateProposedProperties` and `updateProperties` report the declared key (such as `allowed-commands`), not the Java field name. Correct the proposed value and retry without restarting. An ordinary refusal changes neither the file nor the running values.

Startup and reload details name the Java field. `@Range` reports the actual number, `@Size` the actual length or count, and `@Pattern` the actual value (redacted for a secret-shaped setting). Validation never silently repairs the file: the `@NotEmpty` container fallback described above happens during binding and changes only memory.
