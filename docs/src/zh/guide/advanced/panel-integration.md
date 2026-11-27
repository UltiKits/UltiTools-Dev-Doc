# 面板集成

7.0.0 尚未发布。本页说明自 v7.0.0 起框架如何处理 UltiPanel 集成；发布状态见 [7.0.0 版本说明](/zh/guide/release-notes/7.0.0)。服务器绑定与连接状态见[云端登录](/zh/guide/advanced/cloud-login)。

## UltiCloud 协议 2.1.0 的历史 {#ulticloud-协议-2-1-0}

UltiTools 6.3.1 引入设备码登录与协议 2.1.0。协议变更见 [6.3.1 归档：面板集成](/zh/v6.3.1/guide/advanced/panel-integration.html#ulticloud-协议-2-1-0)，其中也有当时的[敏感命令](/zh/v6.3.1/guide/advanced/panel-integration.html#敏感命令)和[响应器注册](/zh/v6.3.1/guide/advanced/panel-integration.html#拥有一个请求-响应类型-panelresponderregistry)说明。下文说明 7.0 框架处理哪些请求，不规定具体面板部署提供哪些控件。

## 能力开关 {#能力开关}

框架从 `plugins/UltiTools/config.yml` 的 `ultipanel.capabilities` 读取以下开关：

| 键 | 默认值 | 启用后的框架行为 |
|---|---|---|
| `monitoring` | `true` | 发送服务器指标以及玩家、插件和世界快照。 |
| `logs` | `true` | 发送控制台日志行。 |
| `player-events` | `true` | 发送玩家进服、离服和命令事件。 |
| `file-read` | `true` | 允许读取和列出文件，以及读取模块配置。 |
| `file-write` | `false` | 允许写入文件和模块配置。 |
| `file-delete` | `false` | 允许远程删除文件。 |
| `commands` | `false` | 允许远程执行命令，仍受命令黑名单限制。 |
| `server-properties` | `false` | 允许读写 `server.properties` 中准许操作的键。 |
| `power-actions` | `false` | 允许结构化的停服和重启请求，不经过远程命令。 |
| `player-actions` | `false` | 允许踢出玩家、修改游戏模式和传送请求。 |

框架接收请求时检查适用的能力。错误上报使用独立开关 `ultipanel.logging.error-reporting.enabled`，默认 `true`。`/ul reload` 会重载配置；已建立的会话在声明的能力集合改变后会重新连接，模块能力也包含在这个集合内。重载不会重读命令黑名单，也不会应用待生效的模块变更。

## 远程命令黑名单 {#远程命令黑名单}

对不可信的操作员，应保持 `ultipanel.capabilities.commands: false`。开启远程命令时，框架在启动时读取 `ultipanel.commands.blocklist`。要修改黑名单，先停服，编辑 `plugins/UltiTools/config.yml`，然后启动服务器；`/ul reload` 不会更新名单。

默认值为 `op`、`deop`、`stop`、`restart`、`reload`、`ban-ip`、`pardon-ip`、`whitelist`、`save-off`、`save-all`、`execute`、`return`、`function`。缺少该键时使用默认列表；格式不合规时整份列表被拒绝。框架不会扩充已有的有效列表，`[]` 可停用这份可配置的名单。无论名单内容如何，框架都拒绝从面板发起 `/ulticloud login`、`/ulticloud login <code>` 和 `/ulticloud logout`。

### 别名与嵌套命令 {#v6-5-0-的别名与失败处理}

框架检查去掉命名空间后的命令名，不区分大小写。分派前也检查解析出的命令已注册的写法：列入一个别名可能拦截同一命令的其他写法。直接拦截的请求返回 `command_blocked`，`details.matched` 给出匹配的名称。

同步嵌套调用进入框架命令执行器时会再次检查。嵌套拒绝属于普通的命令反馈，不会产生新的 `command_blocked` 结果。如果包装命令换了发送者，反馈不一定出现在外层命令结果里。黑名单不是沙箱，不能拦截任意包装命令、数据包函数或在后续 tick 分派的命令。

### 远程命令的结果 {#远程命令的结果}

框架通过自身调度器的 `global()` 上下文分派面板命令。Paper 的捕获式发送者有控制台权限，但不是控制台发送者本身。要求实际控制台发送者的命令可以拒绝它；框架不会改用控制台重试。

成功时，`command.result` 的 `data.output` 包含分派期间捕获的即时反馈。分派被拒绝时，捕获的反馈改放在 `command_failed` 错误的 `message` 中。即时反馈不会同时回显到控制台。捕获式发送者收到的后续反馈会在结果发出后最多十分钟内转发给控制台，不会补到命令结果里。框架另写审计回显；不计服务端添加的日志前缀，英文随附文本为 `[Remote command] > <command>`，中文为 `[远程命令] > <command>`。在 `language: auto` 下，面板发送者收到的框架命令反馈使用 `fallback-language`。

自 v7.0.0 起，框架的同步命令方法体在全局 tick 线程上运行。`@RunAsync` 和 `@AsyncCommand` 方法体使用框架的 `async()` 上下文，之后的回复不属于分派的即时结果。面板命令处理器会在分派前去掉输入两端的空白。如果你自行分派命令，也应先去掉这些空白：带尾随空格的字面量命令可能在进入恢复逻辑之前就被新解析器拒绝。见 [7.0 命令迁移](/zh/guide/advanced/upgrading-to-7#command-migration)。

## 待生效的模块变更 {#pending-module-changes}

自 v7.0.0 起，`/upm install`、`/upm update` 和 `/upm uninstall` 将变更排到下次启动，不改动正在运行的模块。框架在已连接的会话中处理列出待生效变更以及逐项撤销符合条件条目的请求。`upm:pending` 能力没有独立配置开关。上次启动中失败、未完成或需要在服务器上手动处理的条目不能通过这个接口撤销。

同一连接上若有其他请求占用处理队列，撤销请求可能在超时后才执行。重试前先刷新待生效清单。你也可以在服务器上用 `/upm pending` 查看清单，用 `/upm revoke <module>` 撤销符合条件的一项。`/ul reload` 不会应用清单中的变更；见[在服务器上应用与恢复](/zh/guide/advanced/upgrading-to-7#apply-and-recover)。

## 远程文件与配置 {#远程文件-api-边界}

`ultipanel.files.editable-roots` 默认包含相对于服务器根目录的 `plugins` 和 `logs`。文件能力仍然适用，扩大根目录范围不会开放框架的私有状态目录或远程操作日志。目录列表最多返回 2,000 项，超出时标记为已截断。远程文件 API 不会删除目录。

编辑模块配置不同于直接写文件。模块配置处理器通过 `global()` 执行，并遵守框架的配置写入规则。配置验证、写入被拒绝的情形和变更生效时机，见[配置文件](/zh/guide/essentials/config-file)。

## 远程操作日志与实时日志 {#实时日志流}

框架把远程命令的准入结果记入远程操作日志，与命令回复和实时日志流分开。随附的日志轮转配置为 `ultipanel.logging.action-log.max-size-bytes: 1048576` 和 `ultipanel.logging.action-log.max-files: 5`；远程操作日志没有关闭开关。

`logs` 能力控制实时控制台日志转发。转发的日志行保留生成时的语言，框架不会再次翻译。`config.yml` 中旧的 `ultipanel.logging.batch` 键不控制正在使用的云端日志流；框架大约每秒发送一次 `log.lines`，批次已满也会发送。实时日志处理器挂接时会读取 `ultipanel.logging.levels` 和 `ultipanel.logging.excluded-loggers`。默认级别是 `info`、`warning`、`error`，默认没有配置排除的记录器。以服务器上的日志为准，不要把实时日志流当作完整记录。

## 敏感命令 {#敏感命令}

模块命令如果接受敏感参数，应注册命令名及其所有别名。重复注册无副作用，注册持续到服务器重启；框架的注册表已包含 `ulticloud`。

```java
// In registerSelf(): names and aliases, not full command lines.
UltiTools.getInstance().getSensitiveCommandRegistry().register("privateaction", "paction");
```

`com.ultikits.ultitools.websocket.SensitiveCommandRegistry` 匹配命令名时忽略命名空间和大小写。框架会在转发的日志文本，以及自身生成的远程命令回显、拒绝和审计记录中，把匹配命令的参数替换为 `***`。框架不会改写其他插件打印到本地控制台的文本。不要在命令回复或日志消息中输出敏感值；注册并不提供通用的敏感信息过滤。

## 模块扩展点 {#模块扩展点}

### 请求观察：`PanelMessageEvent` {#观察每一条消息-panelmessageevent}

框架把交给响应器的 `module.request` 作为 `com.ultikits.ultitools.events.PanelMessageEvent` 发布到[模块事件总线](/zh/guide/advanced/module-eventbus)。`getType()`、`getData()` 和 `getRawMessage()` 分别提供解析后的类型、响应器输入和请求信封；JSON 对象是副本。没有匹配响应器的请求，以及不走模块请求路径的框架协议消息，不会产生此事件。

用 `@ModuleEventHandler` 订阅。自 v7.0.0 起，框架通过自身调度器的 `global()` 上下文，在服务器的全局 tick 线程上发布事件。处理器不应长时间占用线程。该事件用于观察，不能取消；事件送达时响应器不一定已经完成。

### 响应器注册：`PanelResponderRegistry` {#拥有一个请求-响应类型-panelresponderregistry}

在 `registerSelf()` 中调用 `UltiTools.getInstance().getPanelResponderRegistry()`。将类型注册为 `<identifier>.<action>`，其中标识符是模块的 UltiCloud 标识符，不是显示名称。框架只会把请求交给目标模块拥有的响应器。模块能力以 `modules:<identifier>@<X.Y.Z>` 声明，版本后缀不用于补足版本号的分段。若握手没有接受该能力，框架会直接拒绝请求，不执行模块代码。

```java
@Override
public boolean registerSelf() {
    UltiTools.getInstance().getPanelResponderRegistry().registerResponder(
            "example.status", data -> CompletableFuture.completedFuture(new JsonPrimitive("ready")),
            getPluginName(), this);
    return true;
}
```

示例假定模块标识符为 `example`；`CompletableFuture` 来自 `java.util.concurrent`，`JsonPrimitive` 来自 `com.google.gson`。第三个参数是所属模块名，第四个参数把注册显式绑定到当前实例。三参数写法优先采用调用线程当前正在加载的实例，否则用与所属模块名匹配的已加载实例（若有）。不要在构造器里只按名称注册。框架在卸载时释放归属于该实例的响应器，并拒绝注册框架保留的类型或重复注册同一类型。

响应器收到 `params` 的副本，其中 `actor` 由请求中单独提供并经校验的操作者对象替换。返回一个包含 JSON 值的 future；以 `null` 完成表示成功，结果为 `data: null`，而不返回 future、抛出异常或以异常完成都算失败。找不到响应器时返回 `module_not_found`，超过期限时返回 `deadline_exceeded`。响应只在接收该请求的连接上发出，不会在重连后转发到新连接。

响应器在注册表的工作线程上运行，不占用全局 tick 线程或连接读取线程。同一类型的多次调用也可能重叠。注册表允许四个工作线程同时调用响应器、最多 64 个请求等待；三秒期限包括排队、调用和等待 future 完成。超时不会中断被阻塞的工作线程。需要调用服务端 API 时，用模块注入的 `Scheduler` 切换到拥有该状态的上下文，例如全局状态用 `scheduler.global().supply(...)`，玩家状态用 `scheduler.entity(player)`。见 [7.0 调度](/zh/guide/advanced/upgrading-to-7#scheduler-and-screens)。
