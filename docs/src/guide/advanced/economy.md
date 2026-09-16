# Economy

::: warning As of v6.3.0 — unreleased
Everything on this page describes behaviour landing in UltiTools-API v6.3.0, currently on the
`alpha` branch. If you are running v6.2.5 or earlier, `EconomyUtils` still exists but reports
unavailability silently instead of logging the states below.
:::

UltiTools integrates with Vault's economy API as an optional, soft dependency. A server without
Vault installed runs UltiTools and every module normally — no economy feature is required for the
framework or any other module to work. A module that does call an economy operation goes through
`EconomyUtils`, never through Vault directly.

## Economy states

The economy service is always in exactly one of three states, and the console reports which one
applies once at server start:

| State | Console line at start | Meaning |
|---|---|---|
| Vault not installed | `[UltiTools-API] Vault not installed - economy service unavailable.` | No plugin named `Vault` is present |
| No provider registered | `[UltiTools-API] Vault detected, but no economy provider is registered - economy service unavailable.` | Vault is present, but no economy plugin (for example EssentialsX) has registered an `Economy` provider with it |
| Available | `[UltiTools-API] Hooked into Vault, economy provider: <provider name>.` | Vault is present and a provider is registered |

The state is re-checked on every call, not cached at start-up — a provider that registers after the
framework has already started is seen on the very next call, since plugin load order gives no
ordering guarantee beyond declared dependencies.

## Calling the façade

A module never checks for Vault itself. It calls `EconomyUtils`, which reports the current state
and behaves safely in every one of the three states above:

```java
if (EconomyUtils.isAvailable()) {
    double balance = EconomyUtils.getBalance(player);
    EconomyUtils.withdraw(player, 10.0);
}
```

When the economy service is unavailable, every `EconomyUtils` operation returns a safe default
(zero, `false`, or a plain formatted string) rather than throwing, and the console logs one
WARNING the first time a given module makes a request in that server session — not on every call.
That warning names the calling module, distinguishes "Vault is not installed" from "Vault is
installed but no provider is registered," states plainly that this is the server's own
environment rather than a defect in UltiTools or in the calling module, and gives the install
instruction. A module author does nothing to opt into this — every existing `EconomyUtils` call
site already receives it.

## What this does not change

Vault stays an optional, soft dependency of UltiTools: `plugin.yml` still declares
`softdepend: [Vault]`, and the Maven dependency on Vault's API is still `provided` scope. No module
needs to change how it calls `EconomyUtils`. A public, multi-currency economy interface is under
design for a future release; it is not part of v6.3.0, and no code in this release depends on it.
