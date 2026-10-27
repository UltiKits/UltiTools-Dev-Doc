# 云端登录

::: info 自 v6.3.1 起
UltiTools-API v6.3.1 用设备码和 UltiCloud 协议 2.0.0 把服务器接入 UltiCloud。6.3.0 的魔法链接登录及其云端服务在切换时停止。
:::

`/ulticloud login`、`/ulticloud logout`、`/ulticloud status` 与 `/ulticloud reconnect` 用于把服务器接入 UltiCloud，从而通过 UltiPanel 面板远程管理。自 v6.3.1 起，已接入的服务器只持有一份属于它自己、可以吊销的凭据，不再持有任何用户账号令牌；框架通过 UltiCloud 协议 2.0.0 连接 `wss://api.ultikits.com/v1/agent`。这些命令在服务器控制台或 RCON 上执行，需要管理员权限。

## 接入服务器

`/ulticloud login` 向 UltiCloud 申请一个设备码并打印出来：

```
========================================
 To link this server to UltiCloud, open:
 <verification URI>
 and enter the code:
 BCDF-GHJK
 Or open this link directly: <complete verification link>
========================================
The code expires in 10 minutes. Waiting for confirmation...
```

在浏览器中打开这个地址，登录 UltiCloud，输入代码并确认。服务器的名字在确认页上选定，服务器的 MOTD 只是建议的默认值。代码不区分大小写，连字符可有可无。服主确认后，控制台记录 `UltiCloud: this server is now linked as <name> (server ID <server ID>).`，随即开始连接。

| 情况 | 命令的行为 |
|---|---|
| 服务器已经接入 | 拒绝，并提示 `/ulticloud logout` |
| 60 秒内第二次执行 `/ulticloud login` | 拒绝，并给出剩余秒数 |
| 服主在确认页上拒绝 | 停止轮询，记录 `UltiCloud: linking was denied on the confirmation page. Run /ulticloud login to try again.` |
| 10 分钟内无人确认 | 停止轮询，记录 `UltiCloud: the device code expired before it was confirmed. Run /ulticloud login to get a new code.` |
| 等待期间执行 `/ulticloud logout` | 取消这次申请；之后再确认也不会接入 |

通过 RCON 执行时，命令会立即回复代码和链接将打印在服务器控制台，上面那段输出的每一行也会写入控制台日志。RCON 的回复在命令返回时就结束了，而代码稍后才到。

## 服务器凭据

凭据保存在 `<server root>/.ultikits/credentials.json` 的 `cloud_credential` 条目中，这是框架自有的文件，6.3.0 的令牌原本也存放在这里。在 POSIX 文件系统上，该文件只有所有者可读写。凭据不会过期，也没有刷新令牌。UltiCloud 可能轮换它：框架先把新凭据写入磁盘再确认轮换，当前连接继续使用旧凭据，下一次连接起使用新凭据。远程文件 API 从不提供 `.ultikits` 目录。

`/ulticloud logout` 先在 UltiCloud 上吊销凭据，再删除它，停止重连并停止所有云端功能。无法连上 UltiCloud 时，登出仍会在本地删除凭据，并警告：`The cloud credential may still be valid. Revoke it in the panel: server settings > Revoke credential.`

## 操作员命令

| 命令 | 作用 |
|---|---|
| `/ulticloud login` | 申请设备码、打印出来，并等待确认 |
| `/ulticloud logout` | 吊销并删除凭据，停止所有云端功能 |
| `/ulticloud status` | 打印 `UltiCloud: Linked as <name> (server ID <server ID>)` 与连接状态，或说明服务器未接入 |
| `/ulticloud reconnect` | 立即重试连接，每 10 秒最多一次；服务器已连接或正在连接、未接入、需要升级 UltiTools 时分别说明 |

## 连接与重连

连接由一个状态机维护。连接断开后，它在 1 秒到一个上限之间随机延迟重试，这个上限从 1 秒逐次翻倍到 60 秒；每次尝试都新建连接，并重新读取凭据。控制台每次尝试、每次排定重试各记录一行，从不包含凭据。只有在 15 秒内收到 UltiCloud 的 `welcome`，连接才算建立；此后框架每 30 秒发送一次心跳，90 秒没有回应就重连。

UltiCloud 的某些回复会结束或改变重试：

