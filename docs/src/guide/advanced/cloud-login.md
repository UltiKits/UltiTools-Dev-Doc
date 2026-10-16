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

## Authenticated requests on a module's behalf (as of v6.3.0)

The framework never gives a module the server's UltiCloud credential. As of v6.3.0 a module that needs
UltiCloud to recognise a request as coming from this server asks the framework to send it:
`com.ultikits.ultitools.utils.UltiCloudRequests` attaches the credential to one connection it opens
itself and returns only the HTTP status and response body. UltiLogin's `/panel` web login link is the
first module that uses it.

The helper sends exactly two requests:

| Method | Path | Call |
|---|---|---|
| `POST` | `/auth/magic-link` | `UltiCloudRequests.post("/auth/magic-link", jsonBody)` |
| `GET` | `/auth/magic-link/poll` | `UltiCloudRequests.get("/auth/magic-link/poll", query)` |

Each call returns a `UltiCloudRequests.Result`. Its `getOutcome()` is one of four values:

| Outcome | Meaning | Request made |
|---|---|---|
| `OK` | An HTTP exchange completed, whatever its status. Read `getStatusCode()` and `getBody()`. | yes |
| `NOT_CONNECTED` | The server has no valid UltiCloud session: `/ulticloud login` was never run, `/ulticloud logout` was run, or the saved credential has expired. | no |
| `PATH_NOT_ALLOWED` | The method and path are not one of the two above. | no |
| `IO_ERROR` | The exchange could not complete (connection refused, timeout, read failure), or no UltiCloud API address is configured. | attempted, or none when no address is configured |

The path must match exactly. Another path, an allowed path with the other method, or a path that
contains `..`, `//`, `\`, `%`, `?` or `#` returns `PATH_NOT_ALLOWED`. Query parameters go only through
the `query` map, which the helper URL-encodes as UTF-8. The list grows only through a documented
change in a framework release; a module cannot add to it.

Handle `NOT_CONNECTED` as an ordinary state, not an error: an operator may run the server without
UltiCloud at all. UltiLogin, for example, falls back to its request without a credential in that case.

Both methods block on network I/O, with a 10-second connect timeout and a 30-second read timeout, and
throw `IllegalStateException` when called on the server's primary thread. Call them from an
asynchronous task and return to the primary thread to act on the result.

The credential stays inside the framework. It is not returned, the framework never logs it, and it is not
placed in an exception message that reaches your module or in `Result.toString()`, and no public member of the helper is typed `TokenEntity`. The
helper does not follow redirects, so a `Location` header can never make it send the credential to
another host; a 3xx response comes back as an `OK` result with that status. The helper writes no file
and no log line.

One limit lies outside the framework: the JDK's own HTTP client logger,
`sun.net.www.protocol.http.HttpURLConnection`, prints request headers, the credential included, when it
is set to `FINE` or lower. Its default level does not. Do not enable that logger on a production server.
