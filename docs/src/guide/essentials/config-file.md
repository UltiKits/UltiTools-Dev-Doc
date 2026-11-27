# Configuration

7.0.0 has not been released. This guide targets UltiTools-API 7.0. For 6.x, see the [archived v6.4.0 configuration guide](/v6.4.0/guide/essentials/config-file.html); to move a module forward, see [Upgrading from 6.x to 7.0](/guide/advanced/upgrading-to-7).

## Create a YAML configuration file

Declare the keys, defaults and comments in a Java configuration class. UltiTools reads module configuration under `plugins/UltiTools/pluginConfig/<module>/`, where `<module>` is the `name` in the module's root `plugin.yml`. For example, `@ConfigEntity("config/config.yml")` with a constructor that accepts that path uses `plugins/UltiTools/pluginConfig/<module>/config/config.yml`. On first initialization, the framework generates a missing file from the declared defaults and comments; for an existing file it adds only missing settings when it can do so safely. You do not need a matching YAML resource in the JAR. If the JAR does ship one under `config/` (for example `src/main/resources/config/config.yml`), the framework copies it into the module's configuration directory before configuration entities are initialized, whenever that file does not exist yet. The entity then starts from the shipped file and adds only the settings missing from it, instead of generating the file from the Java defaults and comments.

## Operate configuration files

### Create a configuration file object

According to the key-value pair structure of your configuration file, create a class that inherits
the `AbstractConfigEntity` class.

<<< @/../examples/src/main/java/com/ultikits/docs/config/SomeConfig.java

This complete 7.0 example declares one YAML file. `@ConfigEntry` names the key and its comment, and the field initializer supplies the default. The class declares its own accessors and does not need Lombok.

```java
package com.example.mymodule.config;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;

@ConfigEntity("config/config.yml")
public class ExampleConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "features.chat", comment = "Enable chat features")
    private boolean chatEnabled = true;

    public ExampleConfig(String configFilePath) {
        super(configFilePath);
    }

    public boolean isChatEnabled() {
        return chatEnabled;
    }

    public void setChatEnabled(boolean chatEnabled) {
        this.chatEnabled = chatEnabled;
    }
}
```

::: warning Constructor requirements
Keep constructors cheap and side-effect-free: validation and save preparation may construct temporary instances.
:::

#### @ConfigEntity

`value` specifies a path relative to the module's configuration directory. For a single file, scan registration tries `public MyConfig(String configFilePath)` first. If that constructor is absent, it tries a public no-argument constructor; keep its `super("config/config.yml")` path consistent with the annotation. `SomeConfig` above uses a single-file path with no extension; prefer a `.yml` name such as `config/config.yml`.

A directory path must already be a directory when registration runs. A missing path is treated as a single file, not created as a directory. Only immediate `.yml` files are loaded, without recursion, each using the same class's `(String)` constructor. To have the directory on a fresh server, ship its files in the JAR under `config/`, for example `src/main/resources/config/warps/spawn.yml`: bundled files under `config/` are copied out before registration, so the directory exists when the entity registers:

```java
@ConfigEntity("config/warps")
public class WarpConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "enabled")
    private boolean enabled = true;

    public WarpConfig(String path) {
        super(path);
    }
}
```

```java
List<WarpConfig> warps = module.getConfigs(WarpConfig.class);
WarpConfig spawn = module.getConfig("config/warps/spawn.yml", WarpConfig.class);
```

Here `module` is your `UltiToolsPlugin` instance. `getConfig` returns `null` when no entity is registered at that path.

#### @ConfigEntry

`@ConfigEntry` binds a field to YAML. `path` and `comment` default to the empty string, and `previousComments` defaults to an empty array. With no `path`, the field name is used.

`path = "features.chat"` matches nested YAML or a flat `features.chat: false` entry. You can also mix forms, such as `a.b:` with a child `c: 1` for `a.b.c`. `@ConditionalOnConfig` and `isPresentInFile` use the same lookup. Initialization and writes do not create a second form of an existing setting. If two forms define one setting, even with equal values, load or reload is refused. Inside a bound map, a key such as `g.m` is one whole key, not a path.

After an existing file passes parsing and initialization validation, the framework lists up to ten undeclared key subtrees and reports how many more there are, if any. Inherited declarations count; a declared map, collection, array or converter-owned value owns its subtree. Normal reloads and saves do not repeat the warning. A module might read an undeclared key manually, so don't delete one just because of the warning. These lines are not translated and contain no values:

