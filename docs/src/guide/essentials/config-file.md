# Configuration

UltiTools provides an elegant singleton pattern encapsulation API that allows you to operate configuration files like
objects.

## Create a YAML configuration file

Firstly, you need to create a `config` folder in the `resources` folder. Put your plugin configuration files in it
according to your needs. These configuration files will be put into the collective configuration folder of UltiTools
plugin and displayed to users.

## Operate configuration files

### Create a configuration file object

According to the key-value pair structure of your configuration file, create a class that inherits
the `AbstractConfigEntity` class.

<<< @/../examples/src/main/java/com/ultikits/docs/config/SomeConfig.java

::: warning Constructor must be cheap and side-effect-free (as of v6.3.0)

The framework builds and discards throwaway instances of your class: two on every load, reload and
panel write attempt, one on every `save()`, and one per configuration when the server stops.
Keep the constructor to the `super(configFilePath)`-only idiom shown above.

:::

#### @ConfigEntity

The `@ConfigEntity` annotation is used to mark the location of a configuration file, which requires a string parameter
to specify the path of the configuration file in the plugin configuration folder. Usually this path is the same as the
path in the resource folder directory during your development.

The parameter here can also point to a folder. If you specify a folder, only `.yml` files in the folder are loaded as
the current configuration class; other file types are silently skipped.

```java
@Getter
@Setter
@ConfigEntity("test")  // This is a folder
public class TestConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "testString")
    private String testString = "test";
    ...
}
```

::: warning Note

If you specify a folder, you need to make sure that all configuration files in the folder can be read by the same
configuration class. Sub-folders are not included.

:::

You can use the `UltiToolsPlugin#getConfigs` method to get all loaded configurations.

```java
List<TestConfig> configs = BasicFunctions.getInstance().getConfigs(TestConfig.class);
```

Or you can directly specify the path of the configuration file in a folder to get the configuration.

```java
TestConfig config = BasicFunctions.getInstance().getConfig("test/test1.yml", TestConfig.class);
```


#### @ConfigEntry

`@ConfigEntry` is used to mark a configuration item. 

The `path` attribute is used to specify the path of the key of this
configuration item in the configuration file. 

The `comment` attribute is used to specify the comment of this configuration item.

As of v6.3.0, a `comment` that is exactly one language key, such as `comment = "{config.limit}"`, is resolved from your module's language catalogue (`lang/en.json`, `lang/zh.json`, or the `.yml` equivalents) in the server's current `language`, so one entry can ship its comment in every language the module supports. The framework writes that text on every write of the file, keys the operator already has included: the first-boot defaults write, a save, the shutdown save, a panel write, and the first start after an upgrade or a `language` switch. An operator's hand-written comment on such an entry is replaced, values keep their meaning, and a start whose comments already match writes nothing. The rewrite changes more than the comment lines: like every framework write, it renders the whole file again, so quotes the operator added are dropped, an inline list `[a, b]` becomes a multi-line list, `yes` becomes `true`, `1.50` becomes `1.5`, and a comment written beside a list item is lost. Values keep their meaning. This happens once on the first start after an upgrade and once after a `language` switch. A catalogue text with line breaks becomes several comment lines. A key missing from the catalogue is written as the token itself, with one warning naming the module, file, entry and key. Any other comment, including one that only contains a placeholder such as `{player}` inside other text, is written as it is, and only when the key is first added.

The `parser` attribute is used to specify the parser of this configuration item. The parser is used to convert the
object in the configuration file to the type of the configuration item. The default parser is `DefaultConfigParser`
, it can handle most of the case but not all. If you need to parse a more complex object, you can create a class that 
inherit the `ConfigParser` class and specify it in the `parser` attribute.

::: tip Built-in Parser
`StringHashMapParser` is a built-in, ready-to-use implementation at `com.ultikits.ultitools.interfaces.impl.pasers.StringHashMapParser`; reference it directly with `@ConfigEntry(parser = StringHashMapParser.class)` instead of writing a new one.
The snippet below only illustrates its logic, import the framework class shown above, not this file.
<<< @/../examples/src/main/java/com/ultikits/docs/config/StringHashMapParser.java
:::

