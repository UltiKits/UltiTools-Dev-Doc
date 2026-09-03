# 面板集成

::: warning 自 v6.3.0 起 —— 尚未发布
本页描述的全部行为都在 UltiTools-API v6.3.0 中落地，目前只存在于 `alpha` 分支。
如果你运行的是 v6.2.5 或更早版本，下面的配置键与类都还不存在。
:::

UltiTools 通过 WebSocket 连接到 UltiPanel 远程管理平台。自 v6.3.0 起，这条连接有四处变化：
每一项面板可用能力都变成运营者可见的开关；远程命令过滤变成运营者可编辑的黑名单；远程文件
API 被限定在一组显式的可编辑根目录内，并附带一层不可配置打开的凭据排除；模块现在可以观察
或应答面板消息，而无需框架再造出第二套分发机制。

## 能力开关

每一项面板可用能力都由 `plugins/UltiTools/config.yml` 中 `ultipanel.capabilities` 下的一个
开关控制：

```yaml
ultipanel:
  capabilities:
    monitoring: true          # TPS、内存、世界/玩家快照
    logs: true                # 实时控制台日志流 + 控制
    player-events: true       # 上线/下线/聊天事件
    file-read: true           # 在可编辑根目录内读取与列出文件
    file-write: false         # 在可编辑根目录内写入/上传文件
    file-delete: false        # 在可编辑根目录内删除文件/目录
    commands: false           # 远程命令执行，仍受黑名单约束
    server-properties: false  # 读取/编辑 server.properties 的安全白名单键
```

`list` 操作由 `file-read` 控制——列出即是读取，因此没有单独的第九项能力。

**默认值按读写拆分，而非统一。** `monitoring`、`logs`、`player-events`、`file-read` 默认开启；
`commands`、`file-write`、`file-delete`、`server-properties` 默认关闭。这是刻意为之：
`monitoring` 的状态数据是面板唯一的"服务器在线"信号，若默认关闭会让升级后的服务器显示为
*离线*，而不仅仅是"未配置"——这是最糟糕的失败方式，因为症状会把运营者指向错误的方向。
`error-reporting`（位于 `ultipanel.logging.error-reporting` 下）**不属于**这八项能力之
一——它保留自己原有的配置键路径与默认值，本次发布不做改动。

**关闭某项能力会产生明确拒绝，绝不会静默失败。** 响应会指明具体的配置键与文件，例如：

```
Blocked by capability policy: 'file-write' is disabled — edit
ultipanel.capabilities.file-write in plugins/UltiTools/config.yml to change this.
```

## 远程命令黑名单

远程命令执行（受上方 `commands` 能力开关控制）另外还受一份运营者可编辑黑名单的过滤：

```yaml
ultipanel:
  commands:
    blocklist:
      - "op"
      - "deop"
      - "stop"
      - "restart"
      - "reload"
      - "ban-ip"
      - "pardon-ip"
      - "whitelist"
      - "save-off"
      - "save-all"
```

v6.3.0 之前，这份名单是一份硬编码、不可配置的十条条目集合。自 v6.3.0 起，它迁移到
`ultipanel.commands.blocklist`，并且可以双向自由编辑——运营者可以新增条目，也可以移除任意
条目，包括清空整份列表。

