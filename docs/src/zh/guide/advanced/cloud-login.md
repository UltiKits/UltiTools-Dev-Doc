# 云端登录

本页说明自 v7.0.0 起框架如何处理服务器绑定；变更概览见 [7.0.0 版本说明](/zh/guide/release-notes/7.0.0)。

## 操作员命令

以下命令需要管理员权限，请在服务器控制台或通过 RCON 执行。即使[远程命令黑名单](/zh/guide/advanced/panel-integration#远程命令黑名单)为空，框架也会拒绝从面板执行 `/ulticloud login`（带或不带参数）和 `/ulticloud logout`。

| 命令 | 框架行为 |
|---|---|
| `/ulticloud login` | 申请设备码并轮询结果。 |
| `/ulticloud login <code>` | 兑换重新配对代码，不另行申请设备码。格式无效时直接拒绝，不发送请求。 |
| `/ulticloud logout` | 停止本地云端会话并取消等待中的登录，或者尝试吊销并删除已保存的服务器凭据。 |
| `/ulticloud status` | 显示是否已绑定；已绑定时显示服务器名称、服务器 ID 和连接状态。 |
| `/ulticloud reconnect` | 请求立即尝试连接。用 `/ulticloud status` 查看结果。 |

## 服务器绑定

`/ulticloud login` 会打印验证地址、设备码、直达链接和剩余有效时间（分钟）。按控制台提示操作。框架在后台轮询，保存服务器凭据后才开始连接。凭据保存在 `<server root>/.ultikits/credentials.json` 的 `cloud_credential` 条目中，这是框架自有的文件，[远程文件 API](/zh/guide/advanced/panel-integration#远程文件-api-边界) 不提供它。服务器已经绑定时，两种登录命令都会被拒绝；它们共用 60 秒的登录冷却时间。

通过 RCON 申请设备码时，初始回复为 `Requesting a device code from UltiCloud. The code and the link will be printed in the server console.`；兑换重新配对代码时，回复为 `Redeeming the re-pair code with UltiCloud. The result will be printed in the server console.`。后续输出在服务器控制台查看。

## 解除服务器绑定

自 v7.0.0 起，`/ulticloud logout` 在尝试远程吊销前先停止本地会话。存在已保存的凭据时，吊销请求与本地删除在框架调度器的 `async()` 上下文执行，不占用服务器 tick 线程。吊销失败时仍可能已解除本地绑定，此时命令提示 `云端凭据可能仍然有效。请在面板的服务器设置 > 吊销凭据中将其吊销。`。本地删除失败会单独报告：查看服务器日志后再运行 `/ulticloud logout`。

## 连接状态与重试

已绑定不等于已连接。框架随附的两个语言目录在已绑定时均打印 `UltiCloud: Linked as <name> (server ID <server_id>)` 和 `Connection: <connection>`；未绑定时均打印 `UltiCloud: Not linked` 和 `Use /ulticloud login to link this server.`。其中连接状态由框架以英文提供：

| `<connection>` | 含义 |
|---|---|
| `connected` | 框架已接受该连接的 `welcome` 消息。 |
| `connecting` | 正在尝试连接，包括套接字已打开但仍在等待 `welcome`。 |
| `reconnecting in <seconds> s (attempt <attempt>)` | 已安排下一次尝试。 |
| `paused — plan limit reached; retrying every 15 minutes (next in <minutes> min). Run /ulticloud reconnect after renewing.` | 框架收到套餐限制拒绝，保留凭据并延长重试间隔。 |
| `stopped — this UltiTools version is no longer accepted; upgrade UltiTools` | 已停止自动重试。升级 UltiTools 后重启服务器。 |
| `stopped — another connection is using this server's credential` | 连接多次被替换，框架已停止自动重试。 |
| `stopped — UltiCloud answered with a different server ID than this server is linked to; contact UltiCloud support, or run /ulticloud logout and then /ulticloud login` | 连接报告的服务器 ID 不同，框架已停止自动重试。 |
| `not connected` | 仍然绑定，但当前既没有连接，也没有排定重试。 |

`/ulticloud reconnect` 的冷却时间为 10 秒，因连接状态被拒绝的调用也计入。`正在重新连接 UltiCloud。` 表示已安排一次尝试，不代表已经连上。已连接、正在连接、需要升级、未绑定或服务器 ID 不一致时，会分别给出对应的回复。在 `language: auto` 下，非玩家发送者的命令反馈使用 `fallback-language`；见[消息与语言](/zh/guide/essentials/messages)。

## 面板能力与模块 API

`plugins/UltiTools/config.yml` 中 `ultipanel.capabilities` 的默认值见[面板集成](/zh/guide/advanced/panel-integration#能力开关)。`/ul reload` 可以重新协商声明的能力，但不会应用待生效的模块变更，也不会重载模块 JAR。

`CloudAuthManager` 是内部类。需要关联玩家的模块使用[玩家链接 API](/zh/guide/advanced/player-link)，而非服务器登录命令或旧的 `UltiCloudRequests` API。命令参数脱敏见[敏感命令](/zh/guide/advanced/panel-integration#敏感命令)。

## 6.x 历史

6.3.1 切换到设备码的历史见 [6.3.1 归档：云端登录](/zh/v6.3.1/guide/advanced/cloud-login.html)。模块迁移到 7.0 的步骤见[升级到 7.0](/zh/guide/advanced/upgrading-to-7)。
