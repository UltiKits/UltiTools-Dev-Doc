# Cloud Login

::: warning As of v6.3.0 — unreleased
This page describes the cloud-login lifecycle landing in UltiTools-API v6.3.0, currently on the
`alpha` branch. The three commands and their console output are unchanged from earlier versions.
:::

`/ulticloud login`, `/ulticloud logout`, and `/ulticloud status` connect a server to UltiCloud for
remote management through the UltiPanel dashboard. v6.3.0 changes how the framework tracks a login
internally. It does not change what an operator sees.

## A login is a session

A successful login creates a session. The session holds the credential, the WebSocket connection
to UltiPanel, the reconnect schedule, and the token-refresh schedule as one unit.

A logout replaces the current session with a new, empty one. Everything the old session started
stops mattering the moment it is replaced: an in-flight reconnect attempt, a credential refresh
already in progress, a magic-link poll still waiting for the browser step. None of them can write
a result back into a session that logout has already retired, no matter how long they were already
running before the logout command reached the server.

This is why logout is unconditional. It tears down the connection, the reconnect schedule, and the
refresh schedule even if the saved credential has already expired — an expired credential is exactly
the case where an operator most needs logout to actually stop things, and the previous
implementation could leave a connection open past the point where the credential backing it was no
longer valid.

## What an operator sees

The three commands and their console output are unchanged:

| Command | What it does |
|---|---|
| `/ulticloud login` | Requests a magic link, prints it to the console, waits for the browser step to complete |
| `/ulticloud logout` | Tears down the connection and clears the saved credential |
| `/ulticloud status` | Reports whether the server is currently connected, and to which account |

An operator who ran these commands on an earlier version sees the same messages. Nothing about the
session change is visible from the console.

## What this does not change

`CloudAuthManager`, the class implementing this lifecycle, is internal to the framework
(`@ApiStatus.Internal`) and was never part of the public API surface module authors write against.
No module needs to change anything for this release.