| UltiCloud 的回复 | 框架的处理 |
|---|---|
| HTTP 401，或关闭码 4401（凭据被吊销、服务器被删除） | 停止，删除凭据与缓存的云端状态，记录 `UltiCloud rejected this server's credential (it was revoked or is no longer valid). The saved credential was deleted. Run /ulticloud login to link this server again.` |
| HTTP 426，或关闭码 4426 | 停止并保留凭据；控制台说明 UltiCloud 不再接受这个 UltiTools 版本，UltiCloud 给出最低版本时一并显示。升级 UltiTools 后重启 |
| HTTP 402，或关闭码 4402（套餐超限） | 保留凭据并暂停，见下文 |
| HTTP 429、关闭码 4400 或 4429、其他 4xx | 等待更久：随机延迟的上限从 60 秒增长到 15 分钟，429 至少等待其 `Retry-After` |
| 连续三次关闭码 4000 | 另一处连接正在使用同一凭据；第三次后停止重连，控制台说明原因 |
| `welcome` 中的服务器 ID 与已接入的不同 | 停止并保留凭据，提示联系支持，或登出后重新接入 |

### 套餐超限暂停

UltiCloud 账号超出套餐时（例如 Pro 套餐到期、服务器数量超过免费套餐，并且 7 天宽限期已过），UltiCloud 以 HTTP 402 拒绝连接，或以 4402 关闭连接。框架保留凭据，打印一次原因、宽限期结束时间和套餐管理链接，之后每 15 分钟静默重试一次。`/ulticloud status` 显示 `paused — plan limit reached; retrying every 15 minutes`。服主续费或把这台服务器选为保留之后，下一次重试即可连上，也可以用 `/ulticloud reconnect` 立即连接，不需要重新登录。

## 能力开关

`plugins/UltiTools/config.yml` 中 `ultipanel.capabilities` 下的开关决定面板可以做什么。自 v6.3.1 起，服务器只向 UltiCloud 声明开关允许的能力，并对每个请求再次检查开关。

| 键 | 默认值 | 面板功能 |
|---|---|---|
| `monitoring` | `true` | 服务器状态，以及玩家、插件、世界快照 |
| `logs` | `true` | 实时控制台日志流 |
| `player-events` | `true` | 玩家进服、离服与命令事件 |
| `file-read` | `true` | 读取、列出文件与模块配置 |
| `file-write` | `false` | 写入文件与模块配置 |
| `file-delete` | `false` | 删除文件 |
| `commands` | `false` | 远程命令，受命令黑名单约束 |
| `server-properties` | `false` | 读取与编辑 `server.properties` |
| `power-actions` | `false` | 从面板停止、重启服务器（v6.3.1 新增） |
| `player-actions` | `false` | 踢出玩家、修改游戏模式、传送玩家（v6.3.1 新增） |

电源动作与玩家动作默认关闭。6.3.0 的 `config.yml` 会在启动时一次性加入这两个新键，值为 `false`；只补充缺失的键，服主写下的每个值和注释逐字节保持不变；框架无法以这种方式扩展的文件排版会得到一条警告，两个开关保持关闭。错误上报仍使用自己的键 `ultipanel.logging.error-reporting.enabled`。执行 `/ul reload` 后，改动的开关立即生效；声明的能力集合发生变化时，服务器会重新连接。每项功能发送和接受什么，见[面板集成](/zh/guide/advanced/panel-integration)。

## 从 6.3.0 升级

6.3.0 的登录使用服主的账号令牌，它已不再可用，也不会自动迁移：

- 6.3.1 第一次启动时，保存的 6.3.0 令牌会从 `credentials.json` 中删除，并记录一条以 `Run /ulticloud login to re-attach this server.` 结尾的警告。同一文件中的服务器安装 ID 保留不变，并随下一次设备登录发送，面板据此可以把这次登录接回原有的服务器。
- 执行一次 `/ulticloud login`。服务器不再保留旧登录的任何痕迹。

## 模块 API 兼容性

`CloudAuthManager` 仍是内部类（`@ApiStatus.Internal`）。6.3.0 中替 UltiLogin 发送魔法链接请求的 `UltiCloudRequests` 已弃用，将在 6.4.0 删除。自 v6.3.1 起它的每次调用都返回 `PATH_NOT_ALLOWED`，什么也不发送，因此 UltiLogin 2.0.0 的 `/panel` 无法再使用；UltiLogin 2.1.0 改用[玩家链接 API](/zh/guide/advanced/player-link)。需要让玩家进入面板的模块使用这个 API；带有密码类参数的命令应登记为敏感命令（见[面板集成](/zh/guide/advanced/panel-integration#敏感命令)）。

6.3.1 的完整变更、弃用与已知限制，见 [`COMPATIBILITY.md`](https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md) 的「UltiCloud protocol 2.0.0」一节。
