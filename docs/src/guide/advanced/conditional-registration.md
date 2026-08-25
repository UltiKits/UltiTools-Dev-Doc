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

::: warning The condition is skipped on the connector path
`@ConditionalOnConfig` is read only in `ComponentScanner.shouldRegister`, which sits on the container scan path, while a plugin registered through `PluginManager.register(...)` reaches its command executors and listeners through a package scan that instantiates them reflectively, so the annotation is never consulted and the class is not skipped as this page describes.
Ship the code as a standard UltiTools module with `@UltiToolsModule`, as every example on this page does; if you have to use a connector, read the config in `registerSelf()` and decide there whether to register.
No framework issue tracks this yet, so it is recorded in [issue #30](https://github.com/UltiKits/UltiTools-Dev-Doc/issues/30) for now.
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
