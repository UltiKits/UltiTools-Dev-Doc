# 条件注册

7.0.0 尚未发布。本页介绍 UltiTools-API 7.0 的条件注册。预览版的范围见 [7.0.0 发布说明](../release-notes/7.0.0)。

模块作者可以用 `@ConditionalOnConfig` 根据 YAML 设置决定启动时注册哪些组件。

## 基本用法

将 `com.ultikits.ultitools.annotations.ConditionalOnConfig` 加在[组件扫描器](./ioc-container)能发现的类上，例如带 `@Service`、`@CmdExecutor` 或 `@EventListener` 的类。此注解本身不会把类变成组件，也不会限制手动注册。

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WarpCommands.java

```yaml
# config/config.yml
enableWarp: true
```

如果 `enableWarp` 为 `false` 或缺失，扫描器会跳过 `WarpCommands`，不会记录条件不满足的日志。正常扫描流程不会为它创建 Bean 或注册命令。自 v7.0.0 起，将此项设为 `true` 后，执行器通过 Paper 注册为 Brigadier 命令。此示例只提供根命令的帮助处理方法。

如果无法取得所属模块或其资源目录，框架会记录警告，并按条件满足继续扫描。中英文环境下，警告均以 `@ConditionalOnConfig on <class> could not be evaluated:` 开头，以 `Registering by default (fail-open).` 结尾。这和 YAML 文件缺失不同：文件缺失时，先按 `false` 处理，再应用 `negate`。

## 重载漂移报告 <Badge type="tip" text="v6.3.0+" />

组件扫描决定注册哪些组件。执行 `/ul reload` 或 `/ul reload <name>` 时，框架对照当前文件检查已记录的启动判定，但不会因此创建或移除组件。已记录的判定结果发生变化，或检查本身失败时，会记录警告。指定模块重载成功时，命令回复 `模块 <module> 已重载`。这只说明重载已完成，不表示已注册的组件集合发生了变化。

警告说明新的判定结果，以及容器中是否已有构造完成的实例。中英文环境均使用同一条英文诊断：

```text
[UltiTools-API] @ConditionalOnConfig drift after reload: com.example.MyService (config/config.yml -> myFeature.enabled) now evaluates to disabled, but the component is already registered. @ConditionalOnConfig is evaluated once at component scan; a restart is required to remove the component.
```

如果已有实例而条件变为禁用，重启以移除实例。如果没有实例而条件变为启用，重启以创建实例。如果实例状态已符合新的判定，无需操作。如果实例不存在且条件变为禁用，但你原先预期它已注册，请检查启动日志是否有注册失败。

## 注解属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `String` | 必填 | 相对于模块数据目录的 YAML 文件路径 |
| `path` | `String` | 必填 | 以点分隔的布尔设置路径，支持嵌套、扁平点键和混合写法 |
| `negate` | `boolean` | `false` | 将布尔结果取反后再用于注册判定 |

只有 YAML 布尔值 `true` 算真。条件读取器将路径缺失、非布尔值（包括 `"true"`）、无法读取或无法解析的文件视为假。如果同一文件用两种形式定义同一路径，即使两个值相同，框架也会拒绝组件扫描。删掉其中一份定义后重启。共用的路径规则见[配置文件](../essentials/config-file)。

## 示例

### 条件服务

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/EconomyService.java

### 条件事件监听器

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WelcomeListener.java

### 嵌套配置键

使用点号访问嵌套键：

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

需要在设置为 `false` 时注册组件，可用 `negate = true`。设置或文件缺失时也会注册，因为默认的假值会被取反。

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/NormalModeService.java

## 完整示例

若模块包含本页的示例类，请在 `plugin.yml` 中声明模块主类。自 v7.0.0 起，可接受的最低 `api-version` 是 `700`。项目配置见[快速开始](../quick-start)。`name` 是必需的：`plugin.yml` 里没有 `name:` 键的模块，框架会拒绝加载。

```yaml
name: ConditionalExample
version: 1.0.0
main: com.ultikits.docs.conditional.MyPlugin
api-version: 700
```

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/MyPlugin.java

将以下设置放入模块数据目录下的 `config/config.yml`：

```yaml
# config/config.yml
enableWarp: true
economy:
  enabled: false
welcomeMessage:
  enabled: true
features:
  teleport:
    enabled: true
maintenance: true
```

按这份设置启动时，传送点和传送命令的执行器以及欢迎监听器会启用，经济服务和普通模式服务会跳过。修改开关后执行 `/ul reload <name>` 会报告判定差异；重启服务器才会应用新的组件集合。