**这里刻意没有设置不可覆盖的强制底线。** 面板是运营者自己的远程控制台，不是自主代理；一条
硬编码底线约束的对象是运营者本人，而非攻击者——已经攻陷面板凭据的人已经拿到了运营者本人的
身份，能通过其他游戏内手段达到同样的效果，因此底线只会限制运营者自己合法的配置选择。配套的
补偿控制是下方的[远程操作日志](#远程操作日志)，无论这份名单内容如何，它都会记录面板执行的
每一条命令。本页不列举清空该名单后具体哪些命令会变得可达。

黑名单拒绝会指明原因与解决办法，例如：

```
Blocked by the blocklist — edit ultipanel.commands.blocklist in
plugins/UltiTools/config.yml to change this.
```

命令命名空间归一化不受本次变化影响：`bukkit:op` 与 `op` 在检查前会解析为同一个黑名单条
目，检查点仍是原来唯一执行该归一化的位置。

## 远程文件 API 边界

远程文件 API（`file-read`/`file-write`/`file-delete`）被限定在一组显式的可编辑根目录内，
默认覆盖插件配置与历史日志：

```yaml
ultipanel:
  files:
    editable-roots:
      - "plugins"
      - "logs"
```

可编辑根目录回答"在哪"；上方的能力开关回答"能做什么"。这是两条正交的轴——一个请求必须
同时通过两者。

**在这些根目录内部，还有一层不可配置打开的、基于模式的凭据排除。** 一小组通配模式与精确
文件名——覆盖密钥/证书类文件扩展名与若干已知的凭据文件名——会在可编辑根目录检查之前生效，
适用于每一次远程文件操作，无论运营者授予了哪些根目录。即使把某个包含凭据文件的目录重新加
为根目录，也不会重新打开对那个具体文件的访问。

**拒绝始终指明两种可区分原因之一**，绝不会合并成一句笼统的话：

- **可配置** —— 目标在可编辑根目录集合之外。消息会指向 `ultipanel.files.editable-roots`。
- **不可配置** —— 目标命中了无条件的凭据排除。消息会明确说明这一点，而不是指向一个并不存
  在的开关。

**`list` 会标记被拒绝的条目，而不是直接省略它们。** v6.3.0 之前，调用方无权查看的条目会被
静默从列表中剔除，面板无法区分"这个文件不存在"与"这个文件被策略隐藏"。自 v6.3.0 起，每个
条目都携带一个 `accessible` 布尔值；被拒绝的条目额外携带 `reason`，取值为
`PROTECTED_CREDENTIAL` 或 `OUTSIDE_ROOTS`，且不再携带
`size`/`lastModified`/`readable`/`writable`。这是一次向后兼容的模式新增——不了解这些新字
段的旧版面板会照旧渲染之前渲染的内容，外加此前被隐藏的那些行。

**递归删除目录现在要求请求显式携带 `recursive: true`。** v6.3.0 之前，一个指向目录的
`delete` 请求会递归删除该目录及其全部内容，没有任何标志，也没有任何确认。自 v6.3.0 起，缺
少该字段、该字段为 `false`，或该字段不是真正的 JSON 布尔值的目录删除请求，都会在触碰文件
系统之前被拒绝，并指明缺失的字段。尚未发送该字段的旧版面板，其每一次目录删除请求都会被明确
拒绝。

## 凭据文件位置 <Badge type="tip" text="v6.3.0+" />

框架自身的 UltiCloud 凭据文件——面板连接令牌，不是任何模块拥有的东西——自 v6.3.0 起搬了
位置。这是运营者可见的变化：它改变了备份或迁移服务器时需要复制凭据的位置。

| | 位置 |
|---|---|
| v6.3.0 之前 | `plugins/UltiTools/data.json` |
| v6.3.0 及以后 | `<服务器根目录>/.ultikits/credentials.json` |

**迁移是自动的，只在升级后首次读写凭据时发生一次**——没有单独的迁移命令要运行。这个流程
在结构上就是失效安全的：先读取旧文件，再写入新文件，随后读回新文件确认写入无误，只有到这一
步才会删除旧文件。如果写入在任何环节失败，旧文件会原封不动地留在原处，框架也会回退使用它——
一次失败的迁移永远不会丢失凭据，只会让运营者停留在旧位置，直到下一次迁移成功。

新位置位于上方所有默认可编辑根目录之外，并且——和此前的 `data.json` 一样——同样受那道无条
件的、基于文件名的凭据排除保护，无论运营者配置了哪些根目录。远程文件 API 会同时拒绝访问新
位置，以及升级重启窗口期间的旧位置。

**`CloudAuthManager` 上三个内部凭据协调静态方法已宣布将在 v6.4.0 移除。**
`currentCredentialGeneration()`、`invalidateCredentialOperations()` 与
`commitTokenIfCurrent(TokenEntity, long)` 从来都不是受支持的外部 API——它们协调的是框架自身
的异步凭据生产者与其拆除路径，标注了 `@Deprecated(since = "6.3.0", forRemoval = true)` 与
`{@removeIn 6.4.0}` javadoc 标签。三者的签名与行为在 v6.3.0 中保持不变；它们原本隐含的凭据
文件 I/O 现在都经由上文所述的内部存储完成。如果你的模块调用了其中任何一个，请在 v6.4.0 之前
停止使用——公开的面板集成或外部插件 API 表面都不依赖它们。

## 远程操作日志

每一次通过能力开关与黑名单检查的远程操作——无论被允许还是被拒绝——都会作为一行结构化记录写
入 `plugins/UltiTools/security/action.log`，包含时间戳、能力、动作、目标、判定结果
（`allowed`/`denied`）与原因。该日志本身落在上文所述的同一层无条件凭据排除范围内，因此无法
通过远程文件 API 删除或关闭。它自己的轮转是可配置的——但"面板做过什么"这份记录不是：

```yaml
ultipanel:
  logging:
    action-log:
      max-size-bytes: 1048576  # plugins/UltiTools/security/action.log 达到该大小后轮转
      max-files: 5             # 保留的轮转文件数量
```

这里刻意没有可以完全关闭该日志的配置键。

## 模块扩展点

现在，模块无需框架再造出与既有 24 种消息类型的分发表并列的第二套分发机制，就能对面板消息
做出反应。

### 观察每一条消息：`PanelMessageEvent`

`com.ultikits.ultitools.events.PanelMessageEvent` 会在既有的[模块事件总线](/zh/guide/advanced/module-eventbus)
上发布，作为处理每一条入站面板消息——包括框架自身并不拥有的消息类型——的最后一步。订阅方式
与订阅其他任何 `ModuleEvent` 完全一致：

```java
@ModuleEventHandler
public void onPanelMessage(PanelMessageEvent event) {
    String type = event.getType();
    JsonObject data = event.getData();
    // 处理器运行在主线程——在这里调用 Bukkit API 是安全的
}
```

关于这个事件，有两点是刻意设计的，使用前值得了解：

- **处理器运行在主线程上。** 框架在桥接处通过 `Bukkit.getScheduler().runTask(...)` 把发布
  调度到主线程，而不是 `publishAsync`——`publishAsync` 提交到异步线程池，根本不会到达主线
  程，因此无法让处理器安全地调用 Bukkit API。这里一个慢处理器造成的服务器 tick 开销，与任
  何其他运行在 Bukkit 主线程上的事件完全一样；当一次发布耗时超过一个较小的固定阈值时，框
  架会记录一条指明消息类型的告警日志，但没有任何机制阻止处理器变慢。
- **该事件不是 `Cancellable`。** 它在分发结束、框架已经对消息采取行动之后才发布——此时的
  取消标志不会产生任何效果。这与 `EventBus.publishAsync` 本身已经无条件拒绝 `Cancellable`
  事件的做法出于同一个理由：一个不产生任何效果的可调用方法，正是 UltiTools-API v6.3.0 要
  清除的"声明了却不可用"这类缺陷。

事件上的数据在传入时以及每次访问器调用时都会被防御性拷贝——处理器对收到内容的修改，既不
会影响下一个处理器看到的内容，也不会影响框架已经采取的行动。

### 拥有一个请求/响应类型：`PanelResponderRegistry`

对于框架**尚未**处理的面板消息类型，模块可以通过
`com.ultikits.ultitools.websocket.PanelResponderRegistry` 注册唯一一个 responder，直接应
答请求：

```java
UltiTools.getInstance().getPanelResponderRegistry()
    .registerResponder("my_module:status", data -> {
        JsonObject reply = new JsonObject();
        reply.addProperty("state", "ok");
        return CompletableFuture.completedFuture(reply);
    }, "MyModule");
```

- **每个类型只能有一个所有者。** 注册一个框架已经服务的类型（框架内置的 24 种消息类型之
  一）会立即抛出异常，并指明框架是既有所有者；注册一个另一个模块已经拥有的类型也会立即抛
  出异常，并指明那个模块。这是硬性检查，不是建议——不存在"后注册者静默生效"的兜底行为。
- **responder 返回 `CompletableFuture<JsonObject>`。** 框架会把解析结果（或失败）包装上请
  求的 `requestId` 并发回给面板——你无需直接接触 WebSocket 连接。
- **一个有界超时，只在一处生效。** 如果 responder 的 future 在几秒内未完成，框架会代替
  responder 完成回复，附带一条明确的超时错误，而不会让面板的请求无限期挂起。
- **模块卸载时，responder 会自动注销**，与框架自动注销该模块 `EventBus` 订阅的同一时机
  一致。

框架不强制要求 `<模块>:<类型>` 这样的命名空间前缀——那将是面板一侧也需要遵守的跨仓库协议
约定，而不是框架单方面能强制的东西。不过采用带命名空间的类型字符串（如上例）仍是值得遵循
的约定，可以避免与其他模块自己的消息类型发生冲突。

## 参见

- [模块事件总线](/zh/guide/advanced/module-eventbus) —— `PanelMessageEvent` 所依托的底层
  发布/订阅机制。
