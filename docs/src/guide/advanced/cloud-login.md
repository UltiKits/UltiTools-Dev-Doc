# Cloud Login

::: info As of v6.3.1
UltiTools-API v6.3.1 links a server to UltiCloud with a device code and UltiCloud protocol 2.0.0. The 6.3.0 magic-link login and its cloud service stop at the cut-over.
:::

`/ulticloud login`, `/ulticloud logout`, `/ulticloud status` and `/ulticloud reconnect` connect a server to
UltiCloud for remote management through the UltiPanel dashboard. As of v6.3.1 a linked server holds only a
revocable credential of its own, never a user account token, and the framework speaks UltiCloud protocol
2.0.0 to `wss://api.ultikits.com/v1/agent`. The commands run from the server console or over RCON and need
operator rights.

## Linking a server

`/ulticloud login` asks UltiCloud for a device code and prints it:

```
========================================
 To link this server to UltiCloud, open:
 <verification URI>
 and enter the code:
 BCDF-GHJK
 Or open this link directly: <complete verification link>
========================================
The code expires in 10 minutes. Waiting for confirmation...
```

Open the address in a browser, sign in to UltiCloud, enter the code and confirm. The server's name is chosen
on that confirmation page; the server's MOTD is only the suggested default. The code is case- and
hyphen-insensitive. When the owner confirms, the console logs `UltiCloud: this server is now linked as <name>
(server ID <server ID>).` and the connection starts.

| Situation | What the command does |
|---|---|
| The server is already linked | Refuses and names `/ulticloud logout` |
| A second `/ulticloud login` within 60 seconds | Refuses with the remaining seconds |
| The owner denies on the confirmation page | Stops polling with `UltiCloud: linking was denied on the confirmation page. Run /ulticloud login to try again.` |
| Nobody confirms within 10 minutes | Stops polling with `UltiCloud: the device code expired before it was confirmed. Run /ulticloud login to get a new code.` |
| `/ulticloud logout` while waiting | Cancels the request; confirming afterwards does not link the server |

Over RCON the command answers at once that the code and the link will be printed in the server console, and
every line of the block above is also written to the console log. An RCON reply closes when the command
returns, while the code arrives a moment later.

## The server credential

The credential is stored as the `cloud_credential` entry of `<server root>/.ultikits/credentials.json`, the
framework-owned file that already held the 6.3.0 token. On a POSIX file system the file is owner-only. The
credential does not expire and has no refresh token. UltiCloud may rotate it: the framework writes the new
credential to disk before it acknowledges the rotation, keeps using the old one on the open connection, and
uses the new one from the next connection. The remote file API never serves the `.ultikits` directory.

`/ulticloud logout` revokes the credential on UltiCloud, then deletes it, stops reconnecting and stops every
cloud feature. When UltiCloud cannot be reached, logout still deletes the credential locally and warns:
`The cloud credential may still be valid. Revoke it in the panel: server settings > Revoke credential.`

## Operator commands

| Command | What it does |
|---|---|
| `/ulticloud login` | Requests a device code, prints it, and waits for the confirmation |
| `/ulticloud logout` | Revokes and deletes the credential and stops all cloud features |
| `/ulticloud status` | Prints `UltiCloud: Linked as <name> (server ID <server ID>)` and the connection state, or that the server is not linked |
| `/ulticloud reconnect` | Retries the connection at once, at most once every 10 seconds; says so when the server is already connected or connecting, not linked, or needs an UltiTools upgrade |

## Connection and reconnect

The connection is kept by one state machine. After a lost connection it retries with a random delay between
1 second and an upper bound that doubles from 1 second to 60 seconds, opens a new socket on every attempt and
reads the credential afresh. The console shows one line per attempt and per scheduled retry, never the
credential. A connection counts as established only when UltiCloud's `welcome` arrives within 15 seconds;
the framework then sends a heartbeat every 30 seconds and reconnects after 90 seconds without an answer.

Some answers from UltiCloud end or change the retry cycle:

