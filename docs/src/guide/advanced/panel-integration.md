# Panel Integration

::: warning As of v6.3.0 — unreleased
Everything on this page describes behaviour landing in UltiTools-API v6.3.0, currently on the
`alpha` branch. If you are running v6.2.5 or earlier, none of the config keys or classes below exist
yet.
:::

UltiTools connects to the UltiPanel remote-management platform over a WebSocket. As of v6.3.0, four
things about that connection change: every panel-facing capability becomes an operator-visible
switch, remote command filtering becomes an operator-editable blocklist, the remote file API is
confined to an explicit set of editable roots with an unconditional credential exclusion, and a
module can now observe or answer panel messages without the framework growing a second dispatch
mechanism beside the existing one.

## Capabilities

Every panel-facing capability is gated by a switch under `ultipanel.capabilities` in
`plugins/UltiTools/config.yml`:

```yaml
ultipanel:
  capabilities:
    monitoring: true          # TPS, memory, world/player snapshots
    logs: true                # live console log stream + control
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

There is no `<module>:<type>` namespace requirement enforced by the framework — that would be a
cross-repository protocol convention the panel side would also have to honour, not something this
framework alone can enforce. Choosing a namespaced type string (as in the example above) is a
convention worth following anyway, to avoid colliding with another module's own message type.

## See also

- [Module EventBus](/guide/advanced/module-eventbus) — the underlying pub/sub mechanism
  `PanelMessageEvent` is published on.
