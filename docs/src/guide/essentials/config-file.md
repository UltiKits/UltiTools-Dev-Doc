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

As of v6.3.0, a setting the operator writes as a flat dotted key is that setting: for `path = "features.chat"`, the line `features.chat: false` binds `false`, as it did through Bukkit in 6.2, and so does any split of the dots (`a.b:` / `c: 1` for `a.b.c`). The framework never adds a nested copy of it: a start-up insert, `save()`, `saveOperatorChange`, `saveOperatorMapEntry` and a panel edit write that one line. `@ConditionalOnConfig` and `isPresentInFile` read the path the same way. A setting written in both forms in one file (`features.chat: false` and `features:` / `chat: true`), even with equal values, refuses the module before its code runs; the message names the file and the setting, never a value. This applies to setting paths only; keys inside a bound map stay whole.

A literal `comment` is written when its key is inserted. A comment that is exactly one trimmed language token, such as `comment = "{config.limit}"`, is resolved through the module catalogue in the current framework `language`. As of v6.3.0 the framework rewrites only the comment lines it can identify as its own: the entry's comment, or its trailing run of lines, equal byte for byte (the entry's column, `# ` and the text) to its rendering of the token in a catalogue the module's jar ships, of the text the module resolves now, of the bare token, or of an older shipped text listed in `previousComments`. An operator's note above the entry, a framework comment the operator edited and every literal comment are kept byte for byte. Start-up and `/ul reload` refresh the framework's lines in the current language; a save, an operator change and a panel edit rewrite no comment. Missing catalogue keys retain the token and warn once; line breaks/control characters are sanitized before YAML comments are created.

When a module changes the catalogue wording of a token comment, servers that upgraded still hold the old text. List that text so it keeps following the language:

```java
@ConfigEntry(path = "lock.timeout", comment = "{config.lock.timeout}",
        previousComments = {"Lock timeout in seconds"})
private int lockTimeout = 30;
```

As of v6.3.0, leave `parser` at its default to use the declared-type converter registry. Explicit non-default legacy parsers receive exactly the input 6.2 gave them: detached input through a fresh Bukkit `YamlConfiguration#get`, preserving 6.2 section-based dotted-key splitting and `==` alias deserialization at the root and inside lists/maps, even for explicitly parsed `Object` fields. This input does not use registry converters; output still crosses the plain-data boundary and retains boxed widening. Bukkit's own alias restrictions remain: integral Vector coordinates deserialize to null, whereas fractional coordinates deserialize normally. Six parser-related declarations first carry `forRemoval` in 6.3.0, with removal announced for 6.4.0. New code uses [Config Converters](/guide/advanced/config-converters), not a `DefaultConfigParser` subclass.

#### Numeric fields

As of v6.3.0, primitives and boxed numeric fields use the same conversion rules. Panel JSON integers within the long range use `Long`; integers beyond the long range are kept exactly as `BigInteger`. Fractional panel numbers keep the existing `Double` route. Integral narrowing must be exact and within range; numeric text such as `'30'` can bind to an integer. A decimal binds to `float`/`Float` only when the parsed float's shortest printable decimal has the same numeric value: `0.03` and `1.50` pass, `0.100000001` does not. Invalid fields keep their declared defaults with a located warning. Use `double` when more decimal precision is required; float acceptance is not exact binary representation.

