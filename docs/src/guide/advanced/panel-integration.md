# Panel Integration

7.0.0 has not been released. This page describes the framework side of UltiPanel integration as of v7.0.0; see the [7.0.0 release notes](/guide/release-notes/7.0.0) for the release status. For server linking and connection status, see [Cloud Login](/guide/advanced/cloud-login).

## UltiCloud protocol 2.1.0 history {#ulticloud-protocol-2-1-0}

UltiTools 6.3.1 introduced the device-code login and protocol 2.1.0. See the [archived 6.3.1 panel guide](/v6.3.1/guide/advanced/panel-integration.html#ulticloud-protocol-2-1-0) for the original protocol changes, including [sensitive commands](/v6.3.1/guide/advanced/panel-integration.html#sensitive-commands) and [responder registration](/v6.3.1/guide/advanced/panel-integration.html#owning-a-request-response-type-panelresponderregistry). The sections below describe what the 7.0 framework handles, not which controls a particular panel deployment exposes.

## Capabilities {#capabilities}

The framework reads these switches under `ultipanel.capabilities` in `plugins/UltiTools/config.yml`:

| Key | Default | Framework behavior when enabled |
|---|---|---|
| `monitoring` | `true` | Sends server metrics and player, plugin and world snapshots. |
| `logs` | `true` | Sends console log lines. |
| `player-events` | `true` | Sends player join, leave and command events. |
| `file-read` | `true` | Allows file reading and listing, and reading module configuration. |
| `file-write` | `false` | Allows file and module configuration writes. |
| `file-delete` | `false` | Allows remote file deletion. |
| `commands` | `false` | Allows remote commands subject to the command blocklist. |
| `server-properties` | `false` | Allows reads and edits of permitted `server.properties` keys. |
| `power-actions` | `false` | Allows structured stop and restart requests, separate from remote commands. |
| `player-actions` | `false` | Allows kick, game mode and teleport requests. |

The framework checks applicable capabilities when admitting requests. Error reporting uses the separate `ultipanel.logging.error-reporting.enabled` switch (default `true`). `/ul reload` reloads the configuration; an established session reconnects if the set of capabilities it offered has changed. This includes changes to the advertised module capabilities. Reload does not re-read the command blocklist or apply pending module changes.

## Remote command blocklist {#remote-command-blocklist}

Keep `ultipanel.capabilities.commands: false` for untrusted operators. When commands are enabled, `ultipanel.commands.blocklist` is read at startup. Stop, edit `plugins/UltiTools/config.yml`, then start the server to change it; `/ul reload` is not enough.

The default list is `op`, `deop`, `stop`, `restart`, `reload`, `ban-ip`, `pardon-ip`, `whitelist`, `save-off`, `save-all`, `execute`, `return`, `function`. A missing key uses the default. A malformed list is rejected as a whole. An existing valid list is not extended, and `[]` disables the configurable list. The framework still refuses panel-issued `/ulticloud login`, `/ulticloud login <code>` and `/ulticloud logout` independently of that list.

### Aliases and nested commands {#aliases-and-failures-as-of-v6-5-0}

The framework checks the command name without its namespace and ignores case. Before dispatch it also checks the resolved command's registered spellings: listing one alias can block the other spellings of that command. A directly blocked request returns `command_blocked`, with the matched name in `details.matched`.

Synchronous nested calls entering the framework's command executor are checked again. A nested refusal is ordinary command feedback, not a new `command_blocked` result. If a wrapper changes the sender, that feedback need not appear in the outer command result. The blocklist is not a sandbox for arbitrary wrappers, datapack functions or commands dispatched in a later tick.

### Remote command results {#remote-command-results}

The framework hands panel command dispatch to its scheduler's `global()` context. Paper's capturing sender has console permissions but is not the actual console sender. Commands that require the actual console can refuse it; the framework does not retry as the console.

`command.result` contains the immediate feedback captured during dispatch in `data.output` on success. When dispatch is refused, captured feedback is returned in the `command_failed` error's `message` instead. Immediate feedback is not also echoed to the console. Later feedback from the capturing sender goes to the console for up to ten minutes after the result, not into that result. The framework's audit echo is separate: the bundled text is `[Remote command] > <command>` in English and `[远程命令] > <command>` in Chinese, before the server's logger prefix. With `language: auto`, framework command feedback uses `fallback-language` for panel senders.

As of v7.0.0, synchronous framework command bodies run on the global tick thread. `@RunAsync` and `@AsyncCommand` bodies use the framework's `async()` context; their later replies are not part of dispatch's immediate result. The panel command handler trims the input before dispatch. If you dispatch commands yourself, trim the input as well: a literal with a trailing space can fail in the new parser before recovery runs. See [7.0 command migration](/guide/advanced/upgrading-to-7#command-migration).

## Pending module changes {#pending-module-changes}

As of v7.0.0, `/upm install`, `/upm update` and `/upm uninstall` queue changes for the next start instead of modifying running modules. The framework handles requests to list pending changes and revoke eligible entries individually on a connected session. It advertises `upm:pending` without a separate configuration switch. Failed, unfinished or manual-attention entries cannot be revoked through this interface.

A revocation delayed behind another request on the same connection can still run after a timeout. Refresh the pending list before retrying. You can also inspect the list with `/upm pending` and revoke an eligible entry with `/upm revoke <module>` on the server. `/ul reload` does not apply the queue; see [Applying changes and recovery](/guide/advanced/upgrading-to-7#apply-and-recover).

## Remote files and configuration {#remote-file-api-boundary}

`ultipanel.files.editable-roots` defaults to `plugins` and `logs`, relative to the server root. The file capabilities still apply, and widening the roots does not expose the framework's private state or remote action log. Directory listings are capped at 2,000 entries and marked as truncated when they exceed that limit. The remote file API does not delete directories.

Module configuration edits are distinct from raw file writes. The module configuration handler hands its work to `global()` and uses the framework's configuration write rules. See [Config File](/guide/essentials/config-file) for validation, write refusals and when configuration changes take effect.

## Remote action log and live logs {#live-log-stream}

The framework records remote command decisions in the remote action log, separate from the command's reply and the live log stream. The bundled action log rotation settings are `ultipanel.logging.action-log.max-size-bytes: 1048576` and `ultipanel.logging.action-log.max-files: 5`; there is no disable switch for the action log.

The `logs` capability controls forwarding of live console lines. Forwarded lines retain their rendered language; the framework does not translate them again. The legacy `ultipanel.logging.batch` keys in `config.yml` do not control the active cloud stream, which sends `log.lines` roughly once a second or when a batch fills. The stream reads `ultipanel.logging.levels` and `ultipanel.logging.excluded-loggers` when its log handler attaches. The default levels are `info`, `warning` and `error`; there are no configured logger exclusions by default. Use the server log as the authoritative local record, not the live stream.

## Sensitive commands {#sensitive-commands}

Register the name and every alias of any module command that takes sensitive arguments. Registration is idempotent and persists until restart; the framework's registry already includes `ulticloud`.

```java
// In registerSelf(): names and aliases, not full command lines.
UltiTools.getInstance().getSensitiveCommandRegistry().register("privateaction", "paction");
```

`com.ultikits.ultitools.websocket.SensitiveCommandRegistry` matches names case-insensitively, without the namespace prefix. The framework replaces matched arguments with `***` in forwarded log text and in its own remote-command echo, refusal and audit records. It does not rewrite console lines that other plugins print locally. Do not print sensitive values in command replies or log messages; registration is not general-purpose secret filtering.

## Module extension points {#module-extension-point}

### Request observation: `PanelMessageEvent` {#observing-every-message-panelmessageevent}

The framework publishes `com.ultikits.ultitools.events.PanelMessageEvent` on the [module event bus](/guide/advanced/module-eventbus) for a `module.request` handed off to a responder. `getType()`, `getData()` and `getRawMessage()` expose its resolved type, its responder input and its request envelope; the JSON objects are copies. A request with no matching responder and framework protocol messages outside the module request path do not produce this event.

Subscribe with `@ModuleEventHandler`. As of v7.0.0, the framework publishes through its scheduler's `global()` context on the server's global tick thread. Keep handlers short. The event is observational and cannot be cancelled; the responder need not have finished when the event is delivered.

### Responder registration: `PanelResponderRegistry` {#owning-a-request-response-type-panelresponderregistry}

Use `UltiTools.getInstance().getPanelResponderRegistry()` in `registerSelf()`. Register the type as `<identifier>.<action>` using the module's UltiCloud identifier, not its display name. The framework routes only to a responder owned by the requested module. The module capability is offered as `modules:<identifier>@<X.Y.Z>`; version suffixes do not provide version components. If that capability was not accepted at handshake, the framework refuses the request before invoking module code.

```java
@Override
public boolean registerSelf() {
    UltiTools.getInstance().getPanelResponderRegistry().registerResponder(
            "example.status", data -> CompletableFuture.completedFuture(new JsonPrimitive("ready")),
            getPluginName(), this);
    return true;
}
```

This example assumes the module identifier is `example`; `CompletableFuture` is from `java.util.concurrent` and `JsonPrimitive` is from `com.google.gson`. The third argument is the owner module name; the fourth explicitly binds the registration to this instance. The three-argument form uses the current load scope on the calling thread or the loaded instance matching the owner name, if one exists. Avoid name-only registration in the constructor. The framework releases instance-owned responders on unload; framework-reserved types and duplicate registrations are refused.

The responder receives a copy of `params`, with `actor` replaced by the request's separate, validated actor object. Return a future of a JSON value; completion with `null` is success with `data: null`, while returning no future, throwing or failing the future is an error. A missing responder yields `module_not_found`; a missed deadline yields `deadline_exceeded`. A result is sent only on the admitting connection, not redirected after reconnect.

Responders run on registry workers, not the global tick thread or the connection reader. Calls may overlap, even for the same type. The registry allows four worker calls and 64 waiting requests; the three-second deadline includes queueing, the call and future completion. A timeout does not interrupt a blocked worker. For server API calls, switch through the module's injected `Scheduler` to the context that owns the state, for example `scheduler.global().supply(...)` for global state or `scheduler.entity(player)` for player state. See [7.0 scheduling](/guide/advanced/upgrading-to-7#scheduler-and-screens).
