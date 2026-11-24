# Messages and Languages

As of v7.0.0, the framework has a text engine in the package `com.ultikits.ultitools.text`. Messages are Adventure components written in MiniMessage. Each player sees them in their own Minecraft client language, and the texts come from YAML language files with dotted keys. Operators change texts in override files, and a fallback language covers players whose language has no translation and the console.

::: warning Unreleased v7.0.0 behaviour
This page describes the unreleased 7.0.0 framework. A 6.x framework has only the `i18n(...)` path described in [Internationalization](/guide/essentials/i18n).
:::

## Language files

A module ships one UTF-8 file per language under `messages/` at the root of its JAR, that is `src/main/resources/messages/<locale>.yml` in a Maven project:

```text
src/main/resources/messages/en.yml
src/main/resources/messages/zh.yml
```

Each value is a MiniMessage string. A key is a lowercase path of dot-separated segments made of `a-z`, `0-9`, `_` and `-`. Nested mappings and dotted keys are equivalent, so the two files below define the same key `home.set.success`:

```yaml
home:
  set:
    success: "<green>Home <home> set.</green>"
```

```yaml
home.set.success: "<green>Home <home> set.</green>"
```

The rules the loader applies:

- Only `.yml` files are read. A `.yaml` file is skipped with a warning. A file name consists of letters, digits, `_` or `-` followed by `.yml`; subdirectories of `messages/` are not catalogues.
- Files must be UTF-8; a UTF-8 BOM is accepted.
- Scalar keys and values are read as literal strings. Unquoted `yes`, `no`, `Yes`, `true`, `123`, `null` and `~` stay text and are not converted to YAML booleans, numbers or nulls.
- Lists and non-scalar keys are rejected with warnings. Nested mappings only group dotted paths.
- `§` and `&` colour codes are not interpreted. Use MiniMessage tags such as `<green>`.
- Use language-only files such as `zh.yml`. When you add a regional variant such as `zh_CN.yml`, ship the base `zh.yml` as well: a regional-only language warns on load and is not selected for other regions or for language-only requests.

## Source language

The source language is the language a module's own texts are written in. Declare it in the module's `plugin.yml`:

```yaml
source-language: en
```