An `int`, `long`, `Integer` or `Long` field can also drive a task interval or command cooldown: see [Config-Bound Timing](/guide/advanced/scheduled-tasks#config-bound-timing) and [Config-bound cooldowns](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key). The configuration must be registered exactly once; directory entities cannot be bound. Avoid combining a bound field with [`@Range`](/guide/advanced/config-validation), because binding has its own range check.

#### Collections and null

As of v6.3.0, full inherited generic types drive lists, sets, queues, maps, arrays and enums. Invalid collection/map elements are skipped with a warning; a wrongly shaped whole field uses its initially declared default. Warnings identify the file, key, position and type and redact secret-shaped values. An unknown declared type refuses module load before any config file is read or created; register a converter rather than accepting raw maps into a custom class.

Explicit null whole fields and null map values still round-trip; primitive null is invalid. Typed collections (including `List<Object>`) and reference arrays (including `Object[]`) omit null elements on write with one located warning per field. A null element of a typed collection read from the file is likewise skipped with a located warning, as in 6.2; plain data in a declared `Object` slot remains plain. UUIDs and enums use plain text, and registered Bukkit `ConfigurationSerializable` values use alias-tagged maps. A Bukkit value read into an `Object` slot without an explicit legacy parser stays a plain map. Unknown runtime Java objects refuse a save without touching the file.

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
As of v6.3.0 nothing is saved when the server stops. Call `save()` when your code makes a change that should reach the file.
:::

As of v6.3.0, nothing writes configuration at server stop, module unload or module replacement. A module change that was never saved is named in one WARNING, listing the file and the keys but never values, and is dropped; `ConfigManager#saveAll()` writes nothing and is deprecated. An edit an operator makes to the file while the server runs is never touched by a stop. A file that could not be read or parsed at its last load is named once instead. Panel edits acknowledge only touched fields, so unrelated unsaved fields stay unsaved.

Initialization, reload and ConfigManager registry operations are server-thread confined while a server runs. Off-thread void operations warn and do nothing; registry getters, JSON readers/writers warn and throw `IllegalStateException`. Panel update/upload/reconnect callbacks queue their complete operation on the server thread and reply after it runs. Entity monitors serialize persistence, but your own asynchronous field mutation is not protected by those monitors. Schedule module mutations/reloads on the server thread.

The module's `getConfig(Class)` returns an entity and remains available. The entity's old mutable Bukkit `getConfig()` accessor is removed as of v6.3.0 by the maintainer's one-time compatibility carve-out; it worked in 6.2.5, and third-party usage is unknown. Use `isPresentInFile("entry.path")` for presence in the last successful load (null and undeclared keys count); it splits dots and cannot address whole dotted map keys. Change declared fields, then `save()`.

```java
boolean something = someConfig.getSomething();
```

::: tip Who writes configuration
Configuration is the operator's to read and edit. Write to it only for a change the operator asked for, preferably with `saveOperatorChange` or `saveOperatorMapEntry` (see [Saving configuration files](#saving-configuration-files)).
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

### Write contract

As of v6.3.0 the framework never overwrites configuration an operator wrote, unless the operator asked for that change. What code may write depends on who owns the file:

| File | Code may write |
|---|---|
| A configuration file the module ships (`config.yml`, `spawn.yml`) | the file, the first time, when it does not exist; a declared key the file lacks and the framework's own comments, inserted only; exactly the setting an operator asked to change through a command, the panel or a GUI; a value that still equals the shipped text, re-rendered after a language switch |
| A file the operator creates (a kit, a menu) | the file, on the operator's create action; on an edit, only the edited part |

Nothing else is written: no save at stop, unload or replacement, no repair of an invalid value, no layout normalization and no cleanup of map keys that 6.2 split at their dots.

Every write goes through one write gate. A write declares the keys it owns; after rendering, every byte outside them must equal the file as read, and the file must still hold the bytes it was read from. Otherwise nothing is written: one WARNING names the file, the keys and the reason, never a value, and the values in memory are used.

Official language files are the one exception. They are framework-owned and may be replaced on upgrade; to customise text, copy an official file under a new name, edit the copy and select it in the main configuration (see [Internationalization](/guide/essentials/i18n)).

### `save()`

As of v6.3.0, `save()` writes only the settings the module changed since the last load or save, and only where the file still holds the value it was read with. A setting declared as a `Map` is written entry by entry; a list, or a Bukkit value such as a `Location` or `Vector`, is written whole or not at all. A save never inserts a key the file lacks, never rewrites a comment and never removes a map entry the module did not remove.

A value the operator edited on disk, a key the operator deleted and a value the framework could not use (`interval: 3O0`) are therefore never written over. The module's change stays in memory and one WARNING names the key. The comparison uses the text last read: after an operator edits a setting on disk without `/ul reload`, even one that keeps its value such as `64` to `64.0`, the module's next change of that setting is not written until a reload reads the file again. A save with nothing to write leaves the bytes and the modification time unchanged.

### Operator commands

A command that changes exactly one thing at the operator's request uses one of two methods added in v6.3.0. The operator's request is the consent: the module's value replaces what the file holds at the named keys, and nothing else is written.

```java
// /setspawn: write exactly the six location settings
config.setSpawn(player.getLocation());
config.saveOperatorChange("spawn.location.world", "spawn.location.x", "spawn.location.y",
        "spawn.location.z", "spawn.location.yaw", "spawn.location.pitch");

// /autoreply add <name>: write exactly one map entry; entries the operator added by hand stay
config.getRules().put(name, rule);
try {
    config.saveOperatorMapEntry("autoreply.rules", name);
} catch (ConfigWriteRefusedException refused) {
    config.getRules().remove(name); // keep memory equal to the file
    sender.sendMessage("Not saved: " + refused.getReason());
}
```

Naming a map setting in `saveOperatorChange` writes the whole map and drops entries the operator added by hand; use `saveOperatorMapEntry` for a command that changes one entry. A refusal throws `com.ultikits.ultitools.config.ConfigWriteRefusedException`, an `IOException` whose `getReason()` names the reason without a value: reply that nothing was saved and why, and roll back the in-memory change so the running state matches the file. A path that is not a declared entry throws `IllegalArgumentException`. Both methods run on the server thread.

### Refused writes

A write is refused when the file cannot be read or parsed, uses YAML anchors, aliases or merge keys, changed since it was read, or has a layout the renderer cannot write back byte for byte. A layout refusal names the line to fix, for example `the file's layout outside the keys this write owns would change (line 16)`.

Layouts that refuse every write to the file include a line of only spaces, a trailing space after a value, an inline comment aligned with several spaces, more than one space after a colon, spaces inside flow brackets (`[ a ]`), a `---` or `...` marker, a block scalar followed by a blank line, a comment indented deeper than the key below it, two indentation widths in one file and mixed line endings. None of the files the framework and its modules ship has such a layout. The operator fixes the named line, or runs `/ul reload` after "the file changed since it was read", and repeats the change.

A 0-byte file, a file of blank lines and a file of comments at the start of their lines count as empty: start-up inserts the declared keys. A file of spaces, a comment-only file with an indented comment and a file holding only a byte-order mark are refused as layouts.

### Operator files a module manages

As of v6.3.0, `com.ultikits.ultitools.config.OperatorFiles` writes a YAML file a module manages for the operator, such as a kit file, on an explicit operator edit. It writes only the named keys, through the same gate, and only while the file still holds the bytes it was read with:

```java
OperatorFiles.Snapshot snapshot = OperatorFiles.read(kitFile);
Map<List<String>, Object> edit = new LinkedHashMap<>();
edit.put(Arrays.asList(kitName, "items"), serializedItems); // plain data only
OperatorFiles.WriteResult result = OperatorFiles.write(snapshot, edit);
```

The result is `WRITTEN`, `UNCHANGED`, `FILE_CHANGED` (the file changed since `read`) or `REFUSED` (a layout or anchors, with the gate's WARNING). Each key in the list is one whole key, so a name containing `.` stays one key. `OperatorFiles` never creates, deletes or renames a file and is not for `@ConfigEntity` files.

### Atomic replacement

Comments on individual list items are kept only while the list keeps its length — the same as Bukkit, which keeps none.

Writes first force a same-directory temporary, then replace atomically. Only unsupported atomic move, EBUSY/cross-device or permitted temporary-creation refusal allows backed in-place fallback. As of v6.3.0 the backup is named `<file>.ultitools-backup-<16 hex>` and is forced before the target is opened; a backup this server run wrote for the same file, still holding what it wrote, is refreshed from the current target through a forced temporary and atomic replacement. An operator's own `<file>.bak` is never read, written or deleted. A backup refusal leaves target and previous backup untouched. A later in-place failure may leave a partial target with complete backup retained. Only a successful strict current-file load removes it, and only while its bytes still match what was written; there is no automatic restoration.

Unreadable, malformed or non-UTF-8 files are protected on every entity write route. Initial failure uses defaults and logs one SEVERE naming the file and safe cause, without source snippets. As of v6.3.0, a reload of such a file keeps running fields and the file unchanged and throws `ConfigurationException` naming the file and the same safe cause; `/ul reload <module>` then replies that the module failed to reload with that cause. Only a later successful load clears protection. Validation precedes default/comment and panel persistence.

Registration batches buffer initialization writes until every selected entity binds and validates; refused batches change no files. Accepted files then persist independently, through the write gate and only while each file still holds the bytes read at registration. Multi-file panel updates instead validate and stage all touched files, then commit and acknowledge together, with in-process rollback on ordinary refusal. Persistent storage failure can prevent restoration; crashes between moves are not a crash-safe multi-file transaction.

A panel edit is all-or-nothing too. If validation rejects a value or the file write fails, the touched fields return to their previous values, the file keeps its bytes, the panel receives the failure, and a retry persists the edit.

Panel map leaf edits use actual whole file keys and the full declared field converter. A unique changed leaf persists; ambiguous or missing changed paths refuse the whole payload by name. Unchanged displayed leaves are not edits. Untargeted pending memory values and independently edited disk siblings are preserved. The existing reply format is unchanged.

As of v6.3.0 a panel edit writes only the keys it names, through the write gate: it replaces an operator-edited value at exactly those keys, which is the operator's consent, and every other byte of the file stays. A file the gate refuses gets an error reply naming the reason. An edit of one field of a Bukkit value such as a `Location` writes that value as the file holds it with the one field changed, so the other fields keep the operator's text (`y: 64` stays), and only while the file still holds the value it was read with; otherwise the reply asks for a reload first.

## Configuration file reload

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```

As of v6.3.0, reload performs a three-way comparison of the last effective baseline, live fields and incoming file. Memory-only edits survive and stay dirty; disk-only edits are adopted; conflicts take disk with a located, redacted warning. Maps merge recursively by whole keys and lists/scalars are atomic. A whole field the operator deleted from the file binds its declared default, with one warning naming the key, unless the module changed it since the last load or save; the file is not written either way. A failed reload is all-or-nothing: if it fails, for example because validation rejects a value, memory is exactly as it was before the call and the exception is rethrown. A rejected value therefore cannot stay in a field and be kept by the next reload as an unsaved edit over the corrected file; fix the file and reload again. The same applies to a file that cannot be read or parsed: the reload throws `ConfigurationException` naming the file, and a module that calls `reload()` itself and catches only `IOException` should also catch `ConfigurationException` to report it. Memory-only map order is preserved when that disk map is unchanged; reload does not write it. This is not a concurrent map-insertion ordering policy.

After the module's language is rebuilt by `/ul reload`, and before its own reload hook, the framework rewrites the comment lines it identifies as its own in the new language, through the write gate over a fresh read of each file. No value, key or other comment line is written.

As of v6.3.0 no configuration of an older module copy is saved when a newer copy replaces it. The newer copy reads the files as they are; once it is active, one warning names the old copy's dropped file and keys. Unload releases its registry owners and writes nothing.

## Known limits

As of v6.3.0, [#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578) records special anchored containers, complex symlink paths, Unicode style-offset cost and direct-alias token-comment ownership. Alias comments can affect the source anchor and cause repeated writes. [#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580) records refusal of a valid block anchor with a comment before its first child. Protection preserves those refused file bytes; it does not make their values readable. [#545](https://github.com/UltiKits/UltiTools-Reborn/issues/545) remains the crash-safe multi-file persistence limit.
