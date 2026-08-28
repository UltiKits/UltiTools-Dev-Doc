# 条件注册

::: info 自 v6.2.0 起
`@ConditionalOnConfig` 注解自 UltiTools-API v6.2.0 起可用。
:::

UltiTools 允许你根据 YAML 配置值来条件性地注册组件。这让服主无需修改代码即可启用或禁用功能。

## 基本用法

在任意组件类（`@Service`、`@CmdExecutor`、`@EventListener`）上添加 `@ConditionalOnConfig`：

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WarpCommands.java

对应的 YAML 配置：

```yaml
# config/config.yml
enableWarp: true
```

如果 `enableWarp` 为 `false` 或缺失，`WarpCommands` 类将**完全不被注册**——没有命令注册、没有内存占用、没有副作用。

::: warning 只有连接器入口点仍然跳过这个条件
标准 `@UltiToolsModule` 路径把命令类当容器 bean 解析，条件为 `false` 的类从一开始就不会被构造成 bean，这条路径在 v6.3.0 之前就已经生效。
v6.3.0 起，监听器包扫描路径也会检查这个条件，补上了唯一真实存在的缺口。
只有连接器入口点（`PluginManager.register(UltiToolsPlugin)`）完全不做组件扫描，那里目前还没有任何地方检查这个条件——跟踪于 [issue #334](https://github.com/UltiKits/UltiTools-Reborn/issues/334)。
:::

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `String` | （必填） | 相对于插件数据目录的配置文件路径 |
| `path` | `String` | （必填） | 点分隔或斜杠分隔的 YAML 键路径 |
| `negate` | `boolean` | `false` | 如果为 `true`，在配置值为 `false` 时注册（反转逻辑） |

## 示例

### 条件服务

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/EconomyService.java

### 条件事件监听器

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WelcomeListener.java

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

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/TeleportCommands.java

### 反转逻辑（negate）

使用 `negate = true` 在配置值为 `false` 时注册组件：

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/NormalModeService.java

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

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/MyPlugin.java

```java
@CmdExecutor(alias = {"home"}, permission = "myplugin.home")
@ConditionalOnConfig(value = "config/config.yml", path = "features.home")
public class HomeCommands extends BaseCommandExecutor {
    // 已注册（features.home = true）

    @Override
    protected void handleHelp(CommandSender sender) { }
}

@CmdExecutor(alias = {"warp"}, permission = "myplugin.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "features.warp")
public class WarpCommands extends BaseCommandExecutor {
    // 已注册（features.warp = true）

    @Override
    protected void handleHelp(CommandSender sender) { }
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