#### Numeric fields

YAML stores a whole number such as `1800` as an integer. As of v6.3.0, a boxed `Long`, `Float` or `Double` field loads such a value, the same way a primitive `long`, `float` or `double` field does. Earlier versions could not set an integer into a boxed field of another numeric type, so such a field loaded on the first boot, when its default was written, and failed on every later boot and reload. Only widening conversions are applied, so a boxed field accepts exactly what its primitive type accepts.

A decimal such as `0.5` is read as a `Double`. As of v6.3.0, a `float` or `Float` field (or a `Float` list element) accepts it when the float nearest to it prints back as the same decimal, so `0.1`, `0.3` and `1.5` load, and a float the framework wrote always reads back ([#534](https://github.com/UltiKits/UltiTools-Reborn/issues/534)). A value with more digits than a float holds, such as `0.123456789`, keeps the default with a warning; use `double` or `Double` when you need that precision.

#### Collections, maps and wrongly shaped values

As of v6.3.0, a value is bound to the type its field declares. A `List<Integer>` receives `Integer`s, and a `Set`, `Long`, `Double`, `Boolean` or enum element type converts the same way; map keys and values are converted to the map's declared types, and a map whose values are your own class still receives the raw maps, as before. A quoted number that an earlier version wrote into the file, such as `'30'`, loads as the number. An element that cannot be converted, such as `abc` in a `List<Integer>`, is skipped with one warning naming the file, the key with the element's position, the value and the declared type, and the rest of the configuration loads; an empty list item is skipped the same way. `List`, `Set`, `SortedSet`, `Queue`, `EnumSet`, `Map`, `SortedMap`, `ConcurrentMap` and `EnumMap` fields are all supported, and a custom `parser`, including one that extends `DefaultConfigParser`, reads and writes exactly as before. Earlier versions bound every list element as its text, so a typed lookup such as `contains(30)` never matched. When a map or an object holds a `null` value, `save()` now leaves that value out of the file and logs one warning naming the file, the entry and the value's nested path; earlier versions stopped the save with a `NullPointerException` and left the file unchanged.

A value whose shape does not fit its field, such as a list or a plain value where a `Map` is declared, text in a number field, or a date such as `2024-01-01` in a text field, leaves the field at its declared default and logs one warning naming the file, the key, the declared type and what the file holds. The module still loads, and the operator's file is not rewritten. Earlier versions threw from the configuration load and the module did not start. A warning never prints a value when a key in it, or its own key, suggests a secret, such as `password` or `token`.

**Do not put a dot in a map key.** The configuration file uses `.` as its path separator, so in a map the file stores as a section - a map field, a map nested in one, or a map inside an object stored in one - a key such as `my.rule` is split into nested levels (`my` → `rule`) when it is written and when the file is loaded, and quoting it in YAML (`"my.rule":`) does not help. This is unchanged from earlier versions, and the framework neither refuses such a key nor warns about it, so use `-` or `_` in these keys, both in your declared defaults and in keys your module builds at run time, and tell operators the same. A map that is an element of a list is plain data the file keeps whole, so a dotted key there is kept.

As of v6.3.0, an `int`, `long`, `Integer` or `Long` field can also drive a task interval or a command cooldown: see [Config-Bound Timing](/guide/advanced/scheduled-tasks#config-bound-timing) for `@Scheduled` and [Binding the cooldown to a config key](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key) for `@CmdCD`. The config class must be registered exactly once for the module, so a directory `@ConfigEntity` cannot be bound. Do not also put a [`@Range`](/guide/advanced/config-validation) on a bound field: the binding enforces its own range, and a `@Range` violation during `/ul reload` aborts the rest of the module's reload ([#509](https://github.com/UltiKits/UltiTools-Reborn/issues/509)).

#### @Getter and @Setter

`@Getter` and `@Setter` are Lombok annotations, which are used to automatically generate `getter` and `setter` methods.

### Get configuration file object

Your main class which extends `UltiToolsPlugin` has a `getConfig` method to get the configuration file object.

You need to get the instance of the plugin main class, and then call the `getConfig` method.

```java
SomeConfig someConfig = SomePlugin.getInstance().getConfig(SomeConfig.class);
```

Now you can use the `getter` and `setter` methods to operate the configuration file.

::: tip Set and Save

After you set a value of a configuration you don't need to save it, UltiTools will automatically save it when disabling.
However, if you want to save it immediately, you can call the `save` method.

:::

::: info Saving on disable, as of v6.3.0
On disable, UltiTools saves a configuration only if your code changed it since it was last loaded or saved.
A configuration your module did not change is not rewritten, so edits the server owner made to its file while the server was running survive a restart.
If your module did change it, the file is still rewritten, and a WARNING is logged when that write overwrites edits made to the file on disk; a file whose YAML the framework could not parse the last time it read it is never rewritten at all, and gets its own WARNING.
:::

::: warning Configuration writes hold a lock, as of v6.3.0
Loading, saving, a panel write and the shutdown save of one configuration run one at a time, so a panel write arriving on the WebSocket thread and the shutdown save cannot interleave.
Your own `save()` call waits for any of those already in progress, and the throwaway construction above happens while that lock is held, which is the other reason to keep the constructor cheap.
Changes your module makes to its own fields, from any thread, are not covered by this lock.
:::

```java
boolean something = someConfig.getSomething();
```

::: tip
Although UltiTools lets you modify and save the configuration file from code, doing so is discouraged: it produces unexpected changes for users and, once your code has changed a configuration, can overwrite edits they made to its file while the server was running.
Configuration exists for the user to read and edit, so whether to apply a change is the user's call and your code should only write in response to an explicit user action.
For data your own plugin needs to persist, use [Data Storage](/guide/essentials/data-storage) instead.
:::

## Register configuration file

### Automatically register

Since UltiTools provides automatic registration function, you don't need to register configuration files manually, just
add the `@ConfigEntity` annotation to your configuration file class.

Please refer to [this article](/guide/advanced/auto-register) for more information about automatic registration.

### Manually register

You can register the config file by override the `getAllConfigs` method in your plugin main class.
This path only applies when the plugin class does not enable automatic config registration (`@EnableAutoRegister` or `@UltiToolsModule`, whose `config` attribute defaults to `true`): when it is enabled, `getAllConfigs` is never called even if you override it. `@ConfigEntity` on the config class is required either way; it does not by itself decide which path runs.

```java
@Override
public List<AbstractConfigEntity> getAllConfigs() {
    return Collections.singletonList(new SomeConfig("some/path/to/config"));
}
```

## Config Validation <Badge type="tip" text="v6.2.0+" />

Starting from v6.2.0, UltiTools provides validation annotations to protect against invalid configuration values. See the [Config Validation](/guide/advanced/config-validation) guide for full details.

<<< @/../examples/src/main/java/com/ultikits/docs/config/MyConfig.java

Available validation annotations: `@Range`, `@NotEmpty`, `@Size`, `@Pattern` (from `com.ultikits.ultitools.annotations.config`).

## Saving configuration files

You don't need to worry about the loading and saving of configuration files, UltiTools will do everything for you
automatically.

::: info Comments, as of v6.3.0
Bukkit preserves existing comments across a save, and UltiTools sets `options().parseComments(true)` explicitly rather than relying on the default. A key added for the first time also gets its `@ConfigEntry(comment)` written alongside it; a key the operator already has keeps its own comment unless that comment is a language key (see `@ConfigEntry` above).
:::

One cosmetic side effect: SnakeYAML re-emits a double-quoted string value as single-quoted on save. The value itself does not change, only its quoting style. As of v6.3.0 this happens only when a file is actually saved: a configuration nothing changed is not rewritten on disable.

## Configuration file reload

`UltiToolsPlugin` provides the `getConfigManager#reloadConfigs` method, you can call it to reload configuration files
when needed.

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```


