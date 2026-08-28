# Conditional Registration

::: info Since v6.2.0
The `@ConditionalOnConfig` annotation is available starting from UltiTools-API v6.2.0.
:::

UltiTools allows you to conditionally register components based on YAML configuration values. This lets server admins enable or disable features without requiring code changes.

## Basic Usage

Add `@ConditionalOnConfig` to any component class (`@Service`, `@CmdExecutor`, `@EventListener`):

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WarpCommands.java

The corresponding YAML:

```yaml
# config/config.yml
enableWarp: true
```

If `enableWarp` is `false` or missing, the `WarpCommands` class is **not registered** at all — no command, no memory usage, no side effects.

::: warning Only the connector entry point still skips the condition
The standard `@UltiToolsModule` path resolves command classes as container beans, so a class whose condition is `false` was never constructed as a bean, and this already worked before v6.3.0.
As of v6.3.0 the listener package-scan path evaluates the condition too, closing the one gap that was real.
Only the connector entry point (`PluginManager.register(UltiToolsPlugin)`) performs no component scan at all, so nothing there evaluates the condition yet -- tracked in [issue #334](https://github.com/UltiKits/UltiTools-Reborn/issues/334).
:::

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `String` | (required) | Config file path relative to the plugin data folder |
| `path` | `String` | (required) | Dot-separated or slash-separated YAML key path |
| `negate` | `boolean` | `false` | If `true`, register when config value is `false` (inverted logic) |

## Examples

### Conditional Service

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/EconomyService.java

### Conditional Event Listener

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WelcomeListener.java

### Nested Config Keys

Use dots or slashes for nested keys:

```yaml
# config/config.yml
features:
  teleport:
    enabled: true
  pvp:
    enabled: false
```

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/TeleportCommands.java

### Inverted Logic with negate

Use `negate = true` to register a component when the config value is `false`:

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/NormalModeService.java

## Complete Example

A plugin with optional features controlled by config:

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
    // Registered (features.home = true)

    @Override
    protected void handleHelp(CommandSender sender) { }
}

@CmdExecutor(alias = {"warp"}, permission = "myplugin.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "features.warp")
public class WarpCommands extends BaseCommandExecutor {
    // Registered (features.warp = true)

    @Override
    protected void handleHelp(CommandSender sender) { }
}

@Service
@ConditionalOnConfig(value = "config/config.yml", path = "features.economy")
public class EconomyService {
    // NOT registered (features.economy = false)
}

@EventListener
@ConditionalOnConfig(value = "config/config.yml", path = "features.welcome")
public class WelcomeListener implements Listener {
    // Registered (features.welcome = true)
}
```

::: tip Before v6.2.0
Without `@ConditionalOnConfig`, developers had to manually check config values in `registerSelf()` and conditionally register components with `if` statements. The annotation approach is cleaner and eliminates boilerplate.
:::
