# 面板集成

::: info 自 v6.3.0 起
以下能力和 API 已在 UltiTools-API v6.3.0 中提供。此前版本已存在的行为，其所在小节会说明变化。
:::

UltiTools 通过 WebSocket 连接到 UltiPanel 远程管理平台。自 v6.3.0 起，这条连接有五处变化：
每一项面板可用能力都变成运营者可见的开关；远程命令过滤变成运营者可编辑的黑名单；远程文件
API 被限定在一组显式的可编辑根目录内，并附带一层不可配置打开的凭据排除；
面板无法再启动、停止、暂停或恢复实时日志流，日志批量发送的间隔与 `debug` 级别配置开始生效，日志级别过滤也不再拦截由日志记录产生的错误上报；
模块现在可以观察或应答面板消息，而无需框架再造出第二套分发机制。

自 v6.3.1 起，这条连接使用 UltiCloud 协议 2.0.0，由此带来的变化见下文 [UltiCloud 协议 2.0.0](#ulticloud-协议-2-0-0)。模块还可以让带密码类参数的命令不把参数发往云端（[敏感命令](#敏感命令)），并应答面板的模块请求（[拥有一个请求/响应类型](#拥有一个请求-响应类型-panelresponderregistry)）。

## UltiCloud 协议 2.0.0

自 v6.3.1 起，服务器通过设备码接入（见[云端登录](/zh/guide/advanced/cloud-login)），框架通过 UltiCloud 协议 2.0.0 连接 `wss://api.ultikits.com/v1/agent`。本页介绍的能力开关、命令黑名单、可编辑根目录及其凭据排除、远程操作日志都照常生效。下文某些小节提到的 6.3.0 线上消息，例如 `command_result`、`log_stream`、`update_config`、`set_all`，已不复存在；凡是小节描述这类消息之处，以本节所述的 6.3.1 行为为准。

服务器在握手中只向 UltiCloud 声明开关允许的能力，并对每个请求再次检查开关。开关关闭时，请求以 `capability_not_accepted` 被拒绝，并指明配置键。

| 开关 | 6.3.1 中面板得到什么、可以做什么 |
|---|---|
| `monitoring` | `status` 以及玩家、插件、世界快照；`snapshot.request` 先推送所请求的快照，再回复 |
| `logs` | `log.lines` 批次，每秒或批次满时发送，不超过 UltiCloud 为本连接设定的速率；超出的行在服务器上丢弃 |
| `player-events` | 进服、离服事件（在 UltiCloud 确认之前保存在可靠发件箱中），以及只带命令名的 `player.command` 事件 |
| `ultipanel.logging.error-reporting.enabled` | `error.report` |
| `commands` | 自 v6.3.1 起，`command.execute` 在执行之前先确认，即时输出只在 `command.result` 的 `data.output` 中回复，不回显到服务器控制台、日志文件或面板实时日志流；之后打印的行写入服务器控制台与日志流 |
| `player-actions` | `player.action`：踢出、修改游戏模式、传送到某位玩家或某个坐标（v6.3.1 新增，默认关闭） |
| `file-read` | `files.list`、`files.read`，以及读取已加载模块的配置文件（`config.tree`、`config.entries`） |
| `file-write` | `files.write` 与 `config.update` |
| `file-delete` | `files.delete` |
| `server-properties` | `properties.get` 与 `properties.update` |
| `power-actions` | `server.power`：停止或重启（v6.3.1 新增，默认关闭） |

`files.read` 返回 `version`，即文件原始字节的 SHA-256。`files.write` 与 `config.update` 必须把读到的 `version` 作为 `baseVersion` 发回；其间文件已改动时以 `file_changed` 拒绝，什么也不写。`files.write` 覆盖一个已存在的文件，`files.delete` 删除文件、从不删除目录，超过 2000 项的列表会被截断并标注。`config.update` 只写它指定的键，并经过配置写入闸门。`properties.get` 读取 14 个常用键，`properties.update` 可以写其中 12 个；`online-mode` 与 `white-list` 对面板保持只读。

通过 `server.power` 重启需要 `spigot.yml` 中 `restart-script` 指向的文件存在，否则以 `power_unsupported` 拒绝，服务器继续运行。电源请求在服务器停止之前得到回复，并且不经过命令黑名单。`power-actions` 关闭时面板会把电源按钮置灰；执行 `/ul reload` 后，改动的值会立即报告给面板。

面板无法再启动、停止、暂停或重新配置日志流，因为协议 2.0.0 没有这样的消息；`levels` 与 `excluded-loggers` 两个键仍然生效。不提供备份功能：6.3.1 从不声明这项能力。

从 UltiTools 开始禁用的第一步起，所有会改变服务器状态的请求都以「服务器正在关闭」的失败被拒绝，只读请求在连接关闭之前照常工作。命令或电源请求先被确认、再失败，因此重启后不会再次执行。禁用过程最多等待 5 秒，让已经开始的改动完成。需要服务器线程、恰在停服开始前到达的请求可能得不到回复，面板随后报告超时，服务器上什么也没有改变。

## 能力开关

每一项面板可用能力都由 `plugins/UltiTools/config.yml` 中 `ultipanel.capabilities` 下的一个
开关控制：

```yaml
ultipanel:
  capabilities:
    monitoring: true          # TPS、内存、世界/玩家快照
    logs: true                # 实时控制台日志流
    player-events: true       # 上线/下线与命令事件，无聊天事件（自 v6.3.1 起）
    file-read: true           # 在可编辑根目录内读取与列出文件
    file-write: false         # 在可编辑根目录内写入/上传文件
    file-delete: false        # 在可编辑根目录内删除文件（自 v6.3.1 起从不删除目录）
    commands: false           # 远程命令执行，仍受黑名单约束
    server-properties: false  # 读取/编辑 server.properties 的安全白名单键
    power-actions: false      # 停止/重启服务器（自 v6.3.1 起）
    player-actions: false     # 踢出、游戏模式、传送（自 v6.3.1 起）
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

自 v6.3.0 起，这个值会先作为一个整体检查，通过后才会替换现有名单。它必须是一个列表，且每个元素都是字符串；条目会去掉首尾空白，并按小写比较。其他形态会被整体拒绝：单个字符串、映射，或者包含映射、嵌套列表、null 元素、数字、布尔值的列表。字符串元素始终被接受，包括空字符串。此时框架只记录一条警告，写明 `ultipanel.commands.blocklist` 和发现的形态（不写出值本身），并继续使用已有的名单（刚启动时是十条默认条目）。显式的空列表（`blocklist: []`）是合法的，表示不拦截任何命令；缺少这个键时保持当前策略。框架不会为了纠正某个值而改写 `config.yml`。

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

### 远程命令的结果

自 v6.3.0 起，面板的远程命令以服务器控制台的身份运行，等同于在控制台中输入该命令，模块看到的仍是通常的控制台发送者。框架不捕获命令的回复：`command_result` 消息只说明命令已分派，文本为 `Command dispatched to the server console. Its output appears in the server log stream.`；分派返回 false 时为 `The server console did not accept the command. Any message it printed appears in the server log stream.`。回复本身与其他所有控制台输出一起，通过[实时日志流](#实时日志流)到达面板，因此需要开启 `logs` 能力才能看到。黑名单拒绝、空命令与分派错误的报告方式不变。v6.3.0 之前，被接受的命令结果里携带的是编造的 `Command executed successfully`（被拒绝的为 `Command execution failed`），而不是回复。把 `output` 当作命令回复来显示的面板或工具，现在显示的是上面这句话。

自 v6.3.1 起，命令以 Paper 的捕获式命令发送者运行，它拥有控制台的权限；`command.result` 携带命令在分派返回之前向这个发送者打印的各行，行数与字符数有上限，被截断时标注 `truncated`。自 v6.3.1 起，即时回复只进入 `command.result` 的 `data.output`，不回显到服务器控制台、日志文件或面板实时日志流。控制台记录的是 `[UltiTools] [Remote command] > <command>` 审计行，而不是即时回复的副本。命令之后才打印的行（例如异步执行体打印的）不在结果中：框架把它们原样写入服务器控制台，因此它们经[实时日志流](#实时日志流)到达面板，敏感命令与其他控制台行一样被脱敏。这种转发在结果发出后持续 10 分钟；更晚打印的行会被丢弃，并记一条指明该命令的警告。服务器不接受的命令，回复的是它打印的内容，例如 Paper 的未知命令提示。只接受控制台发送者的插件命令会拒绝捕获式发送者，这类命令请在服务器控制台执行。框架不会改用控制台身份重试。

自 v6.3.0 起，从 UltiTools 开始禁用的那一刻起，面板请求不再得到回复（[#621](https://github.com/UltiKits/UltiTools-Reborn/issues/621)）：入站消息只记一条 `FINE` 日志后丢弃，而不是为已禁用的插件调度任务，因此服务器停止期间发出的面板操作要等到面板自身的超时。恰在停服开始那一刻到达的远程命令，可能已在控制台和远程操作日志中记为允许，却不会执行，也没有结果回复。自 v6.3.1 起，关闭期间的行为以 [UltiCloud 协议 2.0.0](#ulticloud-协议-2-0-0) 一节为准。

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

自 v6.3.0 起，授权与实际操作使用的是文件系统真正到达的那个对象。请求会针对真实的服务器目录逐个路径组件解析，符号链接的含义由操作系统决定，跟在链接后面的 `..` 也不会事先被折叠。目标是否在可编辑根目录内，以及它是不是凭据文件或操作日志目录，都在这个真实对象上判定。根目录内指向根目录之外的链接，按"在根目录之外"拒绝。根目录内指向受保护文件的链接，与该文件本身一样被拒绝；通过链接的父目录到达操作日志目录的路径也是如此。以上说明针对 `read`、`write` 和 `list`；`delete` 按链接自身的位置和名称判断，见下文“删除符号链接”。

有些请求形态无法被安全解析，会被拒绝，且没有任何配置键可以放行：悬空或成环的链接、无法确定是否存在的路径组件，以及路径中尚不存在的部分里出现的 `.` 或 `..` 组件。尚不存在的目标（例如 `write` 要创建的文件）必须由普通名称组成，并且连作为链接也不能存在。`delete` 还要求最后一个名称是普通名称，所以 `/`、`.` 以及以 `.` 或 `..` 结尾的路径会被拒绝，不会被解析成另一个目录。

**`list` 会标记被拒绝的条目，而不是直接省略它们。** v6.3.0 之前，调用方无权查看的条目会被
静默从列表中剔除，面板无法区分"这个文件不存在"与"这个文件被策略隐藏"。自 v6.3.0 起，每个
条目都携带一个 `accessible` 布尔值；被拒绝的条目额外携带 `reason`，取值为
`PROTECTED_CREDENTIAL` 或 `OUTSIDE_ROOTS`，且不再携带
`size`/`lastModified`/`readable`/`writable`。这是一次向后兼容的模式新增——不了解这些新字
段的旧版面板会照旧渲染之前渲染的内容，外加此前被隐藏的那些行。

自 v6.3.0 起，列表中的文件被标记为拒绝，当且仅当读取它会被拒绝：指向根目录之外文件的链接标记为 `OUTSIDE_ROOTS`，指向凭据文件的链接标记为 `PROTECTED_CREDENTIAL`，被隐藏的字段与其他被拒绝条目相同。指向目录的链接同样按其目标标记：目标在根目录之外时标记为 `OUTSIDE_ROOTS`，且不带目标的大小和修改时间。

**递归删除目录现在要求请求显式携带 `recursive: true`。** v6.3.0 之前，一个指向目录的
`delete` 请求会递归删除该目录及其全部内容，没有任何标志，也没有任何确认。自 v6.3.0 起，缺
少该字段、该字段为 `false`，或该字段不是真正的 JSON 布尔值的目录删除请求，都会在触碰文件
系统之前被拒绝，并指明缺失的字段。尚未发送该字段的旧版面板，其每一次目录删除请求都会被明确
拒绝。

**删除符号链接只删除链接本身，不触及它指向的内容。** 自 v6.3.0 起，`delete` 按链接自身的位置和名称判断它，不看目标，删除链接只会删除链接本身。对指向文件的链接执行 `delete` 会删除该链接，文件保持不变。对指向目录的链接执行 `delete` 只删除链接；目标目录及其内容保持不变，请求也不需要 `recursive` 标志，因为没有子树需要删除。悬空链接可以用同样的方式删除。v6.3.0 之前，对根目录内指向目录的链接执行递归删除，会先清空目标目录。上文的 `recursive` 规则适用于真实目录。

**递归删除不会跟随被删文件夹内部的链接。** 自 v6.3.0 起，对真实文件夹执行递归 `delete` 时，如果其中含有符号链接（或 Windows 目录联接），只会删除链接本身，链接指向的目标及其内容保持不变；即使链接指向受保护的文件夹也是如此。

### 文件边界的已知限制

自 v6.3.0 起，以下情形不在覆盖范围内：

- 服务器所在机器上的另一个进程，若在检查与使用之间把路径中的某一段换成链接，可以改变这一次请求的去向。面板本身无法创建链接。
- 放在可编辑根目录内、以其他名称存在的凭据文件硬链接，按路径无法与普通文件区分。不要把凭据文件硬链接进可编辑根目录。
- 在不区分大小写的文件系统（例如默认的 macOS 文件系统）上，受保护名称的大小写变体不会被凭据排除识别，以错误大小写请求的目录会被当作条目而不是目录处理：对非空目录的 `delete` 会被拒绝而不会删除它，空目录则无需 `recursive` 标志即被删除。

## 面板修改配置 <Badge type="tip" text="v6.3.0+" />

自 v6.3.0 起，面板编辑只写它指定的内容。编辑模块配置时经过配置写入闸门：在指定的键处替换值，文件的其余每个字节保持不变；闸门无法这样写入的文件会收到注明原因的错误回复（见[保存配置文件](/zh/guide/essentials/config-file#保存配置文件)）。

自 v6.3.0 起，`update_config` 消息需要的能力开关取决于它指定的文件。`fileName` 为 `server_properties` 的请求（不带内容的读取，或带内容的写入）只由 `ultipanel.capabilities.server-properties` 控制。其他所有目标只由 `ultipanel.capabilities.file-write` 控制：指定名称的模块配置文件、整份配置，以及指定了文件名但不带内容的请求。无法读成单个名称的 `fileName`（例如对象，或包含多个名称的数组）由 `file-write` 控制，并且不会到达 `server.properties`；只包含 `server_properties` 的数组视同该文件。因此，开启 `file-write` 不再打开 `server.properties`，开启 `server-properties` 也不再需要 `file-write`。

编辑 `server.properties` 时，只替换定义该键的那一行的值文字。注释、键的顺序、分隔符和其它值保持原有字节，包括 UTF-8 的 `motd`；文件按服务器读取它的方式解码和编码，并原子写入。同一个键定义在多行、或定义续到下一行时会被拒绝，原因注明行号，不含值：`set` 回复以 `reason` 字段给出，`set_all` 回复把该键列在 `failed` 中，并在 `failureReasons` 中给出原因。服务器日志对每个被拒绝的键只记一次。服务器自己下次启动时仍会整份重写该文件（在 Paper 1.21.11 上实测）。

## 凭据文件位置 <Badge type="tip" text="v6.3.0+" />

框架自身的 UltiCloud 凭据文件——面板连接令牌，不是任何模块拥有的东西——自 v6.3.0 起搬了
位置。这是运营者可见的变化：它改变了备份或迁移服务器时需要复制凭据的位置。

| | 位置 |
|---|---|
| v6.3.0 之前 | `plugins/UltiTools/data.json` |
| v6.3.0 及以后 | `<服务器根目录>/.ultikits/credentials.json` |

**迁移是自动的，只在升级后首次读写凭据时发生一次**——没有单独的迁移命令要运行。这个流程
在结构上就是失效安全的：先读取旧文件，再写入新文件，随后读回新文件确认写入无误，只有到这一
步才会删除旧文件。如果写入或读回失败，旧文件会原封不动地留在原处，并记录一条警告，因此失败的迁移不会丢失凭据。下一次访问凭据时会再次尝试迁移。

如果当前文件已经存在，只有在当前文件被读成凭据文档之后，才会删除旧文件；任何合法的 JSON 对象都算，空对象也不例外。当前文件不会被旧内容覆盖。如果当前文件无法这样读取（内容为空、不是合法 JSON，或者不是普通文件），两个文件都会原样保留，不会写入新的服务器标识或令牌，并记录一条警告，写明两个文件和需要检查的内容。如果当前文件根本无法打开，会产生一个错误，且不删除任何文件。当前文件修复后，下一次访问凭据时会完成清理。

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

自 v6.3.0 起，判定结果记录的是策略决定，而不是操作的结果。对远程文件操作而言，`denied` 表示任何一层的策略拒绝：能力开关关闭、路径在可编辑根目录之外、凭据排除、无法被安全解析的路径形态，或缺少 `recursive` 标志。`allowed` 表示策略允许了该操作，即使操作随后因为普通原因失败，例如文件不存在或路径类型不对。依赖路径所到达的真实对象的拒绝（例如指向根目录之外的链接）记录为 `denied`。

## 实时日志流

`logs` 能力开启时，框架会在每次面板连接建立时挂上自己的日志处理器，并在连接保持期间持续把控制台日志记录发送给面板。自 v6.3.0 起，日志流完整镜像服务器控制台，见[日志流镜像服务器控制台](#日志流镜像服务器控制台)。自 v6.3.0 起，框架自己在这里写出或推送的行（玩家加入、退出与聊天，插件操作，在线玩家数，服务器状态与文件操作消息）遵循主插件配置中的 `language` 键，见 [I18n 多语言](/zh/guide/essentials/i18n)；v6.3.0 之前它们始终是中文。

自 v6.3.0 起，动作为 `start`、`stop`、`pause` 或 `resume` 的 `log_stream` 或 `log_stream_control` 请求会收到一条说明该动作不受支持的错误响应，日志发送照常进行。v6.3.0 之前框架接受这四个动作，但在任何已发布版本上，它们都没有改变面板实际收到的内容。框架与面板中继之间只有一条连接，也无法识别连接背后的各个查看者，因此无法针对单个查看者暂停或停止日志流。暂停或隐藏实时日志视图由面板视图自己完成，例如不再渲染新的日志行。

`status` 动作仍会得到应答。自 v6.3.0 起，它的 `data` 对象除 `action` 与 `clientId` 外，还携带以下字段：

| 字段 | 含义 |
|---|---|
| `connected` | 本服务器与面板的连接当前是否在线。v6.3.0 新增 |
| `logTransmitterEnabled` | 日志传输器是否在接收日志记录 |
| `queueSize` | 已排队、尚未发送的日志条目数 |

响应中不再包含 `subscriberCount` 与 `streaming` 字段。

被拒绝的这些动作背后的 `LogStreamManager` 公开方法已在 v6.3.0 中移除：`startLogStream(String, String)`、`startLogStream(String)`、`stopLogStream(String)`、`pauseLogStream(String)`、`resumeLogStream(String)`、`isStreaming()` 与 `getSubscriberCount()`。

### 批量发送配置

发往面板的日志记录会先排队，再分批发送，相关配置位于 `ultipanel.logging.batch` 下：

```yaml
ultipanel:
  logging:
    batch:
      enabled: true
      size: 10
      interval: 5000
```

| 键 | 默认值 | 作用 |
|---|---|---|
| `enabled` | `true` | 设为 `false` 时，每条日志记录都作为独立消息立即发送 |
| `size` | `10` | 单次发送的最大条目数。排队条目达到这个数量时，不等时间间隔到达就立即发送。最小为 1 |
| `interval` | `5000` | 两次定时发送之间的毫秒数，无论 `monitoring` 能力是否开启都按它执行。最小为 1000 |

队列中最多等待 1000 条日志。队列已满时，最早的条目会被丢弃。

自 v6.3.0 起，随框架发布的 `config.yml` 声明了这一段，修改后的间隔也会生效。v6.3.0 之前，发布的文件里没有这一段，新的间隔值也不会让已经在运行的发送任务重新调度。已有的 `config.yml` 不会被改写来补上这一段；在你手动加上之前，使用上表的默认值。

框架在每次面板连接建立时，从内存中已加载的配置读取这些键。低于最小值的配置会被拒绝，框架记录一条指明该键的警告，并保留默认值。修改 `config.yml` 不会影响已经建立的连接，`ul reload` 会重新读取文件但不会重新建立连接，因此请重启服务器来应用修改后的值。

服务器运行期间，动作为 `config` 的 `log_stream` 请求可以携带 `batchConfig` 对象，包含 `enabled`、`size`、`interval` 中的任意几项。框架会先按同样的限制检查请求中的每一个值，再统一应用，任一值无效时整个请求都会被拒绝。检查通过后这些值立即生效，新的间隔会让正在运行的发送任务重新调度。以这种方式设置的值会保持到下一次面板连接建立，届时框架会重新应用 `config.yml` 中的值。

### 日志级别与排除的记录器

`ultipanel.logging` 下还有两个键，决定日志处理器把哪些日志记录发送给面板。随框架发布的 `config.yml` 中没有这两个键。某个键不存在时，使用它的默认值。

```yaml
ultipanel:
  logging:
    levels:
      - "info"
      - "warning"
      - "error"
    excluded-loggers:
      - "Minecraft"
```

| 键 | 默认值 | 作用 |
|---|---|---|
| `levels` | `info`、`warning`、`error` | 发送给面板的日志级别。能匹配到日志记录的名称是 `error`（`SEVERE`）、`warning`（`WARNING`）、`info`（`INFO`）与 `debug`（`CONFIG`、`FINE`、`FINER`、`FINEST`）。其他名称会被接受，不产生警告，也不匹配任何记录 |
| `excluded-loggers` | 空（自 v6.3.0 起） | 记录器名称前缀，来自这些记录器的日志记录会被丢弃。上面的示例会丢弃通过 `Bukkit.getLogger()` 输出的一切 |

与批量发送的键一样，框架在每次面板连接建立时读取这两个键，因此修改后的值同样需要重启服务器来应用。自 v6.3.0 起，`levels` 也作用于框架直接发送给面板的条目：玩家进入、离开服务器和聊天的日志行，插件操作日志行，以及日志流启动时发送的几行。`excluded-loggers` 仍然对它们不起作用，因为这些条目不来自任何记录器。聊天日志行在 `player-events` 能力开启时发送，属于 `debug` 级别的条目，只有 `levels` 中包含 `debug` 时才会进入日志流。

每个 `excluded-loggers` 条目都会与发出该记录的 `java.util.logging` 记录器名称的开头比较，区分大小写，因此 `org.apache` 这样的条目也会排除 `org.apache.http` 以及其他所有以它开头的名称。发送给面板的条目中不包含这个名称。条目的 `logger` 字段是框架根据自己对记录的分类得出的标签：`com.ultikits.ultitools` 下的记录器为 `UltiTools`，名称中含有 `plugin` 的其他记录器为从记录器名称中取出的一个名称，服务器记录器为 `MinecraftServer`，其余为 `database`、`network` 或 `system`。把这个标签抄进 `excluded-loggers`，只会匹配到名称恰好以它开头的记录器。例如，`MinecraftServer` 这个条目不会匹配任何标签为 `MinecraftServer` 的记录，因为框架把这个标签给了 `Minecraft`、`net.minecraft.*` 这类服务器记录器，而不是名为 `MinecraftServer` 的记录器。

`java.util.logging` 记录的记录器名称有三种：`Minecraft`（通过 `Bukkit.getLogger()` 输出的一切，包括框架自己的 `[UltiTools-API] ...` 行）、插件自己的名称，以及 `com.ultikits.ultitools.*` 类记录器。Paper 通过 Log4j 输出的行，以及通过 Log4j 或 SLF4J 输出日志的库（例如 authlib、Netty、HikariCP 与 Jetty），经由下文的控制台镜像到达日志流，使用它们在 Log4j 中的记录器名称，`excluded-loggers` 条目对它们同样适用。v6.3.0 之前日志流只接收 `java.util.logging` 记录，默认列表写的是五个 Log4j 或 SLF4J 库，什么也没有过滤；自 v6.3.0 起默认列表为空，日志流因此显示整个控制台（[#485](https://github.com/UltiKits/UltiTools-Reborn/issues/485)）。

自 v6.3.0 起，在 `levels` 中加入 `debug` 会把调试记录发送给面板。v6.3.0 之前，日志处理器自身的级别阈值固定为 `INFO`，`CONFIG`、`FINE`、`FINER` 与 `FINEST` 记录在检查 `levels` 之前就被丢弃，`debug` 因此不起作用。现在只要 `debug` 在列表中，框架就会降低这个阈值。框架不会修改任何记录器的级别，所以只有当发出调试记录的记录器本身的级别允许该记录通过时，它才会到达面板。

自 v6.3.0 起，`levels` 不再影响错误自动上报。日志处理器会把每一条携带异常的 `SEVERE` 记录交给错误上报（`ultipanel.logging.error-reporting`），无论 `error` 是否在 `levels` 中。v6.3.0 之前，级别不在 `levels` 中的记录会在这一步之前被丢弃，因此从 `levels` 中移除 `error` 也会停止这部分上报。`logs` 能力关闭时日志处理器不会挂上，因此这部分上报也依赖该能力。排除在这两步之前进行：来自被排除记录器的记录既不会发送给面板，也不会作为错误上报。在其他位置产生的错误上报，例如命令执行时抛出的异常，不经过日志处理器，这两个键对它们不起作用。

### 日志流镜像服务器控制台

自 v6.3.0 起，`logs` 能力开启时，日志流显示的就是服务器控制台显示的内容。Paper 的大部分输出通过 Log4j 打印：命令反馈、模块对控制台发送者的回复、玩家加入与退出、聊天、原版的警告与错误，以及玩家的命令行。v6.3.0 之前这些都不会到达面板。框架现在在加载时于 Log4j 的根记录器上安装一个 appender，在禁用时移除它。每一行都与插件日志行一样经过相同的过滤、批量发送与启动回放，并去掉 ANSI 颜色码。

这个镜像是完整且未脱敏的，包含带参数的玩家命令行，例如 `<player> issued server command: /login <password>`。面板与控制台处于同一信任级别，控制台显示什么，面板就可以显示什么。不希望如此的运营者应保持 `logs` 能力关闭。自 v6.3.1 起，登记为敏感命令的命令是例外：这些行中它的参数同样被替换为 `***`（见[敏感命令](#敏感命令)）。

插件日志行只会到达一次，尽管 Paper 也会把它复制进 Log4j。与面板连接有关的行、日志发送器自己的行以及 WebSocket 库（`org.java_websocket.*`）的行永远不会被发送。服务器的 Log4j 配置使用异步记录器时，镜像不会安装，控制台会输出一条警告说明这一点，日志流只包含插件日志行。自 v6.3.0 起，`java.util.logging` 根记录器上找不到 Paper 的日志转发器（`org.bukkit.craftbukkit.util.ForwardLogHandler`，例如分支服务端或重定位了 CraftBukkit 的构建）时同样如此：没有它，镜像无法区分转发的插件日志行与控制台行，每条插件日志都会被推送两次，因此不安装镜像，每次服务器运行只输出一条控制台警告（[#583](https://github.com/UltiKits/UltiTools-Reborn/issues/583)）。自 v6.3.0 起，Paper 1.19.2 至 1.20.4 的所有构建都重定位了 CraftBukkit，因此在这些版本上镜像始终不会安装，启动时输出一条警告说明这一点，日志流只包含插件日志行；Paper 1.20.5 及以上不受影响。携带异常的 Log4j `ERROR` 行还会向面板的错误收集上报一次。`org.apache.logging.log4j:log4j-core`（2.24.1）是框架的 `provided` 依赖，由 Paper 在运行时提供，不会被打包，模块无需做任何改动。

### 启动阶段的日志与发送失败

自 v6.3.0 起，从框架加载到面板连接建立之间输出的日志记录（例如模块加载与依赖解析），也会进入日志流。框架把它们保存在启动缓冲区中，在日志流开始时最先发送、从最早的一条开始（[#487](https://github.com/UltiKits/UltiTools-Reborn/issues/487)）。缓冲区只保存 `INFO` 及以上、且未被 `excluded-loggers` 排除的记录，最多 2000 条（估计约 512 KiB）；服务器没有云端登录，或日志流在五分钟内没有开始时，缓冲区会被释放，不发送任何内容。回放按每条不超过 64 KiB 的消息发送，第一条立即发出，之后大约每秒一条，与上文的批量发送键无关，因此装满的缓冲区几秒内即可发完。回放期间新产生的实时记录可能先于最后几条回放消息到达。`logs` 能力关闭时不会创建缓冲区，也不保存任何记录。

同样自 v6.3.0 起，一批日志记录如果因为连接恰在发送时关闭而发送失败，会被保留下来，在下一次发送时先于任何更新的记录发出，因此记录仍按顺序到达（[#486](https://github.com/UltiKits/UltiTools-Reborn/issues/486)）。投递仍是尽力而为：连接恰在一批记录写出之后断开时，这批记录可能到达两次。到达的记录多于日志流能发送的数量时，队列保留最新的 1000 条，框架最多每分钟一次在服务器日志中用一条警告报告丢弃了多少条。

自 v6.3.0 起，日志流是控制台尽力而为的便利副本，以服务器的 `logs/latest.log` 为准（[#583](https://github.com/UltiKits/UltiTools-Reborn/issues/583)、[#571](https://github.com/UltiKits/UltiTools-Reborn/issues/571)）。已知两处缺口：启动回放尚未发完、或缓冲的记录正在移交给日志流时面板连接断开，未发送的回放记录会转入新连接的实时队列，该队列保留最新的 1000 条、其余计入上文的警告，之后这些记录按实时记录发送，不再按回放的节奏；以及在日志流首次接管启动缓冲区的那几微秒内，其他线程记下的一条记录可能漏发，且不计数。凡是不能遗漏的内容（例如审计记录或事故排查），请从 `logs/latest.log` 读取。

服务器运行期间，上文所述动作为 `config` 的 `log_stream` 请求也可以携带 `levels` 数组。自 v6.3.0 起框架会应用它；v6.3.0 之前该字段会被忽略。只要有一个名称不属于上述四个，整个请求都会被拒绝；空数组会让所有级别都不启用。从面板设置的级别同样作用于框架直接发送的条目。以这种方式设置的级别会保持到下一次面板连接建立，届时框架会按 `config.yml` 重新创建日志处理器，`config.yml` 中没有 `levels` 时则使用默认值。这个请求没有用于排除记录器的字段。

## 敏感命令

自 v6.3.1 起，模块可以把带密码类参数的命令及其别名登记到 `com.ultikits.ultitools.websocket.SensitiveCommandRegistry`，让这些参数不出现在框架发往 UltiCloud 的任何内容中：

<!-- UltiCloudDocSnippetsTest: sensitive-commands -->
```java
public class SensitiveCommands {

    /** Call from registerSelf() with UltiTools.getInstance().getSensitiveCommandRegistry(). */
    public void register(SensitiveCommandRegistry registry) {
        registry.register("login", "l", "register", "reg", "changepassword");
    }
}
```

- 登记表初始为空，框架自己不登记任何命令。
- 命令行的第一个词去掉开头的一个 `/` 和 `namespace:` 前缀之后，与某个已登记的名字相同（不区分大小写）即为匹配：登记 `login` 后，`/login`、`/LOGIN` 与 `/ultilogin:Login` 都匹配。
- 匹配的命令保留命令名、去掉参数：`/login hunter2` 变成 `/login ***`。这适用于发往面板的每一条日志行（实时的与启动时补发的，包括控制台镜像的行）、错误上报（消息、触发信息与堆栈）以及聊天。
- 对所有命令，无论是否登记，`player.command` 事件都只带命令名（小写、去掉命名空间）。
- 服务器自己的控制台、日志文件以及其他处理器看到的日志记录都不改变。
- 登记可以在任何线程进行，与服务器是否已接入无关，重复登记没有副作用。没有注销方法：名字一经登记，直到服务器重启都会被脱敏。

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

对于由模块 responder 拥有的类型，事件在请求交给 responder 之后发布，此时 responder 可能仍在运行。

自 v6.3.1 起，每一条到达模块 responder 的 `module.request` 都会在主线程上发布这个事件，携带 responder 的类型、responder 的输入（请求的 `params` 加上 `actor`）以及收到的请求信封。以 `module_not_found` 回复的请求不发布事件。框架自己的协议消息不发布事件。

### 拥有一个请求/响应类型：`PanelResponderRegistry`

对于框架**尚未**处理的面板消息类型，模块可以通过
`com.ultikits.ultitools.websocket.PanelResponderRegistry` 注册唯一一个 responder，直接应
答请求。

自 v6.3.1 起，面板通过 `module.request { module, action, params, actor }` 到达 responder。`module` 是模块的 UltiCloud 标识：它的 `identify-string` 去掉首尾空白并转小写，而不是 `plugin.yml` 中的名字。例如 UltiChat 的标识是 `ultichat`，而它的名字是 `UltiTools-Chat`。模块没有 `identify-string`，或它不是合法标识（小写字母开头，由小写字母与数字组成的段以单个 `.` 或 `-` 连接，至多 64 个字符）时，改用它的 `plugin.yml` 名字去掉首尾空白并转小写作为标识，与 6.3.0 相同，前提是这个名字本身是合法标识。请把 responder 注册在 `<标识>.<action>` 下；6.3.0 的 `<plugin.yml 名字小写>.<action>` 形式仍能找到。action 由小写字母、数字、`.`、`_` 与 `-` 组成。请求只会到达拥有该标识的模块的 responder，其他请求一律以 `module_not_found` 回复。

<!-- UltiCloudDocSnippetsTest: module-responders -->
```java
public class MailResponders {

    /** Call from registerSelf(); the framework releases the responders when the module unloads. */
    public void register(PanelResponderRegistry registry, UltiToolsPlugin module) {
        // Answers module.request { module: "ultimail", action: "inbox.count", params, actor }.
        registry.registerResponder("ultimail.inbox.count", data -> {
            JsonObject actor = data.getAsJsonObject("actor");
            JsonObject reply = new JsonObject();
            reply.addProperty("userId", actor.get("userId").getAsLong());
            reply.addProperty("unread", 3);
            return CompletableFuture.completedFuture(reply);
        }, module.getPluginName(), module);

        // Completing with null answers ok with data: null.
        registry.registerResponder("ultimail.inbox.clear",
                data -> CompletableFuture.completedFuture(null), module.getPluginName(), module);
    }
}
```

responder 收到请求 `params` 的一份拷贝，其中多了一个成员 `actor`：`{ "userId": <面板用户 ID>, "minecraftUuid": <UUID 或 null> }`。它由 UltiCloud 按发出请求的面板用户填写，框架原样传递；`params` 里自带的 `actor` 会被替换。可以据此决定该用户能看到什么。拥有至少一个 responder 的模块会在握手中声明为 `modules:<标识>@<X.Y.Z>`，版本取它 `plugin.yml` 版本的前三个数字；UltiCloud 只为已声明的模块发送请求。这个列表在连接建立时生成，列表变化时 `/ul reload` 会重新连接。标识不是合法的 UltiCloud 标识、或会使能力名超过 96 个字符的模块，会被跳过，并记录一条警告。

面板收到的回复：成功时为 `ok`，`data` 是 responder 的结果；没有 responder 服务该请求时为 `module_not_found`；超过下文所述的期限时为 `deadline_exceeded`；responder 失败或结果不是合法 JSON（`NaN` 或无穷大）时为 `module_error`。

- **每个类型只能有一个所有者。** 注册一个框架已经服务的类型（自 v6.3.1 起，即 UltiCloud 协议 2.0.0
  的任一消息类型）会立即抛出异常，并指明框架是既有所有者；注册一个另一个模块已经拥有的类型也会立即抛
  出异常，并指明那个模块。这是硬性检查，不是建议——不存在"后注册者静默生效"的兜底行为。
- **responder 返回任意 JSON 值的 future（自 v6.3.1 起）。** 对象、数组或原始值作为回复的 `data` 发送；
  以 `null` 或 `JsonNull` 完成的 future 表示成功、没有内容。不返回 future、抛出异常或 future 异常完成时，
  请求失败。你无需直接接触连接。v6.3.0 中结果必须是对象，`null` 视为失败。注册方法现在接受
  `Function<JsonObject, ? extends CompletableFuture<? extends JsonElement>>`，`dispatch` 返回
  `CompletableFuture<JsonElement>`：6.3.0 写法的 lambda 仍能编译，已编译的模块仍能链接；但用旧参数类型覆写
  `registerResponder` 的子类，或把 `dispatch` 的结果赋给 `CompletableFuture<JsonObject>` 的代码，需要修改。
- **responder 运行在工作线程上（自 v6.3.0 起）。** 框架在自己的工作线程上调用 responder，既不是服务器
  主线程，也不是读取面板连接的线程，因此一个慢 responder 不会再拖住其他面板消息。responder 中需要调用
  Bukkit API 的部分，由 responder 自己调度到主线程（例如通过 `Bukkit.getScheduler().runTask(...)`），
  并在那里完成它的 future。
- **一个从请求到达时开始计算的期限。** 一个几秒的期限从请求到达时开始计算，涵盖等待工作线程、调用本身
  以及返回的 future。期限过后，面板收到一条指明类型和模块的超时错误，之后才到达的结果会被丢弃。同时最多
  处理 4 个请求，另有最多 64 个请求等待工作线程；超出的请求会立即被拒绝，并收到一条指明类型和模块的错误回复。
- **responder 必须是线程安全的。** responder 可能并发运行，同时最多 4 个调用，其中可以包括同一个
  responder 的多个调用，完成顺序也可能与请求顺序不同。阻塞的调用会一直占用它的工作线程直到返回，超过期限
  也一样，框架从不中断它。调用看到的是接收该请求的线程的上下文类加载器，不带入事务、用户或其他线程局部状态。
- **迟到的回复会被丢弃。** 自 v6.3.0 起，回复只通过请求被受理时当前云会话的 WebSocket 客户端发送，
  并且仅当该客户端仍已安装、仍在当前会话上保持连接，且 UltiTools 仍在接受面板消息时才发送。UltiTools
  开始禁用之后、云会话登出之后，或者承载该请求的连接已经关闭或被替换之后，回复都不会发送，也不会被转到
  更新的连接上，面板按自己的超时处理。自 v6.3.1 起，回复发往承载该请求的协议 2.0.0 连接，规则相同。
- **请求到达时注册的 responder 负责处理它，** 即使在调用运行之前该类型被重新分配或模块已经卸载。
- **模块卸载时，responder 会自动注销**，与框架自动注销该模块 `EventBus` 订阅的同一时机
  一致。
- **responder 属于某一个模块实例（自 v6.3.0 起）。** 框架加载模块期间（容器刷新或 `registerSelf()`
  中）注册的 responder 属于该实例。加载之后用三参数 `registerResponder(type, responder, ownerModule)`
  注册的，属于框架以 `ownerModule` 列为已加载的那个实例；新实例正在替换旧实例时，属于旧实例。实例卸载
  或被替换时，只注销它自己的 responder。在模块构造器中，或在框架把主类注册为 Bean 时运行的 `@PostConstruct` 代码中（主类自身及其注入的 Bean 的）
  按名称注册的 responder，属于此时以该名称列出的实例：首次加载时没有这样的实例，新实例加载期间则是旧实例。请在 `registerSelf()` 中注册 responder；如果你手上有模块实例，
  也可以使用四参数的 `registerResponder(type, responder, ownerModule, ownerInstance)`，直接记下实例。
- **新实例接管旧实例的类型（自 v6.3.0 起）。** 代码注册一个已加载模块的新实例时，旧实例的 responder
  在新实例的 `registerSelf()` 运行之前被释放，所以在其中注册同一类型会成功。新实例加载失败时，它的
  responder 被注销，旧实例的 responder 原样恢复。

自 v6.3.1 起，面板只能到达 `<标识>.<action>`（或上文的 6.3.0 名字形式）这样的类型，因此模块本身就是命名空间，action 不需要另加前缀。框架不拒绝其他类型字符串，但任何面板请求都到达不了它们。

## 参见

- [模块事件总线](/zh/guide/advanced/module-eventbus) —— `PanelMessageEvent` 所依托的底层
  发布/订阅机制。
- [云端登录](/zh/guide/advanced/cloud-login) —— 接入服务器与连接状态。
- [玩家链接](/zh/guide/advanced/player-link) —— 让玩家进入面板。
