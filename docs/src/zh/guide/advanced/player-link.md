# 玩家链接

::: info 自 v6.3.1 起
本页的玩家链接 API 是 UltiTools-API v6.3.1 新增的，需要服务器已通过 `/ulticloud login` 接入。
:::

玩家链接用来证明正在使用 UltiCloud 网页面板的人拥有本服务器上的某个游戏身份。玩家执行 `/panel` 这类命令时，模块申请一个链接，把一次性 URL 展示给玩家，之后再得知网页用户用什么方式证明了身份。模块看不到服务器的 UltiCloud 凭据，也不通过 HTTP 访问 UltiCloud：所有消息都由框架在它自己的连接上收发。

API 是 `com.ultikits.ultitools.websocket.CloudPlayerLinks`，用 `UltiTools.getInstance().getCloudPlayerLinks()` 取得唯一的实例。它从框架启用到停用一直存在，连接建立之前、连接期间、两次连接之间都可以使用；只有在框架启用之前它才返回 `null`。

## 申请链接

`create(requester, playerUuid, playerName, gameAuth, offeredProofs)` 发出一次申请，立即返回 `CompletableFuture<LinkCreation>`，不阻塞，在主线程上调用也一样。

| 参数 | 含义 |
|---|---|
| `requester` | 发起调用的模块，用于归属与诊断 |
| `playerUuid`、`playerName` | 玩家的 Minecraft UUID 与名字 |
| `gameAuth` | 不涉及登录插件时用 `GameAuth.none()`；本服务器由登录插件认证玩家时用 `GameAuth.authPlugin(authenticated, accountExists)` |
| `offeredProofs` | 本服务器能支持的一到三种 `LinkProof`：`IN_GAME_SESSION`、`LINKED_WEB_ACCOUNT`、`WEB_REGISTRATION` |

服务器是否运行在正版验证模式由框架自己填写。网关决定接受哪些提供的证明方式，并在 `acceptedProofs()` 中返回。

<!-- UltiCloudDocSnippetsTest: player-link-create -->
```java
public class PanelLinkRequest {

    /** Asks for a link for one player; send the returned text to the player on the main thread. */
    public CompletableFuture<String> request(UltiToolsPlugin module, CloudPlayerLinks links,
                                             UUID playerUuid, String playerName, boolean loggedIn) {
        CloudPlayerLinks.GameAuth auth = CloudPlayerLinks.GameAuth.authPlugin(loggedIn, true);
        return links.create(module, playerUuid, playerName, auth,
                        EnumSet.of(CloudPlayerLinks.LinkProof.IN_GAME_SESSION,
                                CloudPlayerLinks.LinkProof.LINKED_WEB_ACCOUNT))
                .thenApply(creation -> {
                    if (creation.failure() == null) {
                        return "Open " + creation.url() + " within 10 minutes. The link works once.";
                    }
                    switch (creation.failure()) {
                        case NOT_CONNECTED:
                            return "This server is not connected to UltiCloud.";
                        case RATE_LIMITED:
                            return "Too many links were requested. Try again later.";
                        case LINK_NOT_PERMITTED:
                            return "UltiCloud does not allow a link for this server or player.";
                        default:
                            return "No link could be created. Try again later.";
                    }
                });
    }
}
```

这个 future 总是正常完成。失败的结果带一个 `Failure` 和一条可以安全展示的消息：

| `Failure` | 含义 |
|---|---|
| `NOT_CONNECTED` | 服务器当前没有打开的 UltiCloud 连接，什么也没有发出 |
| `RATE_LIMITED` | 达到网关的速率限制，稍后再试可能成功 |
| `LINK_NOT_PERMITTED` | 网关不签发链接：服务器被停用、服主关闭了玩家链接，或该游戏身份被封禁 |
| `TIMED_OUT` | 网关 30 秒内没有回复 |
| `INTERNAL_ERROR` | 网关回复了意外的错误 |

future 可能在框架线程上完成。调用 Bukkit API 之前先切回主线程，例如用 `Bukkit.getScheduler().runTask(...)`。

## 链接有效期与过期

链接从网关签发时起有效 600 秒，只能使用一次。`expiresAt()` 已经换算为本服务器的时钟。为同一位玩家申请新链接会取消上一个链接。使用链接不会延长它的有效期。

链接不再可用时，处理器的 `onExpired` 会收到一个 `LinkExpiry`，原因是下面三种之一：

| `ExpiryReason` | 含义 |
|---|---|
| `EXPIRED` | 600 秒内没有人完成这个链接 |
| `CANCELLED` | 被更新的链接取代，或被插件、玩家取消 |
| `DENIED` | 网页用户在确认页上拒绝 |

过期只是通知，至多投递一次，不需要回复。框架从不自行生成过期事件：`expiresAt()` 已过但没有收到任何事件的链接，由模块自己当作已过期处理。

## 处理已完成的链接

