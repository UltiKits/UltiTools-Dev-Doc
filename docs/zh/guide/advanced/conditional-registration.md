# 条件注册

::: info 自 v6.2.0 起
`@ConditionalOnConfig` 注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 允许你根据 YAML 配置值来条件性地注册组件。这让服主无需修改代码即可启用或禁用功能。

## 基本用法

在任意组件类（`@Service`、`@CmdExecutor`、`@EventListener`）上添加 `@ConditionalOnConfig`：

```java
@CmdExecutor(alias = {"warp"}, permission = "myplugin.command.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "enableWarp")
public class WarpCommands extends AbstractCommandExecutor {
    // 仅在 config.yml 中 enableWarp: true 时才注册
}
```

对应的 YAML 配置：

```yaml
# config/config.yml
enableWarp: true
```

如果 `enableWarp` 为 `false` 或缺失，`WarpCommands` 类将**完全不被注册**——没有命令注册、没有内存占用、没有副作用。

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `String` | （必填） | 相对于插件数据目录的配置文件路径 |
| `path` | `String` | （必填） | 点分隔或斜杠分隔的 YAML 键路径 |
| `negate` | `boolean` | `false` | 如果为 `true`，在配置值为 `false` 时注册（反转逻辑） |

## 示例

### 条件服务

```java
@Service
@ConditionalOnConfig(value = "config/config.yml", path = "economy.enabled")
public class EconomyService {

    @Scheduled(period = 36000, async = true)
    public void distributeTax() {
        // 仅在 economy.enabled: true 时运行
    }
}
```

### 条件事件监听器

```java
@EventListener
@ConditionalOnConfig(value = "config/config.yml", path = "welcomeMessage.enabled")
public class WelcomeListener implements Listener {

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage("欢迎来到服务器！");
    }
}
```

### 嵌套配置键

使用点号或斜杠来访问嵌套键：

```yaml
# config/config.yml
features:
  teleport:
    enabled: true
  pvp:
    enabled: false
```

```java
@CmdExecutor(alias = {"tp"}, permission = "myplugin.teleport")
@ConditionalOnConfig(value = "config/config.yml", path = "features.teleport.enabled")
public class TeleportCommands extends AbstractCommandExecutor {
    // ...
}
```

### 反转逻辑（negate）

使用 `negate = true` 在配置值为 `false` 时注册组件：

```java
@Service
@ConditionalOnConfig(value = "config/config.yml", path = "maintenance", negate = true)
public class NormalModeService {
    // 仅在 maintenance: false（或缺失）时生效
}
```

## 完整示例

通过配置控制可选功能的插件：

```yaml
# config/config.yml
features:
  home: true
  warp: true
  economy: false
  welcome: true
```

```java
@UltiToolsModule(scanBasePackages = {"com.example.plugin"})
public class MyPlugin extends UltiToolsPlugin {
    @Override
    public boolean registerSelf() { return true; }

    @Override
    public void unregisterSelf() { }
}
```

```java
@CmdExecutor(alias = {"home"}, permission = "myplugin.home")
@ConditionalOnConfig(value = "config/config.yml", path = "features.home")
public class HomeCommands extends AbstractCommandExecutor {
    // 已注册（features.home = true）
}

@CmdExecutor(alias = {"warp"}, permission = "myplugin.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "features.warp")
public class WarpCommands extends AbstractCommandExecutor {
    // 已注册（features.warp = true）
}

@Service
@ConditionalOnConfig(value = "config/config.yml", path = "features.economy")
public class EconomyService {
    // 未注册（features.economy = false）
}

@EventListener
@ConditionalOnConfig(value = "config/config.yml", path = "features.welcome")
public class WelcomeListener implements Listener {
    // 已注册（features.welcome = true）
}
```

::: tip v6.2.0 之前
没有 `@ConditionalOnConfig` 时，开发者需要在 `registerSelf()` 中手动检查配置值，并使用 `if` 语句条件性地注册组件。注解方式更简洁，消除了样板代码。
:::