If the key is omitted, the source language is `en`. An invalid value is logged as `Module '<name>' has invalid source-language '<value>'; using en`. The source language is the last catalogue the lookup tries before it shows the key itself (see [Language selection](#language-selection)), so ship a complete file for it.

## Using `Messages`

Each module gets its own `Messages` service. Inject it like any other bean:

```java
@Service
public class HomeNotices {
    @Autowired
    private Messages messages;

    public void homeSet(Player player, String homeName) {
        messages.send(player, messages.key("home.set.success"), Arg.string("home", homeName));
    }
}
```

The injected instance is bound to the module's namespace. The namespace is the module's `plugin.yml` name in lower case, with every character outside `a-z`, `0-9`, `_`, `.` and `-` replaced by `_` (`MessageKey.namespaceFor`). The framework's own namespace is `ultitools`.

- `messages.key(path)` returns the `MessageKey` `<namespace>:<path>`. `MessageKey.of(namespace, path)` and `MessageKey.parse("namespace:path")` build keys for any namespace, and every namespace can be rendered.
- `Text.of(key, args...)` is a deferred message: a key and its arguments, rendered only when the viewer's locale is known. Use it for names, titles, labels and lore that are stored before delivery. `Text.plain(string)` and `Text.literal(component)` are fixed text, identical for all locales.
- `send(audience, text)` and `send(audience, key, args...)` send chat text. `sendActionBar(audience, text)` sends action-bar text.
- `render(text, viewer)` and `render(text, locale)` return the `Component` without sending it. Both have a `(key, viewer or locale, args...)` shorthand.
- `isDefined(key, locale)` reports whether the exact locale or its language defines the key, without fallback.

`Messages` is thread-safe and can be called from any thread. A missing catalogue or key never throws.

### Per-recipient delivery

`send`, `sendActionBar` and `forEachRecipient(audience, text, action)` expand a forwarding audience, such as the server audience or a group of players, and render the text once per recipient in that recipient's language. The action is never called for the forwarding audience itself. A player who joins during the call may be skipped, and one who quits during the call may still be passed to the action, where sending does nothing.

### Shared objects

An object every player sees, such as an entity name, a text display or a shared boss bar, cannot be rendered per recipient. Use `messages.shared(text)` for its text:

```java
display.text(messages.shared(Text.of(messages.key("hologram.welcome"))));
```

With `language: auto`, a translated text becomes a translatable component that Paper renders per client; its fallback is the text rendered in the fallback language. With a concrete `language`, the text is rendered on the server in the forced language. Literal text stays literal.

## Arguments

A translation refers to arguments by name, for example `"Welcome, <player>!"`. Positional arguments are not supported. Argument names match `[a-z0-9_-]+`, must be unique within one `Text`, and take precedence over a built-in MiniMessage tag of the same name.

| Factory | Value | Formatting written in the translation |
| --- | --- | --- |
| `Arg.string(name, value)` | `String` | none; shown literally |
| `Arg.number(name, value)` | immutable `Number` such as `Integer`, `Long`, `Double`, `BigDecimal` | `<n>` default number format; `<n:'#,##0.00'>` a `DecimalFormat` pattern; `<n:'de-DE':'#,##0.00'>` an explicit locale; `<n:choice:'…'>` a `ChoiceFormat` pattern |
| `Arg.time(name, value)` | `Instant`, `ZonedDateTime`, `OffsetDateTime`, `LocalDateTime`, `LocalDate`, `LocalTime` | `<t>` the locale's medium style; `<t:'d MMMM yyyy'>` a `DateTimeFormatter` pattern |
| `Arg.text(name, text)` | `Text` | none; rendered in the enclosing message's locale |
| `Arg.component(name, component)` | `ComponentLike` | none; shorthand for `Arg.text(name, Text.literal(component))` |

A choice pattern selects text by the number, for example `<n:choice:'0#no items|1#one item|1<<n> items'>`; the selected text is parsed as MiniMessage with the same arguments, so `<n>` inside it prints the formatted number.

Formatting uses the requested locale, even when the message text came from a fallback catalogue. An `Instant` is shown in the server's default time zone; zoned and offset values are shown in their own zone or offset. Quote a pattern that contains `:`, `<`, `>` or a quote. A format the engine cannot apply never makes rendering throw: the value is shown in its default format, and one warning is logged per key, locale and argument name. There is no boolean choice and no plural category in 7.0.

```java
messages.send(player, messages.key("shop.bought"),
        Arg.number("count", 3),
        Arg.time("when", Instant.now()));
```

```yaml
shop:
  bought: "Bought <count:'#,##0'> items at <when>."
```

### Text from players and operators

Text that a player or operator typed, such as a home name, a chat line or a sign, goes in as an argument, usually `Arg.string`. Its MiniMessage tags are never interpreted, so `<red>` in a home name is shown as those five characters. Do not join such text into a MiniMessage template. Tags are interpreted only in catalogue values; `Text.plain` and `Arg.string` show their characters as they are.

## Language selection

Two keys in `plugins/UltiTools/config.yml` control the language. New installations ship both as `auto`:

```yaml
language: "auto"
fallback-language: "auto"
```

`language` decides what players see:

- `auto` follows each player's current client locale. The player locale is read on every delivery and never cached, so a client language change applies to the next message.
- A concrete locale such as `en` or `zh` forces that language for all players. A 6.x custom name such as `zh-myserver` forces its official prefix language (`zh`); a safe name with no matching prefix uses `en`.

`fallback-language` is the console language and the language used when a player's language has no translation. Console, command blocks and other non-player audiences always use it. It is chosen in this order:

1. A concrete `fallback-language`, such as `en` or `zh`, always wins and skips time-zone detection.
2. If `fallback-language` is `auto`, blank or missing, it inherits a concrete `language`, including the official prefix of a custom name. `language: en` with `fallback-language: auto` therefore uses English for players and console, even on a host in China.
3. Only when `language` is also `auto`, blank or missing does the time-zone rule apply. The system time-zone IDs `Asia/Shanghai`, `Asia/Urumqi`, `Asia/Hong_Kong`, `Asia/Macau` and the aliases `PRC`, `Asia/Chongqing`, `Asia/Chungking`, `Asia/Harbin`, `Asia/Kashgar`, `Hongkong`, `Asia/Macao` choose `zh`; every other ID chooses `en`. The UTC offset is irrelevant: `Asia/Singapore` and `Etc/GMT-8` choose `en`.

The fallback is resolved at startup and on a successful full `/ul reload`, which logs the selected language and the reason, for example `Fallback language: <language> (system time zone <zone>; set fallback-language in config.yml to override)`. An invalid value is logged as `Invalid language locale: <value>` or `Invalid fallback-language locale: <value>`.

Cloud hosts and containers commonly use UTC, so a new installation there uses English, unlike the Chinese default that 6.x shipped. Chinese clients still see Chinese wherever the catalogue has it. To choose Chinese, set `fallback-language: zh` and run a full `/ul reload`.

Existing configuration files are never rewritten. An existing concrete `language: zh` or `en` without a fallback key keeps that language as its fallback. A configuration without a `language` key is treated as `auto`, not as the former 6.x default `zh`, and the key is not written back.

### Lookup order

For each message the engine tries, in order: the requested locale, the fallback locale, the module's source language, and finally the namespaced key itself. Each candidate is tried exactly and then by its language only, so `zh_CN` also tries `zh`. A missing key logs one warning per key and requested locale.

## Operator overrides

Operators do not edit the module JAR. They put only the keys they want to change into an override file with the same name as the shipped one:

| Texts of | Override file |
| --- | --- |
| a module | `plugins/UltiTools/pluginConfig/<module>/messages/<locale>.yml` |
| the framework | `plugins/UltiTools/messages/<locale>.yml` |

An override file with a new locale name adds a language. Deleting an override restores the shipped text. Override files follow the same rules as shipped files (`.yml` only, UTF-8, dotted keys, MiniMessage). The framework reads these files but never writes them.

Next to them, the framework keeps read-only reference copies of the shipped files in `messages/reference/`. They start with this header and are rewritten from the shipped bytes; editing them has no effect:

```text
# Generated by UltiTools on every startup; edits here have no effect.
# Copy keys to the same-named override file in the parent directory instead.
```

## Reloading

| Change | Takes effect on |
| --- | --- |
| `language` or `fallback-language` in `config.yml` | a successful full `/ul reload`, or a restart |
| a module override file | reloading the module (`/ul reload <module>`), or a restart |
| a framework override file | a restart only |
| a player's client language | the next message |

::: warning Framework overrides need a restart
In 7.0, framework catalogue overrides are read at startup only and are not reloaded by `/ul reload`. A later change adds the reload hook.
:::

## The legacy `i18n(...)` path

The 6.x language system still exists in 7.0 while its callers migrate. `i18n(...)`, `getLanguageCode()`, `getConfiguredLanguage()` and the files in `lang/` work as described in [Internationalization](/guide/essentials/i18n), and the legacy path still loads custom language files. Removing it is a separate, later change.

When `language` is `auto`, blank or missing, `getConfiguredLanguage()` returns the base language of the resolved fallback, and the legacy path loads that language. A concrete name, including a custom one, is returned unchanged.

The new catalogues do not read 6.x files. 6.x language files, sentence keys, custom language names and operator edits are not converted. Re-create the needed texts as dotted keys with MiniMessage values. For migrating a module, see [Module Versioning](/guide/advanced/module-versioning#modules-6x-to-7).

## Known limitations

- Framework catalogue overrides reload only on restart (see [Reloading](#reloading)).
- The time-zone rule uses the zone ID, not the UTC offset, and is resolved only at startup and on a full `/ul reload`.
- 6.x language files and custom names are not converted to the new catalogues.
- A configuration without a `language` key is treated as `auto`, not as the 6.x default `zh`.