```text
Module 'MyModule', file 'config/config.yml', key 'obsolete': no @ConfigEntry declaration for this key/subtree; left unchanged
Module 'MyModule', file 'config/config.yml': 2 more keys have no @ConfigEntry declaration (not listed); left unchanged
```

::: info Configuration comment tokens as of v7.0.0
A comment such as `{config.lock.timeout}` is resolved through the module's `messages/` catalogue using the server fallback language.
:::

A literal `comment` is written when its key is inserted. A comment that is exactly one token after trimming is rendered as plain text under the [annotation text rules](/guide/essentials/messages#module-annotation-text), with fallback to the module's source language. If the key cannot be resolved, the token stays and the framework warns at most once per field per configuration load, for example `Module MyModule, file config/config.yml, path 'lock.timeout': missing comment catalogue key 'config.lock.timeout'`. Line breaks and control characters are sanitized before writing YAML comments.

Startup and `/ul reload` refresh only token comments that the framework recognizes as its own. The entire comment or its trailing lines must match a shipped rendering, the current rendering, the bare token or a rendering listed in `previousComments`. Other comments stay as written. A hand-written comment that happens to match is treated as framework-owned. Saves, operator writes and panel edits do not refresh comments.

As of v7.0.0, translations are no longer read from `lang/`. Move old comment keys to `messages/<locale>.yml`. If the shipped wording already on disk differs from the new wording, list the old text in `previousComments`:

```java
@ConfigEntry(path = "lock.timeout", comment = "{config.lock.timeout}",
        previousComments = {"Lock timeout in seconds"})
private int lockTimeout = 30;
```

Define the key in the module’s `src/main/resources/messages/en.yml`:

```yaml
config.lock.timeout: "Maximum time to wait for the lock"
```

Changing an override or the fallback language can leave behind an old comment that no longer matches a known rendering. The framework preserves it as operator text. To restore the generated comment, delete just the old comment attached to the setting, not the key, and do not leave a bare `#`. If no attached comment remains, the next successful startup or reload that can write the file inserts the current text. For custom field types, see [Config Converters](/guide/advanced/config-converters).

#### Numeric fields

Primitives and boxed numeric fields use the same conversion rules. Panel JSON integers within the long range use `Long`; integers beyond the long range are kept exactly as `BigInteger`. Fractional panel numbers use `Double`. Integral narrowing must be exact and within range; numeric text such as `'30'` can bind to an integer. A decimal binds to `float`/`Float` only when the parsed float's shortest printable decimal has the same numeric value: `0.03` and `1.50` pass, `0.100000001` does not. Invalid fields keep their declared defaults with a located warning. Use `double` when more decimal precision is required; float acceptance is not exact binary representation.

An `int`, `long`, `Integer` or `Long` field can also drive a task interval or command cooldown: see [Config-Bound Timing](/guide/advanced/scheduled-tasks#config-bound-timing) and [Config-bound cooldowns](/guide/essentials/cmd-executor#binding-the-cooldown-to-a-config-key). The configuration must be registered exactly once; directory entities cannot be bound. Avoid combining a bound field with [`@Range`](/guide/advanced/config-validation), because binding has its own range check.

#### Collections and null

Full inherited generic types drive lists, sets, queues, maps, arrays and enums. Invalid collection/map elements are skipped with a warning; a wrongly shaped whole field uses its initially declared default. Warnings identify the file, key, position and type and redact secret-shaped values. As of v6.3.2, skipped-value warnings render the raw value and reason on one log line; secret-shaped values remain redacted and configuration binding does not repair those values on disk. An unknown declared type refuses module load before any config file is read or created; register a converter rather than accepting raw maps into a custom class.

Explicit null whole fields and null map values still round-trip; primitive null is invalid. Typed collections (including `List<Object>`) and reference arrays (including `Object[]`) omit null elements on write with one located warning per field. A null element of a typed collection read from the file is likewise skipped with a located warning; plain data in a declared `Object` slot remains plain. UUIDs and enums use plain text, and registered Bukkit `ConfigurationSerializable` values use alias-tagged maps. A Bukkit value read into an `Object` slot stays a plain map. Unknown runtime Java objects refuse a save without touching the file.

#### Saved locations (`Location`) {#saved-locations}

As of v7.0.0, Paper 26.3 saves a `Location` with `world_key` in `namespace:path` form, not a world name. A 6.x value containing only `world` (a world name) is still readable; no bulk rewrite is needed. If both fields exist, `world_key` wins. When changing worlds by hand, copy `world_key` from a location already saved in the target world instead of guessing it from the name. If you keep `world`, update it to the same world's name. Changing only `world` has no effect.

An invalid key or a missing or unloaded world does not fall back to `world`. Paper logs `unknown world` and its serialization layer returns `null`; UltiTools treats this as a conversion failure (for example, reason `Alias <alias> did not produce org.bukkit.Location`), not a successfully read null value. Binding falls back to the declared default for an invalid whole field and skips invalid elements of typed collections or maps. Reload still applies the three-way comparison and validation described below; the bad value on disk is not repaired. A standalone Bukkit `World` field still uses a world name, not `world_key`.

#### @Getter and @Setter

`@Getter` and `@Setter` are Lombok annotations, which are used to automatically generate `getter` and `setter` methods.

### Get configuration file object

Your main class which extends `UltiToolsPlugin` has a `getConfig` method to get the configuration file object.

You need to get the instance of the plugin main class, and then call the `getConfig` method.

```java
SomeConfig someConfig = module.getConfig(SomeConfig.class);
```

Now you can use the `getter` and `setter` methods to operate the configuration file.

::: tip Set and Save
Nothing is saved when the server stops. Call `save()` when your code makes a change that should reach the file.
:::

Nothing writes configuration at server stop, module unload or module replacement. A module change that was never saved is named in one WARNING, listing the file and the keys but never values, and is dropped; `ConfigManager#saveAll()` writes nothing and is deprecated. An edit an operator makes to the file while the server runs is never touched by a stop. A file that could not be read or parsed at its last load is named once instead. Panel edits acknowledge only touched fields, so unrelated unsaved fields stay unsaved.

Initialization, reload and ConfigManager registry operations are server-thread confined while a server runs. Off-thread void operations warn and do nothing; registry getters, JSON readers/writers warn and throw `IllegalStateException`. Panel update/upload/reconnect callbacks queue their complete operation on the server thread and reply after it runs. Entity monitors serialize persistence, but your own asynchronous field mutation is not protected by those monitors. Schedule module mutations/reloads on the server thread.

`UltiToolsPlugin#getConfig(Class<T>)` returns the entity, not a mutable Bukkit YAML object. `isPresentInFile("entry.path")` checks the key in the last load, not the current field value; explicit null and undeclared keys count. It does not establish presence if the file could not be read or parsed. Change the declared field and use the entity’s `save()` or the module’s `saveConfig(String path, Class<T> type)` to persist it; both declare `throws IOException`.

```java
boolean something = someConfig.getSomething();
```

::: tip Who writes configuration
Configuration is the operator's to read and edit. Write to it only for a change the operator asked for, preferably with `saveOperatorChange` or `saveOperatorMapEntry` (see [Saving configuration files](#saving-configuration-files)).
For data your own plugin needs to persist, use [Data Storage](/guide/essentials/data-storage) instead.
:::

## Register configuration file

### Automatically register

Use `@UltiToolsModule` on the module class and put the `@ConfigEntity` class in a scanned package. The `config` flag defaults to `true`, including when `@EnableAutoRegister` is used directly. See [Auto Registration](/guide/advanced/auto-register).

### Manually register

With automatic config registration off, the framework takes the entities from `getAllConfigs()`. The config class still needs `@ConfigEntity`.

```java
@Override
public List<AbstractConfigEntity> getAllConfigs() {
    return List.of(new SomeConfig("some/path/to/config"));
}
```

Do not mix the two modes. When auto-registration is on, the framework still calls `getAllConfigs()` to check the override, not to register entities a second time. Redundant entries are not registered twice. An entry the override asks for but the scan did not find causes the module to be refused.

## Config Validation

UltiTools provides validation annotations to protect against invalid configuration values. See the [Config Validation](/guide/advanced/config-validation) guide for full details.

<<< @/../examples/src/main/java/com/ultikits/docs/config/MyConfig.java

Available validation annotations: `@Range`, `@NotEmpty`, `@Size`, `@Pattern` (from `com.ultikits.ultitools.annotations.config`).

A validation refusal from `validateProposedProperties` or `updateProperties` identifies the declared configuration key (for example `allowed-commands`, not Java field `allowedCommands`) and says that the edit was not applied. The file and running values are unchanged; correct the proposed values and retry the edit, without restarting. Load-time and reload-time validation retain their own diagnostics.

## Saving configuration files

### Write contract

The framework never overwrites configuration an operator wrote, unless the operator asked for that change. What code may write depends on who owns the file:

| File | Code may write |
|---|---|
| A configuration file the module ships (`config.yml`, `spawn.yml`) | the file, the first time, when it does not exist; a declared key the file lacks and the framework's own comments, inserted only; exactly the setting an operator asked to change through a command, the panel or a GUI |
| A file the operator creates (a kit, a menu) | the file, on the operator's create action; on an edit, only the edited part |

Nothing else is written: no save at stop, unload or replacement, no repair of an invalid value, no layout normalization and no cleanup of map keys that 6.2 split at their dots.

Every write goes through one write gate. A write declares the keys it owns; after rendering, every byte outside them must equal the file as read, and the file must still hold the bytes it was read from. Otherwise nothing is written: one WARNING names the file, the keys and the reason, never a value, and the values in memory are used.

A refused explicit write throws `ConfigWriteRefusedException` and leaves the file unchanged. An I/O failure during publication throws `IOException`. If an in-place write fails, the framework tries to restore the previous file. If restoration also fails, it reports the failure, retains the backup and blocks further writes until a successful reload. See [Atomic replacement](#atomic-replacement).

::: tip 7.0 message catalogues
As of v7.0.0, texts in the new `messages/<locale>.yml` catalogues are not customised by copying a file. Operators put only the changed keys into an override file; see [Operator overrides](/guide/essentials/messages#operator-overrides).
:::

### `save()`

`saveConfig(path, type)` saves only a configuration entity registered for that path in the current module. As of v7.0.0, if the path has never been registered, `saveConfig` throws `IllegalStateException` naming the module and path, even if the file exists on disk. It does not create, register or write any file. If the registered entity is not an instance of the requested type, `saveConfig` throws `ClassCastException` naming the module, path, requested type and registered entity type. Register the entity before saving, or call `save()` directly on the registered entity you already hold. If your 6.x code caught `NullPointerException` for a missing registration, register the entity first, or check that `getConfig(path, type)` returns non-null before saving. Do not catch `IllegalStateException` to test for a registration: `saveConfig` throws the same type when it is called off the server thread.

`save()` writes only the settings the module changed since the last load or save, and only where the file still holds the value it was read with. A setting declared as a `Map` is written entry by entry; a list, or a Bukkit value such as a `Location` or `Vector`, is written whole or not at all. A save never inserts a key the file lacks, never rewrites a comment and never removes a map entry the module did not remove.

A value the operator edited on disk, a key the operator deleted and a value the framework could not use (`interval: 3O0`) are therefore never written over. The module's change stays in memory and one WARNING names the key. The comparison uses the text last read: after an operator edits a setting on disk without `/ul reload`, even one that keeps its value such as `64` to `64.0`, the module's next change of that setting is not written until a reload reads the file again. A save with nothing to write leaves the bytes and the modification time unchanged.

### Operator commands

Use `saveOperatorChange` for a declared setting the operator asked to change, and `saveOperatorMapEntry` for one map entry. This example assumes `spawn.location` is declared as one `Location` field, not as separate child fields:

```java
// /setspawn: write the declared Location setting as one value
config.setSpawn(player.getLocation());
config.saveOperatorChange("spawn.location");

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

### Presence conditions

A map-entry write can also depend on whether the entry is already in the file. Pass an `EntryPresence` as the first argument of `saveOperatorMapEntry`. Use `MUST_BE_ABSENT` for a command that creates an entry, so it never replaces one the operator added by hand since the last reload. Use `MUST_BE_PRESENT` for a command that changes an existing entry, so it never writes back one the operator deleted. The module does not need to read the file itself:

```java
// /autoreply add <name>: create the rule only if the file does not hold one of that name
config.getRules().put(name, rule);
try {
    config.saveOperatorMapEntry(EntryPresence.MUST_BE_ABSENT, "autoreply.rules", name);
} catch (ConfigEntryPresenceException exists) {
    config.getRules().remove(name);
    sender.sendMessage("A rule named " + name + " is already in the file; run /ul reload to see it.");
} catch (ConfigWriteRefusedException refused) {
    config.getRules().remove(name);
    sender.sendMessage("Not saved: " + refused.getReason());
}
```

The condition is checked on the same read of the file that the write gate verifies the write against. An edit saved after that read makes the gate refuse the write, because the file changed. An entry is present when its whole key path exists where the framework reads the setting: its nested keys, or the flat dotted form, followed by the map keys, each one whole key. An entry holding `null` (`name: ~`) is present. An entry under a missing, `null`, empty (`{}`) or non-map key is absent, and so is every entry of a missing or comment-only file.

When the condition does not hold, nothing is written and the call throws `com.ultikits.ultitools.config.ConfigEntryPresenceException`. It is a `ConfigWriteRefusedException`: `getRequired()` names the condition that failed, and `getReason()` names the entry's key path. The framework logs nothing above FINE for it, because your command reports it. A `null` condition throws `IllegalArgumentException`. When called without `EntryPresence`, `saveOperatorMapEntry` does not require the entry to be present or absent.

### Refused writes

A write is refused when the file cannot be read or parsed, uses YAML anchors, aliases or merge keys, changed since it was read, or has a layout the renderer cannot write back byte for byte. A layout refusal names the line to fix, for example `the file's layout outside the keys this write owns would change (line 16)`.

A runtime failure of the YAML library while a write is applied, rendered or checked is a refusal too. Writing a map into an entry that holds `null` with an inline comment (`foo: ~  # placeholder`) is one such layout. The reason names the keys, the step that failed and the failure's class, for example `the file cannot be written at autoreply.rules.foo: rendering the document failed (EmitterException)`.

Layouts that refuse every write to the file include a line of only spaces, a trailing space after a value, an inline comment aligned with several spaces, more than one space after a colon, spaces inside flow brackets (`[ a ]`), a `---` or `...` marker, a comment indented deeper than the key below it, two indentation widths in one file and mixed line endings. None of the files the framework and its modules ship has such a layout. The operator fixes the named line, or runs `/ul reload` after "the file changed since it was read", and repeats the change.

When appending missing keys, the framework can keep an unchanged block scalar (`|` or `>`) with its spelling, chomping indicator, inline comment and trailing blank lines intact. If it cannot prove the write preserves the original text, it refuses; add the key by hand in that case.

A 0-byte file, a file of blank lines and a file of comments at the start of their lines count as empty: start-up inserts the declared keys. A file of spaces, a comment-only file with an indented comment and a file holding only a byte-order mark are refused as layouts.

An insert directly after a key left with no value (`c:` with nothing after the colon) is also refused, at every start, with `a key this write owns shares line N with a key it does not own` ([#628](https://github.com/UltiKits/UltiTools-Reborn/issues/628), open). To leave a text setting blank, write `key: ''`; that shape is kept and does not refuse.

### Layouts the reader cannot read

If a file is unreadable, is not valid UTF-8, or cannot be parsed, startup uses the declared defaults if they pass validation and does not overwrite the file. Reload refuses the update and keeps the running values. The startup SEVERE message is `Cannot load <file>: <cause>; file will not be overwritten`. On reload the failure reason is `Cannot reload <file>: <cause>; the file and the running values are unchanged`. The cause is safe information such as the parse line and column or the exception class, not a source snippet. Correct the file and reload it successfully before trying to write it again.

### Deleted keys, emptied sections and blank settings

Deleting a key is how an operator resets a setting: the next start inserts the declared key the file lacks, with its default and comment. To leave a text setting blank, an operator writes an empty string (`key: ''`); for a text setting an empty string is read as blank and is never rewritten by a start, a reload or a save of another setting. A number, true/false or other non-text setting has no blank value: `''` there is reported in one WARNING, the declared default runs in memory, and the file keeps `''`. If your module documents how to reset or clear a setting, say exactly that.

A key whose section the operator emptied is put back too ([#620](https://github.com/UltiKits/UltiTools-Reborn/issues/620)). When the deleted key was the last one of its section, the section key is left alone with nothing after the colon (`messages:`), which reads as no value at all; deleting every child is most likely accidental, so the insert expands that line instead of being refused at every start. That one line is the only line outside the inserted keys the write may touch: it keeps the key as written, the comment text and its line ending, and only its whitespace may be normalized (a space before the colon, the spaces before the comment, trailing spaces), so `messages :   # reset  ` comes back as `messages: # reset`. The section's value becomes exactly the inserted keys. A child the operator commented out under the line stays where it is, below the restored keys, when its comment lines follow the section line directly as one run at the file's indentation; a blank line before them, two runs split by a blank line, or a comment deeper than the file's indentation is refused instead, at every start, with the file unchanged. The same holds for `saveOperatorChange`, `saveOperatorMapEntry` and a panel edit, so a command that adds the first rule to an emptied `rules:` is written, not refused.

A section written with an explicit empty value, `messages: {}`, `messages: ~` or `messages: null`, is the operator's own value and is never changed. An insert below it is refused with `the section messages (line 3) is written as an explicit empty value, which the framework does not change; to have keys added below it, delete that value so the line ends after the colon, or add the keys by hand` ([#610](https://github.com/UltiKits/UltiTools-Reborn/issues/610)); `saveOperatorMapEntry` throws `ConfigWriteRefusedException` with that reason.

A missing setting is inserted below the section the file already holds it in, never into a second form of that section ([#614](https://github.com/UltiKits/UltiTools-Reborn/issues/614)). With `a.b:` holding `c: 3` and a declared `a.b.d`, the start writes `d:` under `a.b:`, not a nested `a:` / `b:` copy that Bukkit's `YamlConfiguration` would read as replacing the flat section. When another setting of the section is written with the rest of its path as one dotted key (`a:` / `  b.c: 3`), the missing setting takes the same form beside it (`  b.d: 2`); siblings written in different splits leave it undecided, and the insert is refused. When the file holds that section in several forms, the setting goes below the one form holding another declared setting of the section; when none or more than one does, the insert is refused, naming the file and the setting, and the declared default runs in memory.

### Operator files a module manages

`com.ultikits.ultitools.config.OperatorFiles` writes a YAML file a module manages for the operator, such as a kit file, on an explicit operator edit. It writes only the named keys, through the same gate, and only while the file still holds the bytes it was read with:

```java
OperatorFiles.Snapshot snapshot = OperatorFiles.read(kitFile);
Map<List<String>, Object> edit = new LinkedHashMap<>();
edit.put(Arrays.asList(kitName, "items"), serializedItems); // plain data only
OperatorFiles.WriteResult result = OperatorFiles.write(snapshot, edit);
```

The result is `WRITTEN`, `UNCHANGED`, `FILE_CHANGED` (the file changed since `read`) or `REFUSED` (a layout or anchors, with the gate's WARNING). Each key in the list is one whole key, so a name containing `.` stays one key. `OperatorFiles` never creates, deletes or renames a file and is not for `@ConfigEntity` files.

### Opt-in crash-safe YAML writes

`com.ultikits.ultitools.config.CrashSafeYamlFiles` provides strict single-file publication for a module's explicit operator create or edit action. It is opt-in: existing modules, `OperatorFiles.write`, `@ConfigEntity` saves and panel writes do not switch to it. It is not for automatic saves, credentials, framework state, arbitrary bytes, file repair, deletion or renaming, and it is not a multi-file transaction.

| Method | Use and result |
|---|---|
| `write(OperatorFiles.Snapshot, Map<List<String>, Object>)` | Edit only the named complete key paths; returns `WRITTEN`, `UNCHANGED`, `FILE_CHANGED` or `REFUSED`. A missing target is `FILE_CHANGED`, not recreated. |
| `create(File, Map<String, Object>)` | Publish a complete plain-data root map only when no entry exists; returns `WRITTEN`, `FILE_CHANGED` or `REFUSED`, never `UNCHANGED`. An existing file, directory or dangling symlink is `FILE_CHANGED`, even with identical content. The parent directory must already exist. |

Both methods declare `throws IOException` and copy and validate their arguments before I/O. Null arguments or keys, invalid write paths and non-plain values throw `IllegalArgumentException`; serialize Bukkit objects first. Keys containing dots are whole keys, null values are allowed, and an empty root map is valid for creation. Neither method changes your live objects.

```java
OperatorFiles.Snapshot snapshot = OperatorFiles.read(kitFile);
OperatorFiles.WriteResult edited = CrashSafeYamlFiles.write(snapshot,
        Collections.singletonMap(Arrays.asList(kitName, "items"), serializedItems));
OperatorFiles.WriteResult created = CrashSafeYamlFiles.create(newKitFile,
        Collections.singletonMap("items", serializedItems));
```

Update live state only after `WRITTEN` (or `UNCHANGED` for an edit). `FILE_CHANGED` means the snapshot no longer authorizes the edit, or a creation target exists; `REFUSED` means the gate cannot safely perform the operation. An edit reuses the plain-data, fingerprint and parse/render/reparse checks: every unowned byte, including comments, unknown keys, BOM and line endings, must remain identical. Malformed, anchored or unpreservable YAML is refused, never repaired. Empty edits and semantic no-ops return `UNCHANGED` without staging or metadata changes.

#### Filesystem and metadata requirements

The `File` and snapshot entry points use the JVM's default filesystem. Actual publication requires ordinary files on a local default POSIX filesystem with native atomic rename/link semantics and working POSIX attributes. Normal Windows filesystems are unsupported. An existing final symlink or nonregular edit target is refused, not followed; the real parent is resolved before appending the final basename. Supply trusted module paths: this API is not a path sandbox.

Existing files retain the nine POSIX permission bits, owner and group, applied and verified on the staged inode before commit; failure aborts publication. A target without a write bit, or not writable by the process, is refused. Staging is created exclusively at mode `0600` before content is written, narrowed to `0000` before a required owner/group transition, then given its verified final mode. New files keep the process-created owner/group and mode `0600`. Non-POSIX filesystems or a Java-exposed ACL view on the parent, target or stage are refused.

The helper does not copy ACLs. Absence of a Java ACL view does not prove the absence of Linux ACLs, default ACLs, security labels or xattrs. Do not adopt it where those, special mode bits, alternate streams, inode identity, hard-link relationships, creation times or arbitrary flags must be preserved. Replacement creates a new inode, so existing hard-link aliases keep the old content; not every incompatible metadata layout can be detected.

#### Publication and interruption

A same-directory `<name>.ultitools-stage-<32 lower-case hex>.tmp` receives the complete UTF-8 content and promised metadata, then `FileChannel.force(true)` and a successful close, before publication. Existing-file edits commit with `ATOMIC_MOVE`; creation uses exclusive native POSIX hard-link publication of the completed stage, not an atomic move treated as create-if-absent. Unsupported atomic replacement or link publication throws `IOException` without copy, ordinary-move, in-place truncation or journal fallback.

With a functioning OS and filesystem, a process crash leaves old/absent or complete-new final content. Directory forcing after publication is best effort and warns on failure; `WRITTEN` means complete publication, not universal power-loss durability. OS crashes, sudden power loss, remote storage, device/controller failure and filesystem recovery are outside this guarantee. Same-JVM gate writes serialize and recheck bytes, kind and promised metadata before commit, but there is no cross-process lock: an external edit, rename or chmod can race the final check. Do not share these files with uncoordinated writers.

#### Retained temporary files

There is no startup scan, journal, replay, automatic promotion or rollback. Cleanup removes only this invocation's exact regular-file temp while its non-null file key still proves its identity. Failed or uncertain cleanup leaves a warning naming the temp; later calls do not reuse or delete it. A pre-commit cleanup failure does not hide the original error, and a post-commit one still returns `WRITTEN`; creation can leave a second hard link to the complete new content. Strict reads do not run the legacy temp/backup maintenance.

After interruption, stop the server and competing writers, then inspect the target and named leftovers. Never assume a temp is newer or authoritative, or promote it automatically. Remove only a temp recognized as no longer needed; otherwise keep it and use an independently trusted backup or the module's explicit recreate action. Retained temps may contain new data under the final POSIX mode: protect them like the YAML file itself.

### Atomic replacement

Ordinary configuration writes and `OperatorFiles.write` can fall back to an in-place write with a backup; the opt-in helper above never uses that fallback.

Comments on individual list items are kept only while the list keeps its length — the same as Bukkit, which keeps none.

Writes first force a same-directory temporary, then replace atomically. Only unsupported atomic move, EBUSY/cross-device or permitted temporary-creation refusal allows backed in-place fallback. As of v6.3.0 the backup is named `<file>.ultitools-backup-<16 hex>` and is forced before the target is opened; a backup this server run wrote for the same file, still holding what it wrote, is refreshed from the current target through a forced temporary and atomic replacement. An operator's own `<file>.bak` is never read, written or deleted. A backup refusal leaves target and previous backup untouched. As of v6.3.0, if the in-place write then fails after the target was opened (a write that stops part-way, or a failed force), the framework first writes the target's previous bytes back from the backup and removes the backup. Only then does the `IOException` reach the caller, so the file holds what it held before the write. A panel batch puts back every file it opened the same way and fails.

If putting the file back fails too, one SEVERE names the file and the backup, never content, and the backup is kept. The configuration then treats the file as changed since it was read until a reload: an operator change or a panel edit is refused with "the file changed since it was read", and `save()` writes nothing. The operator compares the file with the backup, copies the backup over it if needed, and reloads. A backup that served a successful in-place write is removed by the next successful strict load of the file, and only while its bytes still match what was written.

An unreadable, malformed or non-UTF-8 file is protected on every entity write route until a successful load clears that protection.

Registration batches buffer initialization writes until every selected entity binds and validates; refused batches change no files. Accepted files then persist independently, through the write gate and only while each file still holds the bytes read at registration. Multi-file panel updates instead validate and stage all touched files, then commit and acknowledge together, with in-process rollback on ordinary refusal. Persistent storage failure can prevent restoration; crashes between moves are not a crash-safe multi-file transaction.

A panel update validates and stages the touched files before committing them together. On ordinary refusal it restores any files it wrote, does not commit the live changes, and reports failure. A storage failure can also prevent restoration; this is not a crash-safe multi-file transaction.

Panel map leaf edits use actual whole file keys and the full declared field converter. A unique changed leaf persists; ambiguous or missing changed paths refuse the whole payload by name. Unchanged displayed leaves are not edits. Untargeted pending memory values and independently edited disk siblings are preserved.

A panel edit writes only the keys it names, through the write gate: it replaces an operator-edited value at exactly those keys, which is the operator's consent, and every other byte of the file stays. A file the gate refuses gets an error reply naming the reason. An edit of one field of a Bukkit value such as a `Location` writes that value as the file holds it with the one field changed, so the other fields keep the operator's text (`y: 64` stays), and only while the file still holds the value it was read with; otherwise the reply asks for a reload first.

## Configuration file reload

```java
UltiToolsPlugin.getConfigManager().reloadConfigs(module);
```

This call reloads the files only. Configuration bindings, module message overrides, the comment refresh and `onReload()` run only through `/ul reload`.

Reload performs a three-way comparison of the last effective baseline, live fields and incoming file. Memory-only edits survive and stay dirty; disk-only edits are adopted; conflicts take disk with a located, redacted warning. Maps merge recursively by whole keys and lists/scalars are atomic. A whole field the operator deleted from the file binds its declared default, with one warning naming the key, unless the module changed it since the last load or save; the file is not written either way. A failed reload of one configuration entity is all-or-nothing: if it fails, for example because validation rejects a value, memory is exactly as it was before the call and the exception is rethrown. A rejected value therefore cannot stay in a field and be kept by the next reload as an unsaved edit over the corrected file; fix the file and reload again. The same applies to a file that cannot be read or parsed: the reload throws `ConfigurationException` naming the file, and a module that calls `reload()` itself and catches only `IOException` should also catch `ConfigurationException` to report it. Memory-only map order is preserved when that disk map is unchanged; reload does not write it. This is not a concurrent map-insertion ordering policy.

A module reload is not a transaction across files. The first failing file stops the remaining steps for that module. Earlier files keep their reloaded values; the failing file keeps its running values. The module override reload, final token-comment refresh and `onReload()` hook are not reached. A full reload still processes other modules.

As of v7.0.0, a full `/ul reload` first rereads framework config, the fallback language and framework message overrides, then reloads modules. `/ul reload <module>` does not reread those global settings. After the module’s config files reload, the framework applies config bindings, rereads that module’s message overrides, refreshes framework-owned token comments in the current fallback language, and calls `onReload()`. Replacing a JAR requires a restart; reload does not re-register commands. See [Reloading messages](/guide/essentials/messages#reloading).

No configuration of an older module copy is saved when a newer copy replaces it. The newer copy reads the files as they are; once it is active, one warning names the old copy's dropped file and keys. Unload releases its registry owners and writes nothing.

On a module reload failure, the shipped console messages are `Module '<module>' failed to reload: <error>` in English and `模块 '<module>' 重载失败：<error>` in Chinese. The underlying reason can still be in English.

## Known limits

Neither ordinary config writes nor the opt-in crash-safe helper provides a crash-safe multi-file transaction. Do not edit the same files through uncoordinated writers at the same time. For historical YAML parser limitations on 6.x, see the archived guide linked at the top.