| UltiCloud answers | What the framework does |
|---|---|
| HTTP 401, or close code 4401 (credential revoked, server deleted) | Stops, deletes the credential and the buffered cloud state, and logs `UltiCloud rejected this server's credential (it was revoked or is no longer valid). The saved credential was deleted. Run /ulticloud login to link this server again.` |
| HTTP 426, or close code 4426 | Stops and keeps the credential; the console says this UltiTools version is no longer accepted and names the minimum version when UltiCloud sends one. Upgrade UltiTools and restart |
| HTTP 402, or close code 4402 (plan limit) | Keeps the credential and pauses, see below |
| HTTP 429, close code 4400 or 4429, another 4xx | Waits longer: a random delay up to a bound that grows from 60 seconds to 15 minutes, and at least the `Retry-After` of a 429 |
| Close code 4000, three times in a row | Another connection uses the same credential; reconnecting stops after the third, and the console says so |
| A `welcome` with another server ID than the linked one | Stops, keeps the credential, and tells the operator to contact support or log out and link again |

### Plan limit pause

When the UltiCloud account exceeds its plan (for example a Pro plan expired with more servers than the free
plan allows, after a 7-day grace period), UltiCloud refuses the connection with HTTP 402 or closes it with
4402. The framework keeps the credential, prints the reason, the end of the grace period and the plan's manage
link once, and then retries quietly every 15 minutes. `/ulticloud status` shows `paused — plan limit reached;
retrying every 15 minutes`. After the owner renews the plan or chooses this server to keep, the next retry
connects, or `/ulticloud reconnect` connects at once. No new login is needed.

## Capability switches

The switches under `ultipanel.capabilities` in `plugins/UltiTools/config.yml` decide what the panel may do.
As of v6.3.1 the server declares to UltiCloud only what they allow, and checks the switch again for every
request.

| Key | Default | Panel feature |
|---|---|---|
| `monitoring` | `true` | Server status and the player, plugin and world snapshots |
| `logs` | `true` | Live console log stream |
| `player-events` | `true` | Player join, leave and command events |
| `file-read` | `true` | Reading and listing files and module configuration |
| `file-write` | `false` | Writing files and module configuration |
| `file-delete` | `false` | Deleting files |
| `commands` | `false` | Remote commands, subject to the blocklist |
| `server-properties` | `false` | Reading and editing `server.properties` |
| `power-actions` | `false` | Stopping and restarting the server from the panel (new in v6.3.1) |
| `player-actions` | `false` | Kicking players, changing their game mode, teleporting them (new in v6.3.1) |

Power and player actions are off by default. A 6.3.0 `config.yml` gains the two new keys once at start-up,
set to `false`; only the missing keys are added, every value and comment the operator wrote stays byte for
byte, and a file layout the framework cannot extend that way gets one warning and keeps both switches off.
Error reports keep their own key, `ultipanel.logging.error-reporting.enabled`. After `/ul reload` a changed
switch takes effect at once, and the server reconnects when the set of declared capabilities changed. See
[Panel Integration](/guide/advanced/panel-integration) for what each feature sends and accepts.

## Upgrading from 6.3.0

The 6.3.0 login used the owner's account token. It no longer works, and nothing migrates automatically:

- At the first start of 6.3.1 the saved 6.3.0 token is deleted from `credentials.json`, with one warning
  ending `Run /ulticloud login to re-attach this server.` The server's install ID in the same file is kept and
  sent with the next device login, so the panel can attach the login to the existing server.
- Run `/ulticloud login` once. The server keeps no other trace of the old login.

## Module API compatibility

`CloudAuthManager` remains internal (`@ApiStatus.Internal`). `UltiCloudRequests`, the 6.3.0 helper that sent
UltiLogin's magic-link requests, is deprecated and removed in 6.4.0. As of v6.3.1 every call answers
`PATH_NOT_ALLOWED` and sends nothing, so UltiLogin 2.0.0's `/panel` stops working; UltiLogin 2.1.0 uses the
[player-link API](/guide/advanced/player-link) instead. A module that wants a player to reach the panel uses
that API; one with secret-carrying commands registers them as sensitive (see
[Panel Integration](/guide/advanced/panel-integration#sensitive-commands)).

The complete list of 6.3.1 changes, deprecations and known limitations is the "UltiCloud protocol 2.0.0" section
of [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md).
