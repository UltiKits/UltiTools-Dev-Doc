# Player Link

::: info As of v6.3.1
The player-link API on this page is new in UltiTools-API v6.3.1 and needs a server linked with `/ulticloud login`.
:::

A player link proves that the person using the UltiCloud web panel owns a game identity on this server.
A module asks for a link when a player runs a command such as `/panel`, shows the player the one-time URL,
and is told later how the web user proved the identity. The module never sees the server's UltiCloud
credential and never talks to UltiCloud over HTTP: the framework carries every message on its own
connection.

The API is `com.ultikits.ultitools.websocket.CloudPlayerLinks`. Get the single instance with
`UltiTools.getInstance().getCloudPlayerLinks()`. It exists from the moment the framework is enabled until it
is disabled, before, during and between connections, and it returns `null` only before the framework has
enabled.

## Requesting a link

`create(requester, playerUuid, playerName, gameAuth, offeredProofs)` sends one request and returns a
`CompletableFuture<LinkCreation>` at once, without blocking, even on the main thread.

| Argument | Meaning |
|---|---|
| `requester` | The calling module, for ownership and diagnostics |
| `playerUuid`, `playerName` | The player's Minecraft UUID and name |
| `gameAuth` | `GameAuth.none()` when no login plugin is involved, or `GameAuth.authPlugin(authenticated, accountExists)` when one authenticates players on this server |
| `offeredProofs` | One to three `LinkProof` values this server can support: `IN_GAME_SESSION`, `LINKED_WEB_ACCOUNT`, `WEB_REGISTRATION` |

The framework fills in whether the server runs in online mode. The gateway decides which of the offered
proofs it accepts and returns them in `acceptedProofs()`.

<!-- UltiCloudDocSnippetsTest: player-link-create -->
```java
public class PanelLinkRequest {

    /** Asks for a link for one player; send the returned text to the player on the main thread. */
    public CompletableFuture<String> request(UltiToolsPlugin module, CloudPlayerLinks links,
                                             UUID playerUuid, String playerName, boolean loggedIn) {
        CloudPlayerLinks.GameAuth auth = CloudPlayerLinks.GameAuth.authPlugin(loggedIn, true);
        return links.create(module, playerUuid, playerName, auth,
                        EnumSet.of(CloudPlayerLinks.LinkProof.IN_GAME_SESSION,
                                CloudPlayerLinks.LinkProof.LINKED_WEB_ACCOUNT))
                .thenApply(creation -> {
                    if (creation.failure() == null) {
                        return "Open " + creation.url() + " within 10 minutes. The link works once.";
                    }
                    switch (creation.failure()) {
                        case NOT_CONNECTED:
                            return "This server is not connected to UltiCloud.";
                        case RATE_LIMITED:
                            return "Too many links were requested. Try again later.";
                        case LINK_NOT_PERMITTED:
                            return "UltiCloud does not allow a link for this server or player.";
                        default:
                            return "No link could be created. Try again later.";
                    }
                });
    }
}
```

The future always completes normally. A failed answer carries a `Failure` and a safe message:

| `Failure` | Meaning |
|---|---|
| `NOT_CONNECTED` | The server has no open UltiCloud connection; nothing was sent |
| `RATE_LIMITED` | The gateway's rate limit was reached; a later attempt may succeed |
| `LINK_NOT_PERMITTED` | The gateway does not issue links: the server is suspended, the owner disabled player links, or the game identity is banned |
| `TIMED_OUT` | The gateway did not answer within 30 seconds |
| `INTERNAL_ERROR` | The gateway answered with an unexpected error |

The future may complete on a framework thread. Switch to the main thread before you call Bukkit API, for
example with `Bukkit.getScheduler().runTask(...)`.

## Link lifetime and expiry

A link is valid for 600 seconds from the moment the gateway issued it and works once. `expiresAt()` is
already converted to this server's clock. Requesting a new link for the same player cancels the previous
one. Using a link does not extend it.

When a link stops being usable, the handler's `onExpired` receives a `LinkExpiry` with one of three
reasons:

| `ExpiryReason` | Meaning |
|---|---|
| `EXPIRED` | Nobody completed the link within its 600 seconds |
| `CANCELLED` | A newer link replaced it, or the plugin or the player cancelled it |
| `DENIED` | The web user refused on the confirmation page |

An expiry is a notice, delivered at most once, and it gets no reply. The framework never invents an expiry:
a link whose `expiresAt()` has passed without any event is the module's to treat as expired.

## Handling completed links

