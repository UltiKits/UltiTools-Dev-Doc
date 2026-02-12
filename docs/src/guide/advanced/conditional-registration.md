# Conditional Registration

::: info Since v6.2.0
The `@ConditionalOnConfig` annotation is available starting from UltiTools-API v6.2.0.
:::

UltiTools allows you to conditionally register components based on YAML configuration values. This lets server admins enable or disable features without requiring code changes.

## Basic Usage

Add `@ConditionalOnConfig` to any component class (`@Service`, `@CmdExecutor`, `@EventListener`):

```java
@CmdExecutor(alias = {"warp"}, permission = "myplugin.command.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "enableWarp")
public class WarpCommands extends AbstractCommandExecutor {
    // Only registered if enableWarp: true in config.yml
}
```

The corresponding YAML:

```yaml
# config/config.yml
enableWarp: true
```

If `enableWarp` is `false` or missing, the `WarpCommands` class is **not registered** at all — no command, no memory usage, no side effects.

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `String` | (required) | Config file path relative to the plugin data folder |
| `path` | `String` | (required) | Dot-separated or slash-separated YAML key path |
| `negate` | `boolean` | `false` | If `true`, register when config value is `false` (inverted logic) |

## Examples

### Conditional Service

```java
@Service
@ConditionalOnConfig(value = "config/config.yml", path = "economy.enabled")
public class EconomyService {

    @Scheduled(period = 36000, async = true)
    public void distributeTax() {
        // Only runs if economy.enabled: true
    }
}
```

### Conditional Event Listener

```java
@EventListener
@ConditionalOnConfig(value = "config/config.yml", path = "welcomeMessage.enabled")
public class WelcomeListener implements Listener {

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage("Welcome to the server!");
    }
}
```

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

```java
@CmdExecutor(alias = {"tp"}, permission = "myplugin.teleport")
@ConditionalOnConfig(value = "config/config.yml", path = "features.teleport.enabled")
public class TeleportCommands extends AbstractCommandExecutor {
    // ...
}
```

### Inverted Logic with negate

Use `negate = true` to register a component when the config value is `false`:

```java
@Service
@ConditionalOnConfig(value = "config/config.yml", path = "maintenance", negate = true)
public class NormalModeService {
    // Only active when maintenance: false (or missing)
}
```

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
    // Registered (features.home = true)
}

@CmdExecutor(alias = {"warp"}, permission = "myplugin.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "features.warp")
public class WarpCommands extends AbstractCommandExecutor {
    // Registered (features.warp = true)
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
