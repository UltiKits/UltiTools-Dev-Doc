# Panel Integration

::: warning As of v6.3.0 — unreleased
Everything on this page describes behaviour landing in UltiTools-API v6.3.0, currently on the
`alpha` branch. On v6.2.5 or earlier, most of the config keys and classes below do not exist yet;
where one already exists, its section says what changed.
:::

UltiTools connects to the UltiPanel remote-management platform over a WebSocket. As of v6.3.0, five
things about that connection change: every panel-facing capability becomes an operator-visible
switch; remote command filtering becomes an operator-editable blocklist; the remote file API is
confined to an explicit set of editable roots with an unconditional credential exclusion; the live
log stream can no longer be started, stopped, paused or resumed from the panel, its batch interval
and `debug` level now take effect, and its level filter no longer suppresses error reports raised
from log records; and a module can now observe or answer panel messages without the framework
growing a second dispatch mechanism beside the existing one.

## Capabilities

Every panel-facing capability is gated by a switch under `ultipanel.capabilities` in
`plugins/UltiTools/config.yml`:

```yaml
ultipanel:
  capabilities:
    monitoring: true          # TPS, memory, world/player snapshots
    logs: true                # live console log stream
    player-events: true       # join/quit/chat events
    file-read: true           # read + list files within the editable roots
    file-write: false         # write/upload files within the editable roots
    file-delete: false        # delete files/directories within the editable roots
    commands: false           # remote command execution, subject to the blocklist
    server-properties: false  # read/edit server.properties safe keys
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
Blocklist refusals, an empty command and dispatch errors are reported as before. Before v6.3.0 the
result carried the invented text `Command executed successfully` in place of a reply. A panel or tool
that showed `output` as the command's reply now shows the sentence above.

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

**`list` marks refused entries instead of omitting them.** Before v6.3.0, an entry the caller was not
permitted to see was silently dropped from the listing, and the panel had no way to distinguish "this
file does not exist" from "this file is hidden by policy." As of v6.3.0, every entry carries an
`accessible` boolean; a refused entry additionally carries a `reason` of `PROTECTED_CREDENTIAL` or
`OUTSIDE_ROOTS`, with no `size`/`lastModified`/`readable`/`writable`. This is a backward-compatible
schema addition — an older panel build that does not know about these fields renders exactly what it
rendered before, plus the rows that used to be hidden.

**A recursive directory delete requires an explicit `recursive: true` on the request.** Before
v6.3.0, a `delete` request naming a directory recursively removed it and everything inside with no
flag and no confirmation of any kind. As of v6.3.0, a directory-delete request that omits the field,
sets it to `false`, or sets it to anything other than a real JSON boolean is refused before any
filesystem access, naming the missing field. An older panel build that does not yet send this field
has every directory-delete request refused with a clear reason.

## Panel configuration edits <Badge type="tip" text="v6.3.0+" />

As of v6.3.0 a panel edit writes only what it names. An edit of a module configuration goes through the configuration write gate: it replaces the value at the named keys and keeps every other byte of the file, and a file the gate cannot write that way gets an error reply naming the reason (see [Saving configuration files](/guide/essentials/config-file#saving-configuration-files)).

A `server.properties` edit replaces only the value text of the line that defines the key. Comments, key order, separators and other values keep their bytes, including a UTF-8 `motd`; the file is decoded and encoded as the server reads it and written atomically. A key defined on more than one line, or continued onto the next line, is refused with a reason naming the lines and no value: the `set` reply carries it as `reason`, and a `set_all` reply lists the key under `failed` and its reason under `failureReasons`. The server log names each refused key once. The server itself still rewrites the whole file when it next starts, as every Paper version does.

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
is the old file deleted. If the write fails at any point, the old file is left exactly where it was
and the framework falls back to it, so a failed migration never loses the credential — it just leaves
the operator on the old location until the next successful attempt.

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
opens, so restart the server to apply a changed value here too. A few entries the framework sends to
the panel directly, such as player join, quit and chat lines, do not pass through the handler, and
neither key applies to them. Chat lines, sent while the `player-events` capability is on, arrive at
the `debug` level even when `debug` is not in `levels`.

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
capability off.

A plugin line arrives once, although Paper also copies it into Log4j. Lines about the panel connection,
the log transmitter's own lines and the WebSocket library's (`org.java_websocket.*`) are never sent. If
the server's Log4j configuration uses asynchronous loggers, the mirror is not installed, a console
warning says so, and the stream carries plugin lines only. A Log4j `ERROR` line with an exception is
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

On a running server, the `log_stream` request with the action `config` described above can also
carry a `levels` array. As of v6.3.0 the framework applies it; before v6.3.0 the field was ignored.
The whole request is refused if any name is not one of the four above, and an empty array leaves no
level enabled. Levels set this way last until the panel connection next opens, when the handler is
created again from `config.yml`, or from the defaults if `levels` is absent there. The request has
no field for excluded loggers.

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

### Owning a request/response type: `PanelResponderRegistry`

For panel message types the framework does **not** already handle, a module may register exactly one
responder and answer requests directly, through
`com.ultikits.ultitools.websocket.PanelResponderRegistry`:

```java
UltiTools.getInstance().getPanelResponderRegistry()
    .registerResponder("my_module:status", data -> {
        JsonObject reply = new JsonObject();
        reply.addProperty("state", "ok");
        return CompletableFuture.completedFuture(reply);
    }, "MyModule");
```

- **Single owner per type.** Registering a type the framework already serves (any of its 24 built-in
  message types) throws immediately, naming the framework as the existing owner. Registering a type
  another module already owns throws immediately, naming that module. This is checked, not
  advisory — there is no silent second-registration-wins fallback.
- **Responders return `CompletableFuture<JsonObject>`.** The framework wraps the resolved value (or a
  failure) with the request's `requestId` and sends it back to the panel — you never touch the
  WebSocket connection directly.
- **One bounded timeout, applied in one place.** If a responder's future has not completed within a
  few seconds, the framework completes the reply on the responder's behalf with an explicit timeout
  error rather than leaving the panel's request hanging indefinitely.
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

There is no `<module>:<type>` namespace requirement enforced by the framework — that would be a
cross-repository protocol convention the panel side would also have to honour, not something this
framework alone can enforce. Choosing a namespaced type string (as in the example above) is a
convention worth following anyway, to avoid colliding with another module's own message type.

## See also

- [Module EventBus](/guide/advanced/module-eventbus) — the underlying pub/sub mechanism
  `PanelMessageEvent` is published on.