A module registers one `LinkEventHandler` while it enables and removes it when it unloads. The handler's
`onCompleted` receives a `LinkCompletion` and answers what the module did about the game account.

<!-- UltiCloudDocSnippetsTest: player-link-handler -->
```java
public class PanelLinkHandler implements CloudPlayerLinks.LinkEventHandler {

    private final Map<UUID, String> accounts = new ConcurrentHashMap<>();

    /** Call from registerSelf() with UltiTools.getInstance().getCloudPlayerLinks(). */
    public void install(UltiToolsPlugin module, CloudPlayerLinks links) {
        links.setHandler(module, this);
    }

    /** Call from onUnregister(); the framework also releases the handler when the module unloads. */
    public void uninstall(UltiToolsPlugin module, CloudPlayerLinks links) {
        links.removeHandler(module);
    }

    @Override
    public CompletableFuture<CloudPlayerLinks.GameAccountResult> onCompleted(
            CloudPlayerLinks.LinkCompletion completion) {
        if (!completion.provisionGameAccount()) {
            return CompletableFuture.completedFuture(CloudPlayerLinks.GameAccountResult.NOT_REQUESTED);
        }
        // Runs on a framework worker thread: blocking work, such as a database write, is allowed here.
        String previous = accounts.putIfAbsent(completion.playerUuid(), completion.playerName());
        return CompletableFuture.completedFuture(previous == null
                ? CloudPlayerLinks.GameAccountResult.CREATED
                : CloudPlayerLinks.GameAccountResult.ACCOUNT_EXISTS);
    }

    @Override
    public void onExpired(CloudPlayerLinks.LinkExpiry expiry) {
        // Optional: tell the player, if online, that the link can no longer be used.
    }
}
```

`provisionGameAccount()` is `true` when the module has to create a game account for the player, which is
always the case for `WEB_REGISTRATION`; `webUsername()` then names the new UltiKits web account. Answer with
one `GameAccountResult`:

| `GameAccountResult` | When to answer it |
|---|---|
| `CREATED` | The module created the game account |
| `NOT_REQUESTED` | No account was needed |
| `ACCOUNT_EXISTS` | The player already has a game account on this server |
| `REGISTRATION_REJECTED` | This server's own rules refused the account, for example an IP registration cap, a banned name or closed registration |
| `AUTH_PLUGIN_UNAVAILABLE` | No usable in-game login plugin is available, so no account can be created |

`REGISTRATION_REJECTED` and `AUTH_PLUGIN_UNAVAILABLE` are different answers: the first means the login
plugin works and refused this player, the second means there is no login plugin to ask.

## Handler contract

- One module owns the handler at a time. The same module may replace its own handler; `setHandler` from
  another module throws `IllegalStateException` while one is set. `removeHandler` from a module that does
  not own the handler does nothing.
- The framework releases the handler when its module unloads, also when a newer copy of the module fails to
  load.
- `onCompleted` and `onExpired` run on a framework worker thread, never on the main thread or the thread that
  reads the connection. Blocking work is allowed there; Bukkit API calls belong on the main thread.
- A handler that does not answer within 30 seconds, returns `null`, throws, or completes its future
  exceptionally produces no result. The gateway delivers the same completion again after the next
  connection, and the handler is asked again.
- Without a handler, a completion that asks for an account is answered `AUTH_PLUGIN_UNAVAILABLE`, and any
  other completion `NOT_REQUESTED`.
- The handler stays registered across reconnects until the module removes it or unloads.

## Results across restarts

The gateway delivers each completion at least once: until it has the result, it sends the same completion
again after every new connection, for up to 24 hours. The framework records the module's result, writes it
to `<server root>/.ultikits/cloud-outbox.json`, and only then answers the gateway. A completion that arrives
again, also after a restart, is answered from that record without calling the module. A module therefore
needs no persistence of its own for link results.

While the server shuts down, the framework leaves a completion unanswered, so the gateway delivers it again
after the next start and the account is created then.

## Known limitations

::: warning A crash can ask the handler twice
If the server crashes after the handler decided but before the framework wrote the result to disk, the redelivered completion calls the handler again. Make account creation idempotent, as the example does with `ACCOUNT_EXISTS`.
:::

- A result larger than 4 KiB is not stored, so a redelivery asks the module again. The framework's own
  result texts are far below that.
- When the framework cannot resolve its state directory, results are not kept and redeliveries are not
  recognised.

## See also

- [Cloud Login](/guide/advanced/cloud-login): linking the server to UltiCloud
- [Panel Integration](/guide/advanced/panel-integration): module requests from the panel and sensitive commands
