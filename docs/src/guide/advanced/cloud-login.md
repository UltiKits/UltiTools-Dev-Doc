# Cloud Login

This page describes the framework side of server linking as of v7.0.0; see the [7.0.0 release notes](/guide/release-notes/7.0.0) for an overview of the changes.

## Operator commands

Run these operator-only commands from the server console or RCON. `/ulticloud login` (with or without an argument) and `/ulticloud logout` are refused from the panel even when the [remote command blocklist](/guide/advanced/panel-integration#remote-command-blocklist) is empty.

| Command | Framework behavior |
|---|---|
| `/ulticloud login` | Requests a device code and polls for a result. |
| `/ulticloud login <code>` | Redeems a re-pair code without requesting a new device code. The command rejects malformed input without sending it. |
| `/ulticloud logout` | Stops the local cloud session and cancels a pending login, or attempts to revoke and delete the saved server credential. |
| `/ulticloud status` | Reports whether the server is linked and, if linked, its name, server ID and connection state. |
| `/ulticloud reconnect` | Requests an immediate connection attempt. Use `/ulticloud status` to check the result. |

## Linking a server

`/ulticloud login` prints a verification address, a device code, a direct link and the remaining validity in minutes. Follow the instructions in the console. The framework polls in the background and starts a connection after it has saved the server credential. The credential is stored as the `cloud_credential` entry of `<server root>/.ultikits/credentials.json`, a framework-owned file that the [remote file API](/guide/advanced/panel-integration#remote-file-api-boundary) does not serve. Both login forms refuse to run when the server is already linked and share a 60-second login cooldown.

For a device-code request started over RCON, the initial reply is `Requesting a device code from UltiCloud. The code and the link will be printed in the server console.` For a re-pair request it is `Redeeming the re-pair code with UltiCloud. The result will be printed in the server console.` Check the console for the later output.

## Unlinking a server

As of v7.0.0, `/ulticloud logout` stops the local session before attempting remote revocation. When there is a saved credential, the revocation request and the local deletion run on the framework scheduler's `async()` context, not on the server tick thread. A failed revocation can still leave the server unlinked locally; in that case the command warns `The cloud credential may still be valid. Revoke it in the panel: server settings > Revoke credential.` A local delete failure is reported separately: check the server log and run `/ulticloud logout` again.

## Connection status and retries

A linked server is not necessarily connected. Both bundled language catalogues print `UltiCloud: Linked as <name> (server ID <server_id>)` and `Connection: <connection>` when linked, or `UltiCloud: Not linked` and `Use /ulticloud login to link this server.` when unlinked. The connection state is supplied by the framework in English:

| `<connection>` | Meaning |
|---|---|
| `connected` | The framework has accepted the connection's `welcome` message. |
| `connecting` | An attempt is in progress, including a socket open but still awaiting `welcome`. |
| `reconnecting in <seconds> s (attempt <attempt>)` | Another attempt is scheduled. |
| `paused — plan limit reached; retrying every 15 minutes (next in <minutes> min). Run /ulticloud reconnect after renewing.` | The framework received a plan-limit refusal. It retains the credential and retries at the slower interval. |
| `stopped — this UltiTools version is no longer accepted; upgrade UltiTools` | Automatic retries stopped. Upgrade UltiTools and restart the server. |
| `stopped — another connection is using this server's credential` | Automatic retries stopped after repeated connection replacements. |
| `stopped — UltiCloud answered with a different server ID than this server is linked to; contact UltiCloud support, or run /ulticloud logout and then /ulticloud login` | Automatic retries stopped because the connection reported a different server ID. |
| `not connected` | The server remains linked but has no active connection or scheduled retry. |

`/ulticloud reconnect` has a 10-second cooldown, including invocations refused by the connection state. `Reconnecting to UltiCloud now.` means an attempt was queued, not that the server is connected. An active connection or attempt, a required upgrade, an unlinked server or a server-ID mismatch each gets a separate reply. With `language: auto`, command feedback for non-player senders uses `fallback-language`; see [Messages and Languages](/guide/essentials/messages).

## Panel capabilities and module APIs

See [Panel Integration](/guide/advanced/panel-integration#capabilities) for the defaults under `ultipanel.capabilities` in `plugins/UltiTools/config.yml`. `/ul reload` can renegotiate the offered capabilities but does not apply pending module changes or reload module JARs.

`CloudAuthManager` is internal. Modules that need to link a player use the [player-link API](/guide/advanced/player-link), not the server login command or the former `UltiCloudRequests` API. See [Sensitive commands](/guide/advanced/panel-integration#sensitive-commands) for command argument redaction.

## 6.x history

For the device-code transition in 6.3.1, see the [archived 6.3.1 cloud login guide](/v6.3.1/guide/advanced/cloud-login.html). For a module moving to 7.0, see [Upgrading to 7.0](/guide/advanced/upgrading-to-7).