模块在启用时注册一个 `LinkEventHandler`，卸载时移除。处理器的 `onCompleted` 收到一个 `LinkCompletion`，回答模块对游戏账号做了什么。

<!-- UltiCloudDocSnippetsTest: player-link-handler -->
```java
public class PanelLinkHandler implements CloudPlayerLinks.LinkEventHandler {

    private final Map<UUID, String> accounts = new ConcurrentHashMap<>();

    /** Call from registerSelf() with UltiTools.getInstance().getCloudPlayerLinks(). */
    public void install(UltiToolsPlugin module, CloudPlayerLinks links) {
        links.setHandler(module, this);
    }

    /** Call from onUnregister(); the framework also releases the handler when the module unloads. */
    public void uninstall(UltiToolsPlugin module, CloudPlayerLinks links) {
        links.removeHandler(module);
    }

    @Override
    public CompletableFuture<CloudPlayerLinks.GameAccountResult> onCompleted(
            CloudPlayerLinks.LinkCompletion completion) {
        if (!completion.provisionGameAccount()) {
            return CompletableFuture.completedFuture(CloudPlayerLinks.GameAccountResult.NOT_REQUESTED);
        }
        // Runs on a framework worker thread: blocking work, such as a database write, is allowed here.
        String previous = accounts.putIfAbsent(completion.playerUuid(), completion.playerName());
        return CompletableFuture.completedFuture(previous == null
                ? CloudPlayerLinks.GameAccountResult.CREATED
                : CloudPlayerLinks.GameAccountResult.ACCOUNT_EXISTS);
    }

    @Override
    public void onExpired(CloudPlayerLinks.LinkExpiry expiry) {
        // Optional: tell the player, if online, that the link can no longer be used.
    }
}
```

`provisionGameAccount()` 为 `true` 时模块必须为该玩家建立游戏账号，`WEB_REGISTRATION` 总是如此，这时 `webUsername()` 给出新的 UltiKits 网页账号名。回答一个 `GameAccountResult`：

| `GameAccountResult` | 何时回答 |
|---|---|
| `CREATED` | 模块建立了游戏账号 |
| `NOT_REQUESTED` | 不需要账号 |
| `ACCOUNT_EXISTS` | 该玩家在本服务器上已有游戏账号 |
| `REGISTRATION_REJECTED` | 本服务器自己的规则拒绝建号，例如同 IP 注册上限、名字被封禁或注册已关闭 |
| `AUTH_PLUGIN_UNAVAILABLE` | 没有可用的游戏内登录插件，无法建号 |

`REGISTRATION_REJECTED` 与 `AUTH_PLUGIN_UNAVAILABLE` 是两种不同的回答：前者表示登录插件可用、但拒绝了这位玩家，后者表示根本没有登录插件可问。

## 处理器约定

- 同一时间只有一个模块拥有处理器。同一个模块可以替换自己的处理器；已有处理器时，另一个模块调用 `setHandler` 会抛出 `IllegalStateException`。不拥有处理器的模块调用 `removeHandler` 不起作用。
- 模块卸载时框架会释放它的处理器，模块的新副本加载失败时也会释放。
- `onCompleted` 与 `onExpired` 在框架的工作线程上运行，不在主线程上，也不在读取连接的线程上。这里可以做阻塞操作；Bukkit API 调用应放到主线程。
- 处理器 30 秒内没有回答、返回 `null`、抛出异常或其 future 异常完成时，不产生结果。网关会在下一次连接后再次投递同一条完成事件，处理器会被再问一次。
- 没有处理器时，要求建号的完成事件回答 `AUTH_PLUGIN_UNAVAILABLE`，其他完成事件回答 `NOT_REQUESTED`。
- 处理器在重连之间保持注册，直到模块移除它或模块卸载。

## 跨重启的结果

网关对每条完成事件至少投递一次：在拿到结果之前，它会在每次新连接之后再次发送同一条完成事件，最长 24 小时。框架先记下模块的结果、写入 `<server root>/.ultikits/cloud-outbox.json`，然后才回复网关。再次到达的完成事件（包括重启之后）直接按记录回复，不再调用模块。因此模块不需要为链接结果自己做持久化。

服务器关闭期间，框架不回复完成事件，网关会在下次启动后再次投递，账号届时再建立。

## 已知限制

::: warning 崩溃可能让处理器被问两次
如果服务器在处理器做出决定之后、框架把结果写盘之前崩溃，再次投递的完成事件会再次调用处理器。请让建号操作可以安全重复执行，如示例中的 `ACCOUNT_EXISTS`。
:::

- 超过 4 KiB 的结果不会被保存，再次投递时会再问模块。框架自己的结果文字远小于这个上限。
- 框架无法确定自己的状态目录时，结果不会被保存，再次投递也不会被识别。

## 参见

- [云端登录](/zh/guide/advanced/cloud-login)：把服务器接入 UltiCloud
- [面板集成](/zh/guide/advanced/panel-integration)：来自面板的模块请求与敏感命令
