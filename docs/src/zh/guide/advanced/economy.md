# 经济系统

::: info UltiTools 7.0 预览
7.0.0 尚未发布。本页描述 7.0 开发分支的行为。6.x 用户请参阅[归档的 v6.4.0 经济系统指南](/zh/v6.4.0/guide/advanced/economy.html)。
:::

请使用 `com.ultikits.ultitools.utils.EconomyUtils` 的静态方法。Vault 是 `paper-plugin.yml` 中的可选服务器依赖（`required: false`），因此不装 Vault 也能启动 UltiTools。经济操作仍需要 Vault 和已注册的经济提供者。

## 经济状态

UltiTools 启动时会安排输出一条 INFO 日志。无论选择哪种语言，日志都是以下英文原文：

| 状态 | 日志 |
|---|---|
| Vault 未安装 | `[UltiTools-API] Vault not installed - economy service unavailable.` |
| 已安装 Vault，但未注册提供者 | `[UltiTools-API] Vault detected, but no economy provider is registered - economy service unavailable.` |
| 可用 | `[UltiTools-API] Hooked into Vault, economy provider: <provider name>.` |

统一入口通过 Bukkit 的 `ServicesManager` 查询当前的 Vault `Economy` 注册项，不缓存启动时的结果。有多个提供者时，UltiTools 使用 Bukkit 按服务优先级选出的那个，不合并余额、不按模块或币种选择提供者，也不会在操作失败后改用另一个。框架的 `EconomyProvider` 是内部接口，不是公开的注册接口或多币种 API。

## 调用统一入口

涉及玩家的操作支持 `OfflinePlayer` 或 `UUID`（`transfer` 的两个玩家参数类型须相同）。`UUID` 重载通过 Bukkit 查找玩家。

| 方法 | 返回结果 |
|---|---|
| `isAvailable()`、`setup()` | 当前有可用提供者时返回 `true`，否则返回 `false`。两者都不注册提供者。 |
| `getBalance(player)` | 提供者给出的余额；不可用时返回 `0`。仅凭 `0` 无法判断账户余额是否真的为零。 |
| `has(player, amount)` | 提供者给出的结果；不可用时返回 `false`。 |
| `deposit(player, amount)`、`withdraw(player, amount)` | 不可用、金额小于等于零或提供者报告失败时返回 `false`。提款时，提供者的 `has` 检查未通过也返回 `false`。 |
| `transfer(from, to, amount)` | 金额小于等于零、付款方余额检查未通过或扣款失败时返回 `false`。否则先扣款，再入账。收款方入账返回 `false` 时，会尝试退款，然后返回 `false`，但不检查退款结果。这不是原子事务。 |
| `format(amount)` | 由提供者格式化；不可用时使用 `String.format("%.2f", amount)`。 |
| `getCurrencyName()`、`getCurrencyNamePlural()` | 分别返回提供者给出的单数、复数币名；不可用时都返回 `coins`。 |
| `getEconomy()` | 返回 Vault 的原始 `Economy` 实例；不可用时返回 `null`。签名引用了 Vault 类型；代码不应依赖 Vault 类型时，请使用其他方法。 |

服务不可用时的默认值不适用于 Bukkit 或提供者抛出的异常。这些异常可能直接传给调用方；例如，收款方入账抛异常时，转账不会尝试退款。即使之前检查过服务可用，也要检查操作结果：

```java
import com.ultikits.ultitools.utils.EconomyUtils;

// 方法内已有一个名为 player 的 OfflinePlayer：
if (EconomyUtils.withdraw(player, 10.0)) {
    // 扣款成功后再交付购买的物品。
}
```

## 外部 JavaPlugin 调用方

声明对 UltiTools 的依赖，并在 `onEnable()` 中调用 `UltiToolsAPI.connect(this)`。经济操作使用同一组 `EconomyUtils` 静态方法；`UltiToolsAPI` 没有单独的经济接口。若在 `onDisable()` 中显式断开连接，调用 `UltiToolsAPI.disconnect(this)`。接入方式见[外部插件 API](./external-plugin-api.md)。

## 服务不可用警告

同一次服务器运行期间，每个识别出的模块名或外部插件名首次请求不可用的经济服务时，会输出一条 WARNING。归属以调用栈中最近的匹配帧为准；在该帧中，最具体的包优先。已加载模块提供扫描包和主类所在的包；注册中的模块在注册线程上提供同样的包；外部插件连接期间提供其扫描包。最具体的包有归属冲突或没有匹配帧时，调用方记为未知；能辨认调用包时，未知调用方按包去重。请把模块主类放进专用包：宽泛的包根也会匹配子包，可能把无关调用记到你的模块名下。

警告也是固定的英文。以下模板两处 `<name>` 使用同一名称，归属不明时原文是 `an unknown caller`。`<cause>` 的原文是 `Vault is not installed on this server` 或 `Vault is installed, but no economy provider is registered with it`。

```text
[UltiTools-API] Module '<name>' requested the economy service, but <cause>. This is the server's environment, not a defect in UltiTools or in '<name>'. Install Vault and an economy plugin (e.g. EssentialsX) that registers a Vault economy provider to enable economy features.
```
