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

::: warning Constructor requirements, as of v6.3.0
Keep constructors cheap and side-effect-free: validation and save preparation may construct temporary instances.
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

As of v6.3.0, `path` still splits at every dot: `chat.aliases` is a nested entry path. Keys inside a bound map are whole keys, so `g.m`, `o.O` and `wave.` are supported. Files already split by 6.2 are read as written, without automatic recombination; a nested value in a `Map<String, String>` is skipped with a warning.

A literal `comment` is supplied when its key is first added. A comment that is exactly one trimmed language token, such as `comment = "{config.limit}"`, is resolved through the module catalogue in the current framework `language` on every load and write. That entry's block comment is framework-owned: operator text there is replaced, while literal-entry operator comments remain. Missing catalogue keys retain the token and warn once; line breaks/control characters are sanitized before YAML comments are created.

As of v6.3.0, leave `parser` at its default to use the declared-type converter registry. Explicit non-default legacy parsers keep their frozen old behavior, including section-based dotted-key splitting, through an adapter. Six parser-related declarations first carry `forRemoval` in 6.3.0, with removal announced for 6.4.0. New code uses [Config Converters](/guide/advanced/config-converters), not a `DefaultConfigParser` subclass.

#### Numeric fields

As of v6.3.0, primitives and boxed numeric fields use the same conversion rules. Integral narrowing must be exact and within range; numeric text such as `'30'` can bind to an integer. A decimal binds to `float`/`Float` only when the parsed float's shortest printable decimal has the same numeric value: `0.03` and `1.50` pass, `0.100000001` does not. Invalid fields keep their declared defaults with a located warning. Use `double` when more decimal precision is required; float acceptance is not exact binary representation.

An `int`, `long`, `Integer` or `Long` field can also drive a task interval or command cooldown: see [Config-Bound Timing](/guide/advanced/scheduled-tasks#config-bound-timing) and [Config-bound cooldowns](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key). The configuration must be registered exactly once; directory entities cannot be bound. Avoid combining a bound field with [`@Range`](/guide/advanced/config-validation), because binding has its own range check.

#### Collections and null

As of v6.3.0, full inherited generic types drive lists, sets, queues, maps, arrays and enums. Invalid collection/map elements are skipped with a warning; a wrongly shaped whole field uses its initially declared default. Warnings identify the file, key, position and type and redact secret-shaped values. An unknown declared type refuses module load before any config file is read or created; register a converter rather than accepting raw maps into a custom class.

Explicit null round-trips where the reference type permits it; primitive null is invalid. UUIDs and enums use plain text, and registered Bukkit `ConfigurationSerializable` values use alias-tagged maps. A Bukkit value read into an `Object` slot stays a plain map. Unknown runtime Java objects refuse a save without touching the file.

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

As of v6.3.0, shutdown saves only dirty registered configurations, before module release. A clean live configuration is not rewritten merely because an operator edited its disk file. Pending code edits may overwrite operator values; a successful replacement warns once naming the file and only the keys actually overwritten, never their values. Panel edits acknowledge only touched fields, so unrelated unsaved fields remain dirty.

Initialization, reload and ConfigManager registry operations are server-thread confined while a server runs. Off-thread void operations warn and do nothing; registry getters, JSON readers/writers warn and throw `IllegalStateException`. Panel update/upload/reconnect callbacks queue their complete operation on the server thread and reply after it runs. Entity monitors serialize persistence, but your own asynchronous field mutation is not protected by those monitors. Schedule module mutations/reloads on the server thread.

The module's `getConfig(Class)` returns an entity and remains available. The entity's old mutable Bukkit `getConfig()` accessor is removed as of v6.3.0 by the maintainer's one-time compatibility carve-out; it worked in 6.2.5, and third-party usage is unknown. Use `isPresentInFile("entry.path")` for presence in the last successful load (null and undeclared keys count); it splits dots and cannot address whole dotted map keys. Change declared fields, then `save()`.

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

As of v6.3.0, an edited save emits the full document through SnakeYAML. Content, comment text, key order and supported quote/list/line-ending/BOM/final-newline styles are preserved; operator layout may normalize. Aligned comment spacing, flow spacing, mixed indentation, document markers and trailing spaces are not byte guarantees. A semantic no-op does not write, preserving exact bytes and modification time. An explicit save compares against current disk content and may overwrite an operator change even if the entity was clean.

Writes first force a same-directory temporary, then replace atomically. Only unsupported atomic move, EBUSY/cross-device or permitted temporary-creation refusal allows backed in-place fallback. `<file>.bak` is forced before the target is opened; an existing backup is refreshed from current raw target bytes through a forced temporary and atomic backup replacement. A backup refusal leaves target and previous backup untouched. A later in-place failure may leave a partial target with complete backup retained. Only a successful strict current-file load removes it; there is no automatic restoration.

Unreadable, malformed or non-UTF-8 files are protected on every entity write route. Initial failure uses defaults; failed reload keeps running fields. One SEVERE names the file and safe cause, without source snippets. Only a later successful load clears protection. Validation precedes default/comment and panel persistence.

Registration batches buffer initialization writes until every selected entity binds and validates; refused batches change no files. Accepted files then persist independently. Multi-file panel updates instead validate and stage all touched files, then commit and acknowledge together, with in-process rollback on ordinary refusal. Persistent storage failure can prevent restoration; crashes between moves are not a crash-safe multi-file transaction.

Panel map leaf edits use actual whole file keys and the full declared field converter. A unique changed leaf persists; ambiguous or missing changed paths refuse the whole payload by name. Unchanged displayed leaves are not edits. Untargeted pending memory values and independently edited disk siblings are preserved. The existing reply format is unchanged.

## Configuration file reload

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```

As of v6.3.0, reload performs a three-way comparison of the last effective baseline, live fields and incoming file. Memory-only edits survive and stay dirty; disk-only edits are adopted; conflicts take disk with a located, redacted warning. Maps merge recursively by whole keys, lists/scalars are atomic, and missing whole fields retain live values. Memory-only map order is preserved when that disk map is unchanged; reload does not write it. This is not a concurrent map-insertion ordering policy.

Before framework construction of an identifiable newer module copy, dirty old configuration is saved in sorted file order. Failure refuses construction and retains the old copy. If identity is unavailable before construction, successful replacement warns with dropped file/key names and does not save the old copy late. Unload releases its registry owners; shutdown saves before release.

## Known limits

As of v6.3.0, [#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578) records special anchored containers, complex symlink paths, Unicode style-offset cost and direct-alias token-comment ownership. Alias comments can affect the source anchor and cause repeated writes. [#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580) records refusal of a valid block anchor with a comment before its first child. Protection preserves those refused file bytes; it does not make their values readable. [#545](https://github.com/UltiKits/UltiTools-Reborn/issues/545) remains the crash-safe multi-file persistence limit.
