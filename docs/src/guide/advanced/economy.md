# Economy

::: info As of v7.0.0
This page describes the economy API in UltiTools-API 7.0. For 6.x, see the [archived v6.5.0 economy guide](/v6.5.0/guide/advanced/economy.html).
:::

Use the static methods on `com.ultikits.ultitools.utils.EconomyUtils`. Vault is an optional server dependency in `paper-plugin.yml` (`required: false`), so UltiTools can start without it. Economy operations still need Vault and a registered economy provider.

## Economy states

UltiTools schedules one INFO message at startup. Its text is English regardless of the configured language:

| State | Message |
|---|---|
| Vault not installed | `[UltiTools-API] Vault not installed - economy service unavailable.` |
| Vault present, no registered provider | `[UltiTools-API] Vault detected, but no economy provider is registered - economy service unavailable.` |
| Available | `[UltiTools-API] Hooked into Vault, economy provider: <provider name>.` |

The façade looks up the current Vault `Economy` registration through Bukkit's `ServicesManager`; the startup result is not cached. If several providers are registered, UltiTools uses the one Bukkit selects by service priority. It does not combine balances, select a provider per module or currency, or try another provider if an operation fails. The framework's `EconomyProvider` interface is internal, not a public registration or multi-currency API.

## Calling the façade

The player operations accept `OfflinePlayer` or `UUID` (`transfer` takes two players of the same type). The UUID overloads resolve players through Bukkit.

| Method | Result |
|---|---|
| `isAvailable()`, `setup()` | `true` if a provider is currently available; `false` otherwise. Neither registers a provider. |
| `getBalance(player)` | Provider balance, or `0` when unavailable. A zero alone does not prove that the account is empty. |
| `has(player, amount)` | Provider's answer, or `false` when unavailable. |
| `deposit(player, amount)`, `withdraw(player, amount)` | `false` when unavailable, when the amount is non-positive, or when the provider reports failure. Withdrawal also returns `false` if the provider's `has` check fails. |
| `transfer(from, to, amount)` | Returns `false` for a non-positive amount, a failed funds check, or a failed withdrawal. Otherwise withdraws first, then deposits. If the recipient deposit returns `false`, it attempts to refund the sender and returns `false` without checking the refund result. This is not an atomic transaction. |
| `format(amount)` | Provider formatting, or `String.format("%.2f", amount)` when unavailable. |
| `getCurrencyName()`, `getCurrencyNamePlural()` | Provider's singular and plural names respectively; both fall back to `coins`. |
| `getEconomy()` | Raw Vault `Economy`, or `null` when unavailable. Its signature uses a Vault type; prefer the other methods if your code must not depend on Vault classes. |

The unavailable-service defaults do not handle exceptions thrown by Bukkit or the provider. Those exceptions can propagate; in particular, an exception from the recipient deposit does not trigger the transfer refund. Check the operation's result even if an earlier availability check succeeded:

```java
import com.ultikits.ultitools.utils.EconomyUtils;

// Inside a method with an OfflinePlayer named player:
if (EconomyUtils.withdraw(player, 10.0)) {
    // Grant the purchase only after a successful withdrawal.
}
```

## External JavaPlugin consumers

Declare the UltiTools dependency and call `UltiToolsAPI.connect(this)` from `onEnable()`. Use the same static `EconomyUtils` methods; there is no economy accessor on `UltiToolsAPI`. If you disconnect explicitly in `onDisable()`, call `UltiToolsAPI.disconnect(this)`. See [External Plugin API](./external-plugin-api.md) for setup.

## Unavailable-service warnings

The first unavailable request per attributed module or external plugin name in a server session produces a WARNING. The closest matching call-stack frame is used. Within that frame, the most specific package wins: loaded modules contribute their scan packages and the main class's package, a module being registered contributes those roots on its registering thread, and an external plugin contributes its scan package while connected. If the best package has conflicting owners or no frame matches, the caller is unknown. Unknown callers are deduplicated by caller package when it can be determined. Keep your main class in a package dedicated to your module: a broad package root also matches its subpackages and may attribute unrelated calls to your module.

The warning is also fixed English. In the template below, `<name>` is used in both positions and is literally `an unknown caller` when attribution fails. `<cause>` is either `Vault is not installed on this server` or `Vault is installed, but no economy provider is registered with it`.

```text
[UltiTools-API] Module '<name>' requested the economy service, but <cause>. This is the server's environment, not a defect in UltiTools or in '<name>'. Install Vault and an economy plugin (e.g. EssentialsX) that registers a Vault economy provider to enable economy features.
```
