# 经济系统

::: warning 自 v6.3.0 起 — 尚未发布
本页描述的行为落地于 UltiTools-API v6.3.0，目前只存在于 `alpha` 分支。如果你运行的是
v6.2.5 或更早版本，`EconomyUtils` 依然存在，但经济不可用时只会静默返回，不会输出下面的状态日志。
:::

UltiTools 把 Vault 的经济 API 当作一个可选的软依赖来集成。服务器不安装 Vault 时，UltiTools
和其他每一个模块都能正常运行：框架本身以及任何非经济模块都不需要经济能力才能工作。模块调用
经济操作时，走的是 `EconomyUtils`，不会直接接触 Vault。

## 经济状态

经济服务始终处于以下三种状态中的一种，服务器启动时控制台会报告当前是哪一种：

| 状态 | 启动时的控制台输出 | 含义 |
|---|---|---|
| Vault 未安装 | `[UltiTools-API] Vault not installed - economy service unavailable.` | 服务器上没有名为 `Vault` 的插件 |
| 没有已注册的提供者 | `[UltiTools-API] Vault detected, but no economy provider is registered - economy service unavailable.` | Vault 已安装，但没有任何经济插件（例如 EssentialsX）向它注册 `Economy` 提供者 |
| 可用 | `[UltiTools-API] Hooked into Vault, economy provider: <provider name>.` | Vault 已安装且有提供者注册 |

这个状态在每次调用时都会重新判断，不是在启动时缓存下来的：框架启动之后才注册的提供者，
下一次调用就能看到。插件加载顺序除声明的依赖关系外并没有其他保证。

## 调用统一入口

模块自己不判断 Vault 是否存在。它调用 `EconomyUtils`，由后者报告当前状态，并在上面三种状态下
都能安全运作：

```java
if (EconomyUtils.isAvailable()) {
    double balance = EconomyUtils.getBalance(player);
    EconomyUtils.withdraw(player, 10.0);
}
```

经济服务不可用时，`EconomyUtils` 的每个操作都返回一个安全的默认值（0、`false`，或一个格式化
好的普通字符串），不会抛出异常；同一个模块在同一次服务器运行期间第一次发起请求时，控制台会
输出一条 WARNING，之后同一模块的请求不会重复输出。这条警告会指出发起请求的模块名，区分
「Vault 未安装」和「Vault 已安装但没有提供者注册」两种原因，明确说明这是服务器自身的环境问题，
不是 UltiTools 或该模块的缺陷，并给出安装建议。模块开发者不需要做任何事去获得这条行为，现有的
每一处 `EconomyUtils` 调用点都已经具备它。

## 本页不涉及的变化

Vault 仍然是 UltiTools 的可选软依赖：`plugin.yml` 依然声明 `softdepend: [Vault]`，对 Vault API
的 Maven 依赖依然是 `provided` 作用域。任何模块调用 `EconomyUtils` 的方式都不需要改变。一个公开
的多币种经济接口正在为未来版本设计，不属于 v6.3.0 的一部分，这一版本中没有任何代码依赖它。
