# Panel Integration

::: info As of v6.3.0
The capabilities and APIs below are available in UltiTools-API v6.3.0. Sections identify changes to behaviour that also existed in earlier versions.
:::

UltiTools connects to the UltiPanel remote-management platform over a WebSocket. As of v6.3.0, five
things about that connection change: every panel-facing capability becomes an operator-visible
switch; remote command filtering becomes an operator-editable blocklist; the remote file API is
confined to an explicit set of editable roots with an unconditional credential exclusion; the live
log stream can no longer be started, stopped, paused or resumed from the panel, its batch interval
and `debug` level now take effect, and its level filter no longer suppresses error reports raised
from log records; and a module can now observe or answer panel messages without the framework
growing a second dispatch mechanism beside the existing one.

As of v6.3.1 the connection speaks UltiCloud protocol 2.0.0; [UltiCloud protocol 2.0.0](#ulticloud-protocol-2-0-0)
below lists what that changes. Modules can also keep the arguments of secret-carrying commands out of
everything sent to the cloud ([Sensitive commands](#sensitive-commands)) and answer the panel's module requests
([Owning a request/response type](#owning-a-request-response-type-panelresponderregistry)).

## UltiCloud protocol 2.0.0

As of v6.3.1 the server is linked with a device code (see [Cloud Login](/guide/advanced/cloud-login)) and the
framework speaks UltiCloud protocol 2.0.0 to `wss://api.ultikits.com/v1/agent`. The capability switches, the
command blocklist, the editable roots with their credential exclusion and the remote action log described on
this page keep working as described. The 6.3.0 wire messages that some sections below name, such as
`command_result`, `log_stream`, `update_config` and `set_all`, no longer exist; where a section describes such
a message, the 6.3.1 behaviour is the one stated here.

The server declares to UltiCloud, in its handshake, only the capabilities its switches allow, and checks the
switch again for every request. A request whose switch is off is refused with `capability_not_accepted`, naming
the configuration key.

| Switch | What the panel gets or may do in 6.3.1 |
|---|---|
| `monitoring` | `status` and the player, plugin and world snapshots; a `snapshot.request` pushes the requested snapshots, then answers |
| `logs` | `log.lines` batches, sent once a second or when a batch is full, within the rate UltiCloud sets for the connection; lines over that rate are dropped on the server |
| `player-events` | Join and leave events, kept in the reliable outbox until UltiCloud acknowledges them, and `player.command` events with the command name only |
| `ultipanel.logging.error-reporting.enabled` | `error.report` |
| `commands` | `command.execute`: acknowledged before it runs, then answered with the output lines the command printed before its dispatch returned; later lines go to the server console and the log stream |
| `player-actions` | `player.action`: kick, change game mode, teleport to a player or to coordinates (new in v6.3.1, off by default) |
| `file-read` | `files.list` and `files.read`, and reading the configuration files of loaded modules (`config.tree`, `config.entries`) |
| `file-write` | `files.write` and `config.update` |
| `file-delete` | `files.delete` |
| `server-properties` | `properties.get` and `properties.update` |
| `power-actions` | `server.power`: stop or restart (new in v6.3.1, off by default) |

`files.read` returns a `version`, the SHA-256 of the file's raw bytes. `files.write` and `config.update` must
send the `version` they read as `baseVersion` and are refused with `file_changed`, writing nothing, when the
file changed in between. `files.write` overwrites an existing file, `files.delete` removes a file and never a
directory, and a listing longer than 2000 entries is cut and marked. `config.update` writes only the keys it
names, through the configuration write gate. `properties.get` reads 14 common keys and `properties.update`
writes 12 of them; `online-mode` and `white-list` stay read-only from the panel.

A restart through `server.power` needs the `restart-script` of `spigot.yml` to exist; otherwise it is refused
as `power_unsupported` and the server keeps running. A power request is answered before the server stops and
does not pass through the command blocklist. The panel greys out the power buttons while `power-actions` is off;
after `/ul reload` a changed value is reported to the panel at once.

The panel can no longer start, stop, pause or reconfigure the log stream, because protocol 2.0.0 has no
message for it; the `levels` and `excluded-loggers` keys still apply. Backups are not offered: 6.3.1 never
declares the capability.

From the first step of UltiTools' disable, every request that would change server state is refused with a
failure saying the server is shutting down, and read-only requests keep working until the connection closes.
A command or power request is acknowledged and then fails, so it is not run again after the restart. The
disable waits up to 5 seconds for changes already under way. A request that needs the server thread and
arrived just before the stop began may get no answer; the panel then reports a timeout and nothing changed.

## Capabilities

Every panel-facing capability is gated by a switch under `ultipanel.capabilities` in
`plugins/UltiTools/config.yml`:

```yaml
ultipanel:
  capabilities:
    monitoring: true          # TPS, memory, world/player snapshots
    logs: true                # live console log stream
    player-events: true       # join/quit and command events, no chat event (as of v6.3.1)
    file-read: true           # read + list files within the editable roots
    file-write: false         # write/upload files within the editable roots
    file-delete: false        # delete files within the editable roots (as of v6.3.1 never a directory)
    commands: false           # remote command execution, subject to the blocklist
    server-properties: false  # read/edit server.properties safe keys
    power-actions: false      # stop/restart the server (as of v6.3.1)
    player-actions: false     # kick, game mode, teleport (as of v6.3.1)
```

`list` operations are gated by `file-read` — listing is reading, so there is no separate ninth
capability for it.

**Defaults are split, not uniform.** `monitoring`, `logs`, `player-events` and `file-read` default
`true`; `commands`, `file-write`, `file-delete` and `server-properties` default `false`. This is
deliberate: `monitoring`'s status payload is the panel's only "server is alive" signal, so defaulting
it off would make an upgraded server read as *offline* rather than merely unconfigured — the worst
failure shape, where the symptom points an operator the wrong way. `error-reporting` (under
`ultipanel.logging.error-reporting`) is **not** one of these eight capabilities — it keeps its own
existing key path and default, unchanged by this release.

**A disabled capability produces a refusal, never a silent failure.** The response names the exact
config key and file to change, for example:

```
Blocked by capability policy: 'file-write' is disabled — edit
ultipanel.capabilities.file-write in plugins/UltiTools/config.yml to change this.
```

## Remote command blocklist

Remote command execution (gated by the `commands` capability above) is additionally filtered by an
operator-editable blocklist:

```yaml
ultipanel:
  commands:
    blocklist:
      - "op"
      - "deop"
      - "stop"
      - "restart"
      - "reload"
      - "ban-ip"
      - "pardon-ip"
      - "whitelist"
      - "save-off"
      - "save-all"
```

Before v6.3.0 this list was a hardcoded, unconfigurable set of the same ten entries. As of v6.3.0 it
moves to `ultipanel.commands.blocklist` and is fully editable in both directions — an operator may
add to it or remove from it, including emptying it entirely.

As of v6.3.0 the value is checked as a whole before it replaces anything. It has to be a list in which every element is a string; entries are trimmed and compared in lower case. Any other shape is rejected as a whole: a single string, a mapping, or a list holding a mapping, a nested list, a null element, a number or a boolean. A string element is always accepted, including an empty one. The framework then logs one warning that names `ultipanel.commands.blocklist` and the shape it found, never the value, and keeps the blocklist it already has (the ten default entries on a fresh start). An explicit empty list (`blocklist: []`) is valid and blocks nothing, and a missing key keeps the current policy. The framework never rewrites `config.yml` to correct a value.

**There is deliberately no unoverridable floor.** The panel is the operator's own remote console, not
an autonomous agent; the party a hard-coded floor would constrain is the operator, not an attacker —
someone who has compromised the panel credential already holds the operator's own identity and can
reach equivalent outcomes through other in-game means, so a floor would restrict only the operator's
own legitimate configuration choices. The compensating control is the [remote action
log](#remote-action-log) below, which records every command the panel executes regardless of what
this list contains. This page does not enumerate which commands become reachable when the list is
emptied.

A blocklist refusal names its cause and its remedy, for example:

```
Blocked by the blocklist — edit ultipanel.commands.blocklist in
plugins/UltiTools/config.yml to change this.
```

Command-namespace normalization is unaffected by this change: `bukkit:op` and `op` both resolve to
the same blocklist entry before the check runs, at the single site that has always performed this
normalization.

### Remote command results

As of v6.3.0 the panel's remote command runs as the server console, as if the command had been typed
into the console, and modules see their usual console sender. The framework does not capture the
command's reply: the `command_result` message says the command was dispatched, with the text `Command
dispatched to the server console. Its output appears in the server log stream.`, or `The server console
did not accept the command. Any message it printed appears in the server log stream.` when the
dispatch returned false. The reply itself, together with all other console output, reaches the panel
through the [live log stream](#live-log-stream), so the `logs` capability has to be on to see it.
Blocklist refusals, an empty command and dispatch errors are reported as before. Before v6.3.0 an
accepted command's result carried the invented text `Command executed successfully` (a refused one read
`Command execution failed`) in place of a reply. A panel or tool
that showed `output` as the command's reply now shows the sentence above.

As of v6.3.1 the command runs with Paper's capturing command sender, which has the console's permissions, and
`command.result` carries the lines the command printed to that sender before its dispatch returned, cut to a
bounded number of lines and characters and marked `truncated` when cut. Lines the command prints later, for
example from an asynchronous body, are not in the result: the framework writes them to the server console
unchanged, so they reach the panel through the [live log stream](#live-log-stream), with sensitive commands
redacted as in every console line. This forwarding lasts 10 minutes after the result; a line printed later
still is dropped, with one warning naming the command. A command the server does not accept is answered with the reply it
printed, for example Paper's unknown-command line. A plugin command that accepts only the console sender
refuses the capturing sender; run such commands in the server console. The framework does not retry them as
the console.

As of v6.3.0, from the moment UltiTools starts disabling, panel requests get no reply
([#621](https://github.com/UltiKits/UltiTools-Reborn/issues/621)): an inbound message is dropped with one
`FINE` line instead of scheduling work for a disabled plugin, so a panel action sent while the server stops
waits for the panel's own timeout. A remote command caught in the moment the stop begins can be logged in
the console and in the remote action log as allowed and still never run, with no result reply. As of v6.3.1
the shutdown window is the one described under [UltiCloud protocol 2.0.0](#ulticloud-protocol-2-0-0).

## Remote file API boundary

The remote file API (`file-read`/`file-write`/`file-delete`) is confined to an explicit set of
editable roots, defaulting to plugin configs and historical logs:

```yaml
ultipanel:
  files:
    editable-roots:
      - "plugins"
      - "logs"
```

Editable roots answer *where*; the capabilities above answer *which verb*. These are two orthogonal
axes — a request must clear both.

**Inside those roots, an unconditional, pattern-based credential exclusion cannot be configured
open.** A short list of glob patterns and exact basenames — covering key/certificate file extensions
and a handful of known credential filenames — is checked before the editable-root set, on every
remote file operation, regardless of what roots an operator has granted. Adding a root back that
happens to contain a credential file does not reopen access to that specific file.

**A refusal always names one of two distinguishable causes**, never a single collapsed sentence:

- **Configurable** — the target is outside the editable-root set. The message points at
  `ultipanel.files.editable-roots`.
- **Not configurable** — the target matched the unconditional credential exclusion. The message says
  so explicitly, rather than pointing at a switch that does not exist.

As of v6.3.0, authorization and the operation use the object the filesystem actually reaches. The request is resolved against the real server directory one component at a time, so a symbolic link means what the operating system means, and a `..` that follows a link is not collapsed beforehand. Whether the target lies inside an editable root, and whether it is a credential file or the action-log directory, is decided on that real object. A link inside a root that points outside it is refused as outside the roots. A link inside a root that points at a protected file is refused like the file itself, and so is a path that reaches the action-log directory through a linked parent directory. These statements describe `read`, `write` and `list`; a `delete` judges a link by its own location and name instead, as described under "Deleting a symbolic link" below.

Some request shapes cannot be resolved safely and are refused with no configuration key that could allow them: a dangling or looping link, a component whose existence cannot be determined, and a `.` or `..` component in the part of a path that does not exist yet. A target that does not exist yet, such as the file of a `write`, must be made of ordinary names and must not exist even as a link. A `delete` also needs an ordinary final name, so `/`, `.` and a path ending in `.` or `..` are refused instead of resolving to some other directory.

**`list` marks refused entries instead of omitting them.** Before v6.3.0, an entry the caller was not
permitted to see was silently dropped from the listing, and the panel had no way to distinguish "this
file does not exist" from "this file is hidden by policy." As of v6.3.0, every entry carries an
`accessible` boolean; a refused entry additionally carries a `reason` of `PROTECTED_CREDENTIAL` or
`OUTSIDE_ROOTS`, with no `size`/`lastModified`/`readable`/`writable`. This is a backward-compatible
schema addition — an older panel build that does not know about these fields renders exactly what it
rendered before, plus the rows that used to be hidden.

As of v6.3.0 a listed file is marked refused exactly when reading it would be refused: a link to a file outside the roots is marked `OUTSIDE_ROOTS`, and a link to a credential file is marked `PROTECTED_CREDENTIAL`, with the same withheld fields. A link to a directory is marked by its target in the same way: a target outside the roots is marked `OUTSIDE_ROOTS`, without the target's size or modification time.

**A recursive directory delete requires an explicit `recursive: true` on the request.** Before
v6.3.0, a `delete` request naming a directory recursively removed it and everything inside with no
flag and no confirmation of any kind. As of v6.3.0, a directory-delete request that omits the field,
sets it to `false`, or sets it to anything other than a real JSON boolean is refused before any
filesystem access, naming the missing field. An older panel build that does not yet send this field
has every directory-delete request refused with a clear reason.

**Deleting a symbolic link removes the link and nothing it points to.** As of v6.3.0 a `delete` judges a link by its own location and name, not by its target, and removing it removes only the link. A `delete` of a link to a file removes the link and leaves the file untouched. A `delete` of a link to a directory removes only the link; the target directory and its contents are untouched, and the request needs no `recursive` flag because no subtree is removed. A dangling link can be deleted the same way. Before v6.3.0 a recursive delete of a link to a directory inside the roots emptied the target directory first. The `recursive` rule above applies to a real directory.

**A recursive delete never follows a link found inside the deleted folder.** As of v6.3.0, when a recursive `delete` of a real folder meets a symbolic link (or a Windows directory junction) inside it, the link itself is removed and its target and the target's contents are left untouched. This also holds when the link points to a protected folder.

### Known limitations of the file boundary

As of v6.3.0 the following cases are not covered:

- Another process on the server machine that swaps a path component for a link between the check and the use can redirect that one request. The panel itself cannot create links.
- A hard link to a credential file, placed inside an editable root under another name, cannot be told apart from an ordinary file by its path. Do not hard-link credential files into editable roots.
- On a case-insensitive file system such as the default macOS one, a case variant of a protected name is not recognised by the credential exclusion, and a directory requested with the wrong case is treated as an entry rather than as a directory: a `delete` of a non-empty one is refused instead of removing it, and an empty one is deleted without the `recursive` flag.

## Panel configuration edits <Badge type="tip" text="v6.3.0+" />

As of v6.3.0 a panel edit writes only what it names. An edit of a module configuration goes through the configuration write gate: it replaces the value at the named keys and keeps every other byte of the file, and a file the gate cannot write that way gets an error reply naming the reason (see [Saving configuration files](/guide/essentials/config-file#saving-configuration-files)).

As of v6.3.0 the capability an `update_config` message needs follows the file it names. A `fileName` of `server_properties` (a read without content, or a write with content) is governed by `ultipanel.capabilities.server-properties` and by nothing else. Every other target is governed by `ultipanel.capabilities.file-write` and by nothing else: a named module configuration file, the whole configuration, and a request that names a file without content. A `fileName` that cannot be read as a single name, such as an object or an array of several names, is governed by `file-write` and never reaches `server.properties`; an array holding only `server_properties` counts as that file. Turning on `file-write` therefore no longer opens `server.properties`, and turning on `server-properties` no longer needs `file-write`.

A `server.properties` edit replaces only the value text of the line that defines the key. Comments, key order, separators and other values keep their bytes, including a UTF-8 `motd`; the file is decoded and encoded as the server reads it and written atomically. A key defined on more than one line, or continued onto the next line, is refused with a reason naming the lines and no value: the `set` reply carries it as `reason`, and a `set_all` reply lists the key under `failed` and its reason under `failureReasons`. The server log names each refused key once. The server itself still rewrites the whole file when it next starts (measured on Paper 1.21.11).

## Credential file location <Badge type="tip" text="v6.3.0+" />

The framework's own UltiCloud credential file — the panel-connection token, not anything a module
owns — moved as of v6.3.0. This is operator-visible: it changes where a backup or a server-move needs
to copy the credential from.

| | Location |
|---|---|
| Before v6.3.0 | `plugins/UltiTools/data.json` |
| v6.3.0 and later | `<server root>/.ultikits/credentials.json` |

**The move happens automatically, once, on the first credential read/write after upgrading** — there
is no separate migration command to run. The sequence is fail-safe by construction: the old file is
read, the new file is written, the new file is read back to confirm it landed correctly, and only then
is the old file deleted. If the write or the read-back fails, the old file is left exactly where it was
and a warning is logged, so a failed migration never loses the credential. The move is attempted again on
the next credential access.

If the current file already exists, the old file is removed only after the current file has been read as a credential document: any valid JSON object, an empty one included. The current file is never overwritten with the old content. If the current file cannot be read that way (it is empty, is not valid JSON, or is not a regular file), both files are kept unchanged, no new server identity or token is written, and one warning names both files and what to check. A current file that cannot be opened at all produces an error, and nothing is deleted. Once the current file is fixed, the next credential access completes the cleanup.

The new location sits outside every default [editable root](#remote-file-api-boundary) described
above, and — like `data.json` before it — is additionally covered by the unconditional, filename-based
credential exclusion regardless of what roots an operator configures, refused from the remote file API
at both the new location and, for the duration of an upgrade's restart window, the old one.

**Three internal credential-coordination statics on `CloudAuthManager` are announced for removal in
v6.4.0.** `currentCredentialGeneration()`, `invalidateCredentialOperations()`, and
`commitTokenIfCurrent(TokenEntity, long)` were never a supported external API — they coordinate the
framework's own asynchronous credential producers with its teardown path, and carry
`@Deprecated(since = "6.3.0", forRemoval = true)` with a `{@removeIn 6.4.0}` javadoc tag. Their
signatures and behaviour are unchanged in v6.3.0; the credential file I/O they used to imply now goes
through the internal store described above. If your module calls any of the three, stop before
v6.4.0 — nothing in the public panel-integration or external-plugin API surface depends on them.

## Remote action log

Every remote action that passes the capability gate and the blocklist — allowed or denied — is
recorded as one structured line in `plugins/UltiTools/security/action.log`, carrying a timestamp,
capability, action, target, verdict (`allowed`/`denied`), and reason. This log lands inside the same
unconditional credential exclusion described above, so it cannot be deleted or disabled through the
remote file API. Its own rotation is configurable — the record of what the panel did is not:

```yaml
ultipanel:
  logging:
    action-log:
      max-size-bytes: 1048576  # rotate plugins/UltiTools/security/action.log at this size
      max-files: 5             # number of rotated files to keep
```

There is deliberately no key to disable this log entirely.

As of v6.3.0 the verdict records the policy decision, not the outcome of the operation. For a remote file operation, `denied` means a policy refusal at any layer: a disabled capability, a path outside the editable roots, the credential exclusion, a path shape that cannot be resolved safely, or a missing `recursive` flag. `allowed` means the policy allowed the operation, even if the operation then failed for an ordinary reason such as a missing file or a path of the wrong type. A refusal that depends on the real object a path reaches, such as a link pointing outside the roots, is recorded as `denied`.

## Live log stream

When the `logs` capability is on, the framework attaches its log handler each time the panel
connection opens, and sends console log records to the panel for as long as the connection stays up.
As of v6.3.0 the stream is a full mirror of the server console; see [The stream mirrors the server console](#the-stream-mirrors-the-server-console).
As of v6.3.0, the lines the framework itself writes or streams here (player join, quit and chat, plugin
actions, the online-player count, server status and file operation messages) follow the `language` key
of the main plugin config; see [Internationalization](/guide/essentials/i18n). Before v6.3.0 they were always Chinese.

As of v6.3.0, a `log_stream` or `log_stream_control` request whose action is `start`, `stop`,
`pause` or `resume` receives an error response stating that the action is not supported, and
delivery continues unchanged. Before v6.3.0 the framework accepted these four actions, but on no
released version did any of them change what reached the panel. The framework holds one connection
to the panel relay and cannot identify the viewers behind it, so it cannot pause or stop the stream
for a single viewer. Pausing or hiding the live view is done by the panel view itself, for example
by no longer rendering new lines.

The `status` action is still answered. As of v6.3.0, its `data` object carries these fields
alongside `action` and `clientId`:

| Field | Meaning |
|---|---|
| `connected` | Whether this server's connection to the panel is currently up. New in v6.3.0 |
| `logTransmitterEnabled` | Whether the log transmitter is accepting records |
| `queueSize` | Number of log entries queued and not yet sent |

The `subscriberCount` and `streaming` fields are no longer sent.

The public `LogStreamManager` methods behind the refused actions were removed in v6.3.0:
`startLogStream(String, String)`, `startLogStream(String)`, `stopLogStream(String)`,
`pauseLogStream(String)`, `resumeLogStream(String)`, `isStreaming()` and `getSubscriberCount()`.

### Batch settings

Log records bound for the panel are queued and sent in batches, configured under
`ultipanel.logging.batch`:

```yaml
ultipanel:
  logging:
    batch:
      enabled: true
      size: 10
      interval: 5000
```

| Key | Default | Effect |
|---|---|---|
| `enabled` | `true` | `false` sends every log record immediately as its own message |
| `size` | `10` | Largest number of entries in one send. When this many entries are queued, they are sent without waiting for the interval. Must be at least 1 |
| `interval` | `5000` | Milliseconds between scheduled sends, whether or not the `monitoring` capability is on. Must be at least 1000 |

At most 1,000 entries wait in the queue. When it is full, the oldest entry is dropped.

As of v6.3.0, the shipped `config.yml` declares this block and a changed interval takes effect.
Before v6.3.0 the block was missing from the shipped file, and a new interval never rescheduled the
sender that was already running. An existing `config.yml` is not rewritten to add the block; until
you add it, the defaults above apply.

The framework reads these keys each time the panel connection opens, from the configuration held in
memory. A value below its minimum is refused with a warning that names the key, and the default is
kept. Editing `config.yml` does not affect a connection that is already open, and `ul reload`
re-reads the file without reopening the connection, so restart the server to apply a changed value.

On a running server, a `log_stream` request with the action `config` can carry a `batchConfig`
object with any of `enabled`, `size` and `interval`. The framework checks every value in the request
against the same limits before applying any of them, and refuses the whole request if one is
invalid. Otherwise the values apply immediately, and a new interval reschedules the running sender.
Values set this way last until the panel connection next opens, when the values from `config.yml`
are applied again.

### Levels and excluded loggers

Two more keys under `ultipanel.logging` decide which log records the handler sends to the panel.
Neither key is in the shipped `config.yml`. When a key is absent, its default applies.

```yaml
ultipanel:
  logging:
    levels:
      - "info"
      - "warning"
      - "error"
    excluded-loggers:
      - "Minecraft"
```

| Key | Default | Effect |
|---|---|---|
| `levels` | `info`, `warning`, `error` | Levels whose records are sent to the panel. The names that match records are `error` (`SEVERE`), `warning` (`WARNING`), `info` (`INFO`) and `debug` (`CONFIG`, `FINE`, `FINER`, `FINEST`). Any other name is accepted without a warning and matches no record |
| `excluded-loggers` | Empty (as of v6.3.0) | Logger name prefixes whose records are dropped. The example above drops everything logged through `Bukkit.getLogger()` |

The framework reads both keys at the same point as the batch keys, each time the panel connection
opens, so restart the server to apply a changed value here too. As of v6.3.0 `levels` also applies to
the entries the framework sends to the panel directly: player join, quit and chat lines, plugin
action lines, and the lines sent when the stream starts. `excluded-loggers` still does not apply to
them, because these entries come from no logger. Chat entries, sent while the `player-events`
capability is on, are `debug` entries and reach the stream only when `debug` is in `levels`.

Each `excluded-loggers` entry is compared, case-sensitively, with the start of the name of the
`java.util.logging` logger that emitted the record, so an entry of `org.apache` also excludes
`org.apache.http` and every other name that begins with it. That name is not part of the entry sent
to the panel. The entry's `logger` field is a label the framework derives from its own
classification of the record: `UltiTools` for loggers under `com.ultikits.ultitools`, a name taken
from the logger name for other loggers whose name contains `plugin`, `MinecraftServer` for server
loggers, and `database`, `network` or `system` for the rest. Copying that label into
`excluded-loggers` matches only a logger whose own name happens to start with it. For example, an
entry of `MinecraftServer` matches none of the records labelled `MinecraftServer`, because the
framework gives that label to server loggers such as `Minecraft` and `net.minecraft.*`, not to a
logger with that name.

`java.util.logging` records carry one of three logger names: `Minecraft` (everything logged through
`Bukkit.getLogger()`, including the framework's own `[UltiTools-API] ...` lines), a plugin's own name,
or a `com.ultikits.ultitools.*` class logger. Lines that Paper prints through Log4j, and libraries that
log through Log4j or SLF4J such as authlib, Netty, HikariCP and Jetty, reach the stream through the
console mirror described below, under their Log4j logger names, and an `excluded-loggers` entry applies
to them as well. Before v6.3.0 the stream received only `java.util.logging` records and the default
list named five Log4j or SLF4J libraries, so it filtered nothing; as of v6.3.0 the default is empty,
which lets the stream show the whole console
([#485](https://github.com/UltiKits/UltiTools-Reborn/issues/485)).

As of v6.3.0, adding `debug` to `levels` sends debug records to the panel. Before v6.3.0 the handler
kept its own threshold at `INFO`, so it discarded `CONFIG`, `FINE`, `FINER` and `FINEST` records
before checking `levels`, and `debug` had no effect. The framework now lowers that threshold while
`debug` is in the list. It does not change the level of any logger, so a debug record reaches the
panel only if the logger that emits it is already set to let the record through.

As of v6.3.0, `levels` no longer affects automatic error reporting. The handler passes every `SEVERE`
record that carries an exception to error reporting (`ultipanel.logging.error-reporting`), whether or
not `error` is in `levels`. Before v6.3.0, a record whose level was not in `levels` was dropped
before that step, so removing `error` from `levels` also stopped these reports. The handler is not
attached while the `logs` capability is off, so these reports also depend on that capability.
Exclusion comes before both steps: a record from an excluded logger is neither sent to the panel nor
reported as an error. Error reports raised elsewhere, such as an exception thrown by a command, do
not pass through the handler, and neither key applies to them.

### The stream mirrors the server console

As of v6.3.0, with the `logs` capability on, the log stream shows what the server console shows. Paper
prints most of its output through Log4j: command feedback, a module's reply to the console sender,
player joins and quits, chat, vanilla warnings and errors, and player command lines. Before v6.3.0 none
of it reached the panel. The framework now installs an appender on Log4j's root logger when it loads
and removes it when it is disabled. Each line passes the same filters, batching and start-up replay as
a plugin line, without ANSI colour codes.

The mirror is complete and unredacted. It includes player command lines with their arguments, such as
`<player> issued server command: /login <password>`. The panel is at the console's trust level, so
whatever the console shows, the panel may show. Operators who do not want that should leave the `logs`
capability off. As of v6.3.1 a command registered as sensitive is the exception: its arguments are replaced
with `***` in these lines too (see [Sensitive commands](#sensitive-commands)).

A plugin line arrives once, although Paper also copies it into Log4j. Lines about the panel connection,
the log transmitter's own lines and the WebSocket library's (`org.java_websocket.*`) are never sent. If
the server's Log4j configuration uses asynchronous loggers, the mirror is not installed, a console
warning says so, and the stream carries plugin lines only. The same holds, as of v6.3.0, when Paper's log
forwarder (`org.bukkit.craftbukkit.util.ForwardLogHandler`) is not on the `java.util.logging` root logger,
as on a fork or a build that relocates CraftBukkit: without it the mirror cannot tell a forwarded plugin line
from a console line and would send every plugin line twice, so it is not installed and one console warning
per server run says so ([#583](https://github.com/UltiKits/UltiTools-Reborn/issues/583)). As of v6.3.0, every Paper build from 1.19.2
to 1.20.4 relocates CraftBukkit, so on those versions the mirror is never installed, one start-up warning
says so, and the stream carries plugin lines only; Paper 1.20.5 and later are not affected. A Log4j `ERROR` line with an exception is
also reported once to the panel's error collection. `org.apache.logging.log4j:log4j-core` is a
`provided` dependency of the framework (version 2.24.1); Paper supplies it at runtime, it is not
shaded, and a module needs nothing new.

### Start-up lines and failed sends

As of v6.3.0 the records logged from the moment the framework loads until the panel connection opens,
such as module loading and dependency resolution, reach the stream too. The framework keeps them in a
start-up buffer and sends them first, oldest first, when the stream starts
([#487](https://github.com/UltiKits/UltiTools-Reborn/issues/487)). The buffer keeps records at `INFO`
and above that `excluded-loggers` does not exclude, holds at most 2000 records (an estimated 512 KiB),
and is released without sending anything when the server has no cloud login or when the stream has not
started within five minutes. The replay is sent in messages of at most 64 KiB, the first at once and
then about one per second, independent of the batch keys above, so a full buffer drains in a few
seconds. A live record logged meanwhile can arrive before the last replay messages. With the `logs` capability off, the buffer is not created and nothing is kept.

Also as of v6.3.0, a batch of log records whose send fails, because the connection closed around it,
is kept and sent before anything newer on the next attempt, so records still arrive in order
([#486](https://github.com/UltiKits/UltiTools-Reborn/issues/486)). Delivery stays best effort: a batch
whose connection drops just after it was written may arrive twice. When more records arrive than the
stream can send, the queue keeps the newest 1000, and the framework reports how many it discarded in
one warning in the server log at most once a minute.

As of v6.3.0 the stream is a best-effort convenience copy of the console, and the server's
`logs/latest.log` is authoritative ([#583](https://github.com/UltiKits/UltiTools-Reborn/issues/583),
[#571](https://github.com/UltiKits/UltiTools-Reborn/issues/571)). Two known gaps: if the panel connection
drops while the start-up replay is still sending, or while the buffered records are being handed over to
the stream, the replay records not yet sent move to the new connection's live queue, which keeps the newest 1000 and counts the rest in the warning above, and they are
then sent like live records, without the replay's pacing; and a record another thread logs in the
microseconds while the stream first takes over from the start-up buffer can be missed, and is not counted.
Read anything that must not be missed, such as an audit trail or an incident, from `logs/latest.log`.

On a running server, the `log_stream` request with the action `config` described above can also
carry a `levels` array. As of v6.3.0 the framework applies it; before v6.3.0 the field was ignored.
The whole request is refused if any name is not one of the four above, and an empty array leaves no
level enabled. Levels set from the panel apply to the framework's direct entries too. Levels set this
way last until the panel connection next opens, when the handler is
created again from `config.yml`, or from the defaults if `levels` is absent there. The request has
no field for excluded loggers.

## Sensitive commands

As of v6.3.1 a module keeps the arguments of its secret-carrying commands out of everything the framework
sends to UltiCloud by registering the commands and their aliases with
`com.ultikits.ultitools.websocket.SensitiveCommandRegistry`:

<!-- UltiCloudDocSnippetsTest: sensitive-commands -->
```java
public class SensitiveCommands {

    /** Call from registerSelf() with UltiTools.getInstance().getSensitiveCommandRegistry(). */
    public void register(SensitiveCommandRegistry registry) {
        registry.register("login", "l", "register", "reg", "changepassword");
    }
}
```

- The table starts empty; the framework registers nothing itself.
- A command line matches when its first word, with one leading `/` and a `namespace:` prefix removed, equals a
  registered name, compared case-insensitively: with `login` registered, `/login`, `/LOGIN` and
  `/ultilogin:Login` all match.
- A matching command keeps its name and loses its arguments: `/login hunter2` becomes `/login ***`. This
  applies to every log line sent to the panel, live and replayed at start-up, console-mirror lines included,
  to error reports (message, trigger and stack trace) and to chat.
- `player.command` events carry only the command name, lower-cased and without namespace, for every command,
  registered or not.
- The server's own console, its log files and the log records other handlers see are not changed.
- Registration works from any thread, whether or not the server is linked, and repeating it is harmless.
  There is no way to unregister: a name stays redacted until the server restarts.

## Module extension point

Modules can now react to panel messages without the framework growing a second dispatch mechanism
beside its existing 24-message-type inbound table.

### Observing every message: `PanelMessageEvent`

`com.ultikits.ultitools.events.PanelMessageEvent` is published on the existing [Module
EventBus](/guide/advanced/module-eventbus) as the very last step of handling every inbound panel
message the framework has already processed — including a message type the framework itself does not
own. Subscribe exactly as you would to any other `ModuleEvent`:

```java
@ModuleEventHandler
public void onPanelMessage(PanelMessageEvent event) {
    String type = event.getType();
    JsonObject data = event.getData();
    // handlers run on the main thread — Bukkit API calls are safe here
}
```

Two things are deliberate about this event, both worth knowing before you rely on it:

- **Handlers run on the main thread.** The framework marshals the publish onto the main thread via
  `Bukkit.getScheduler().runTask(...)` at the bridge, not `publishAsync` — `publishAsync` submits to
  an async pool and does not reach the main thread at all, so it would not let a handler safely touch
  Bukkit API. A slow handler here costs server tick rate exactly the way a slow handler on any other
  Bukkit-thread event does; the framework logs a warning naming the message type when a publish takes
  longer than a small fixed threshold, but nothing stops a handler from being slow.
- **The event is not `Cancellable`.** It publishes at the end of dispatch, after the framework has
  already acted on the message — a cancel flag at that point would have no effect. This mirrors
  `EventBus.publishAsync`'s own existing outright rejection of `Cancellable` events for the same
  reason: a callable method with no effect is exactly the kind of declared-but-unusable surface
  UltiTools-API v6.3.0 exists to remove.

Data on the event is defensively copied on the way in and on every accessor call — mutating what a
handler received never affects what the next handler sees, or what the framework already acted on.

For a type a module's responder owns, the event is published once the request has been handed to the
responder, which may still be running.

As of v6.3.1 the event is published for every `module.request` that reaches a module's responder, on the main
thread, with the responder's type, the responder's input (the request's `params` plus `actor`) and the request
envelope as received. A request answered `module_not_found` publishes nothing. The framework's own protocol
messages publish no event.

### Owning a request/response type: `PanelResponderRegistry`

For panel message types the framework does **not** already handle, a module may register exactly one
responder and answer requests directly, through
`com.ultikits.ultitools.websocket.PanelResponderRegistry`.

As of v6.3.1 the panel reaches a responder with a `module.request { module, action, params, actor }`. The
`module` is the module's UltiCloud identifier: its `identify-string`, trimmed and lower-cased, not its
`plugin.yml` name. For UltiChat that is `ultichat`, although its name is `UltiTools-Chat`. A module whose
`identify-string` is missing or is not a valid identifier (a lower-case letter first, segments of lower-case
letters and digits joined by one `.` or `-`, at most 64 characters) is addressed by its `plugin.yml` name,
trimmed and lower-cased, as in 6.3.0, when that name is a valid identifier. Register the responder
under `<identifier>.<action>`; the 6.3.0 form `<plugin.yml name lower-cased>.<action>` is still found. The
action uses lower-case letters, digits, `.`, `_` and `-`. A request reaches only a responder of the module with
that identifier; any other request is answered `module_not_found`.

<!-- UltiCloudDocSnippetsTest: module-responders -->
```java
public class MailResponders {

    /** Call from registerSelf(); the framework releases the responders when the module unloads. */
    public void register(PanelResponderRegistry registry, UltiToolsPlugin module) {
        // Answers module.request { module: "ultimail", action: "inbox.count", params, actor }.
        registry.registerResponder("ultimail.inbox.count", data -> {
            JsonObject actor = data.getAsJsonObject("actor");
            JsonObject reply = new JsonObject();
            reply.addProperty("userId", actor.get("userId").getAsLong());
            reply.addProperty("unread", 3);
            return CompletableFuture.completedFuture(reply);
        }, module.getPluginName(), module);

        // Completing with null answers ok with data: null.
        registry.registerResponder("ultimail.inbox.clear",
                data -> CompletableFuture.completedFuture(null), module.getPluginName(), module);
    }
}
```

The responder receives a copy of the request's `params` with one more member, `actor`:
`{ "userId": <panel user id>, "minecraftUuid": <UUID or null> }`. UltiCloud fills it in for the panel user who
sent the request, and the framework passes it on as received; an `actor` inside `params` is replaced. Use it to
decide what that user may see. A module with at least one responder is declared in the handshake as
`modules:<identifier>@<X.Y.Z>`, the version being the first three numbers of its `plugin.yml` version, and
UltiCloud sends requests only for declared modules. The list is built when the connection opens; `/ul reload`
reconnects when it changed. A module whose identifier is not a valid UltiCloud identifier, or would make the
capability name longer than 96 characters, is skipped with one warning.

The panel receives `ok` with the responder's result as `data`, `module_not_found` when no responder serves the
request, `deadline_exceeded` when the deadline below passed, and `module_error` when the responder failed or its
result is not valid JSON (`NaN` or an infinite number).

- **Single owner per type.** Registering a type the framework already serves (as of v6.3.1, any message type
  of UltiCloud protocol 2.0.0) throws immediately, naming the framework as the existing owner. Registering a type
  another module already owns throws immediately, naming that module. This is checked, not
  advisory — there is no silent second-registration-wins fallback.
- **Responders return a future of any JSON value (as of v6.3.1).** An object, an array or a primitive is
  sent as the reply's `data`; a future that completes with `null` or `JsonNull` is a success with no
  content. Returning no future, throwing, or completing the future exceptionally fails the request. You never
  touch the connection directly. In v6.3.0 the result had to be an object and `null` was a failure. The
  registration methods now take `Function<JsonObject, ? extends CompletableFuture<? extends JsonElement>>` and
  `dispatch` returns `CompletableFuture<JsonElement>`: a 6.3.0 lambda still compiles and a compiled module still
  links, but a subclass overriding `registerResponder` with the old parameter type, or code assigning
  `dispatch`'s result to a `CompletableFuture<JsonObject>`, must be updated.
- **Responders run on worker threads (as of v6.3.0).** The framework calls a responder on one of its
  own worker threads, never the server main thread and never the thread that reads the panel
  connection, so a slow responder no longer holds up other panel messages. A responder that uses
  Bukkit API schedules that part onto the main thread itself, for example with
  `Bukkit.getScheduler().runTask(...)`, and completes its future from there.
- **One deadline, counted from arrival.** One deadline of a few seconds starts when the request
  arrives and covers waiting for a worker, the call itself and the returned future. When it passes,
  the panel receives a timeout error naming the type and the module, and a result that arrives later
  is dropped. At most 4 requests are handled at once and at most 64 more wait for a worker; a request
  beyond that is refused at once with an error reply naming its type and module.
- **Responders must be thread-safe.** Responders may run concurrently, up to 4 calls at once
  including several calls of the same responder, and may finish out of request order. A call that
  blocks keeps its worker until it returns, also past its deadline, and is never interrupted. The
  call sees the context class loader of the thread that received the request, and no transaction,
  user or other thread-local state.
- **Late replies are dropped.** As of v6.3.0 the reply goes only through the WebSocket client of the cloud
  session that was current when the request was admitted, and only while that client is still installed
  and connected on the current session and UltiTools still accepts panel messages. It is not sent once
  UltiTools starts disabling, once the cloud session logs out, or once the connection that carried the
  request has closed or been replaced, and it is never redirected to a newer connection. The panel's own
  timeout then applies. As of v6.3.1 the reply goes on the protocol 2.0.0 connection that carried the request,
  under the same rule.
- **The responder registered on arrival handles the request,** even if the type is reassigned or the
  module unloads before the call runs.
- **Responders are unregistered automatically** when your module unloads, at the same point the
  framework already unregisters your `EventBus` subscriptions.
- **A responder belongs to one module instance (as of v6.3.0).** One registered while the framework
  loads your module (during its container refresh or `registerSelf()`) belongs to that instance. One
  registered later with the three-argument `registerResponder(type, responder, ownerModule)` belongs
  to the instance the framework lists as loaded under `ownerModule`, and to the older one while a
  newer instance of your module is replacing it. When an instance unloads or is replaced, exactly its
  own responders go. A responder registered by name in your module's constructor, or in
  `@PostConstruct` code that runs while the framework registers your main class as a bean (the main
  class's own, and that of beans it injects), belongs to the instance listed under that name at that
  moment: none at the first load, and the older instance while a newer one is being loaded. Register
  responders in `registerSelf()`, or, if you hold your module instance, use the four-argument
  `registerResponder(type, responder, ownerModule, ownerInstance)`, which records it directly.
- **A newer instance takes over its older instance's types (as of v6.3.0).** When code registers a
  newer instance of a loaded module, the older instance's responders are released before the newer
  one's `registerSelf()` runs, so registering the same type there succeeds. If the newer instance
  fails to load, its responders are released and the older instance's come back unchanged.

As of v6.3.1 the panel reaches only types of the form `<identifier>.<action>` (or the 6.3.0 name form above),
so the module is the namespace and an action needs no prefix of its own. The framework does not reject other
type strings, but no panel request can reach them.

## See also

- [Module EventBus](/guide/advanced/module-eventbus) — the underlying pub/sub mechanism
  `PanelMessageEvent` is published on.
- [Cloud Login](/guide/advanced/cloud-login) — linking the server and the connection states.
- [Player Link](/guide/advanced/player-link) — letting a player reach the panel.
