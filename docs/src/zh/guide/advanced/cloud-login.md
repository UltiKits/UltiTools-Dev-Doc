# 云端登录

::: warning 截至 v6.3.0（尚未发布）
本页描述的是即将在 UltiTools-API v6.3.0（当前在 `alpha` 分支）中生效的云端登录生命周期。三条命令和它们的控制台输出与此前版本相同。
:::

`/ulticloud login`、`/ulticloud logout`、`/ulticloud status` 用于将服务器接入 UltiCloud，从而通过 UltiPanel 面板进行远程管理。v6.3.0 改变的是框架内部如何追踪一次登录，不改变操作员看到的东西。

## 一次登录就是一个会话

一次成功的登录会创建一个会话。这个会话把凭证、与 UltiPanel 的 WebSocket 连接、重连计划和令牌刷新计划整体持有在一起。

一次登出会用一个全新的、空的会话替换掉当前会话。旧会话启动的一切，在被替换的那一刻起就不再重要：一次正在进行的重连尝试，一次已经在途的凭证刷新，一次还在等待浏览器那一步的魔法链接轮询。它们都不能把结果写回一个已经被登出撤换掉的会话，无论它们在登出命令到达服务器之前已经运行了多久。

这也是登出必须无条件执行的原因。即便保存的凭证已经过期，登出也会关闭连接、停掉重连计划、停掉刷新计划。凭证过期恰恰是操作员最需要登出真正生效的场景，此前的实现会在凭证已经失效之后仍然保留连接。

## 操作员看到的东西

三条命令和它们的控制台输出与此前版本相同：

| 命令 | 作用 |
|---|---|
| `/ulticloud login` | 请求一条魔法链接，打印到控制台，等待浏览器那一步完成 |
| `/ulticloud logout` | 关闭连接并清除保存的凭证 |
| `/ulticloud status` | 报告服务器当前是否已连接，以及连接到哪个账号 |

在更早版本上运行过这些命令的操作员，看到的消息不变。会话内部的变化在控制台上没有任何可见痕迹。

## 不受影响的部分

实现这套生命周期的 `CloudAuthManager` 类是框架内部类（`@ApiStatus.Internal`），此前也从未属于模块开发者需要对接的公开 API 面。本次发布不要求任何模块做出改动。

## 代模块发送的认证请求（自 v6.3.0 起）

框架从不把服务器的 UltiCloud 凭证交给模块。自 v6.3.0 起，需要让 UltiCloud 确认某个请求来自本服务器的模块，可以请框架代为发送：`com.ultikits.ultitools.utils.UltiCloudRequests` 在自己打开的那一个连接上附加凭证，只把 HTTP 状态码和响应正文返回给模块。UltiLogin 的 `/panel` 网页登录链接是第一个使用它的模块。

它只发送两种请求：

| 方法 | 路径 | 调用 |
|---|---|---|
| `POST` | `/auth/magic-link` | `UltiCloudRequests.post("/auth/magic-link", jsonBody)` |
| `GET` | `/auth/magic-link/poll` | `UltiCloudRequests.get("/auth/magic-link/poll", query)` |

每次调用返回一个 `UltiCloudRequests.Result`，其 `getOutcome()` 是下面四个值之一：

| 结果 | 含义 | 是否发出请求 |
|---|---|---|
| `OK` | 完成了一次 HTTP 交换，不论状态码。请读取 `getStatusCode()` 和 `getBody()`。 | 是 |
| `NOT_CONNECTED` | 服务器未登录 UltiCloud：从未执行 `/ulticloud login`，或已执行 `/ulticloud logout`。 | 否 |
| `PATH_NOT_ALLOWED` | 方法和路径不是上表中的两种之一。 | 否 |
| `IO_ERROR` | 交换未能完成（连接被拒、超时、读取失败）。 | 已尝试 |

路径必须完全一致。其他路径、方法不对的允许路径，或含有 `..`、`//`、`\`、`%`、`?`、`#` 的路径，都返回 `PATH_NOT_ALLOWED`。查询参数只能通过 `query` 映射传入，由它按 UTF-8 进行 URL 编码。允许的请求只会随框架版本中有文档记录的变更而增加，模块无法自行添加。

请把 `NOT_CONNECTED` 当作正常状态处理，而不是错误：服主完全可以不使用 UltiCloud。例如 UltiLogin 在这种情况下会改用不带凭证的请求。

两个方法都会阻塞在网络 I/O 上（连接超时 10 秒，读取超时 30 秒），在服务器主线程上调用时抛出 `IllegalStateException`。请在异步任务中调用，再回到主线程处理结果。

凭证始终留在框架内部。它不会被返回、写入日志、放进异常消息或 `Result.toString()`，该类也没有任何类型为 `TokenEntity` 的公开成员。它不跟随重定向，因此 `Location` 响应头无法让它把凭证发往其他主机；3xx 响应作为状态码为该值的 `OK` 结果返回。它不写任何文件，也不写日志。
