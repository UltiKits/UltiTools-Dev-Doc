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

::: tip Every entry point evaluates the condition since v6.3.0
As of v6.3.0, every entry point (standard modules, the listener package scan and the connector `PluginManager.register(UltiToolsPlugin)`) evaluates the condition during the component scan.
Through v6.2.5 the connector entry point performed no component scan, so nothing there evaluated the condition ([issue #334](https://github.com/UltiKits/UltiTools-Reborn/issues/334)).
:::

## Reload Drift Reporting <Badge type="tip" text="v6.3.0+" />

`@ConditionalOnConfig` is evaluated once, at component scan (plugin startup). `ul reload` re-reads the config file, but it never registers or unregisters anything by itself -- it only reports what changed.

As of v6.3.0, the drift message names what the container actually holds, not just what the condition now answers:

```
[UltiTools-API] @ConditionalOnConfig drift after reload: com.example.MyService (config/config.yml -> myFeature.enabled) now evaluates to disabled, but the component is already registered. @ConditionalOnConfig is evaluated once at component scan; a restart is required to remove the component.
```

::: tip Before v6.3.0, the advice was one fixed sentence
The message used to advise "a restart is required" unconditionally, even when nothing had ever been constructed. As of v6.3.0 the advice follows what the container actually holds: present and now disabled restarts to remove it, absent and now disabled needs no restart (check the startup log instead), absent and now enabled restarts to create it, and present and now enabled needs no restart either.
:::

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `String` | (required) | Config file path relative to the plugin data folder |
| `path` | `String` | (required) | Dot-separated YAML key path; as of v6.3.0 it is read with the module config entity's rule, so a flat dotted key such as `features.chat: false` matches too, and a path written in both forms refuses the module |
| `negate` | `boolean` | `false` | If `true`, register when config value is `false` (inverted logic) |

## Examples

### Conditional Service

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/EconomyService.java

### Conditional Event Listener

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WelcomeListener.java

### Nested Config Keys

Use dots for nested keys:

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
