# 支持 1.21 以下的服务端

::: info 自 v6.4.0 起（草稿）
本页描述 6.4.0 的兼容性目标，不代表已经发布的兼容性保证。
请使用配套的框架和模块构建，详见 [6.4.0 更新说明](/zh/guide/release-notes/6.4.0)。
:::

## 服务端与框架要求

自 v6.4.0 起，五个受影响的模块（UltiKits、UltiLogin、UltiMail、UltiRemoteBag 和 UltiTrade）以框架支持的最低版本 Paper 1.19.2 build 163 为目标。在 Minecraft 1.21 以下，它们要求 UltiTools 6.4.0 或以上版本。在这些服务端搭配旧框架时，目标行为是提示升级并拒绝启动，而不是等玩家打开界面才出错。在 Minecraft 1.21 及以上，这项兼容性要求不会把它们的框架最低要求从 6.3.x 提高。

这些要求不代表所有服务端都提供相同能力。模块各自的降级行为列于更新说明草稿。普通 Spigot 不属于支持的服务端。

## 加载期二进制适配

自 v6.4.0 起，UltiTools 在加载类时适配模块字节码。`InventoryView` 在 Paper 1.19.2–1.20.6 中是抽象类，从 1.21 起是接口。针对接口编译的模块在旧服务端执行物品栏调用时，原本可能抛出 `IncompatibleClassChangeError`。

框架使用一条通用规则，将调用指令种类与运行中服务端的类型对齐，而不是维护针对 `InventoryView` 的专用清单。方法名、描述符和接收对象不变。例如，运行时所属类型是类时，接口调用会改为虚方法调用。这只修复二进制形态，不补充缺失方法。不需要也不提供服主配置开关。

加载器基础见[框架 PR #806](https://github.com/UltiKits/UltiTools-Reborn/pull/806)，通用对齐规则见[框架 PR #809](https://github.com/UltiKits/UltiTools-Reborn/pull/809)。

## 启动诊断与边界

自 v6.4.0 起，只有模块自有扫描包内的类中无法解析的服务端 API 引用，才会逐条产生启动 `WARNING`。随模块打包的第三方库则按顶级包各输出一条 `INFO` 汇总。两种情况下模块都继续加载。警告不表示对应路径可用：除非模块自行处理失败，否则调用缺失方法仍可能出错。详见[框架 PR #810](https://github.com/UltiKits/UltiTools-Reborn/pull/810)。

如果 bean 因引用不存在的服务端类而被跳过，另有一条后果警告列出 bean、缺失类以及未注册的处理器。一个缺失的事件参数类型就可能导致整个监听器类的方法反射失败，因此同类中原本受支持的处理器也会丢失。

框架不会替代缺失的服务端能力、重命名事件，也不会在同一个类内隔离处理器。加载成功尤其不代表所有登录保护都可用。存在真正的旧版等价事件时，应由模块选择；不存在时，应明确说明缺失的保护。

## 可选监听器类

自 v6.4.0 起，模块侧的做法是把每个可选事件依赖放入独立监听器类，并置于所有已声明 `scanBasePackages` 字符串前缀之外。公共监听器的方法签名不要引用这些可选类型。只在方法体内加条件判断，不能阻止反射解析参数类型。

例如，`scanBasePackages = {"com.example.login"}` 时，可选监听器应放在 `com.example.compat.login`，而不是 `com.example.logincompat`。后者仍以扫描字符串开头。需要检查每个配置前缀，而不只是模块主包，也不要假定扫描一定按点号边界匹配。

在加载或构造可选监听器之前，先通过名称探测事件：

```java
Class.forName(
        "io.papermc.paper.event.player.PlayerPickItemEvent",
        false,
        getClass().getClassLoader());
```

只有探测成功后，模块才加载、构造并手动注册独立监听器。直接引用可选事件的注册代码也要留在这个边界之后。类不存在时，应选择真正的旧版等价事件或输出点名警告，不能据此声称保护仍然存在。模块卸载时要移除手动注册的监听器。

[UltiLogin PR #84](https://github.com/UltiKits/UltiLogin/pull/84) 和 [PR #85](https://github.com/UltiKits/UltiLogin/pull/85) 使用 `com.ultikits.plugins.compat.login` 实现此模式，避开 `com.ultikits.plugins.login` 扫描前缀。模块独立探测选取物品与打开告示牌事件，并在现代、旧版骑乘监听器中只选择一个注册。

## 验证范围

自 v6.4.0 起，二进制适配和启动警告不能替代在目标服务端上测试模块操作。常规界面、事件驱动保护和物品返还回退路径应分别验证。链接的实现 PR 及其测试说明当前工作，本草稿不宣称最终跨版本真机验收矩阵已经通过。
