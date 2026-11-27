# Conditional Registration

7.0.0 has not been released. This guide describes conditional component registration in UltiTools-API 7.0. See the [7.0.0 release notes](../release-notes/7.0.0) for the preview scope.

`@ConditionalOnConfig` lets module authors use a YAML setting to control which components are registered at startup.

## Basic Usage

Add `com.ultikits.ultitools.annotations.ConditionalOnConfig` to a class discovered by the [component scanner](./ioc-container), such as a `@Service`, `@CmdExecutor` or `@EventListener`. The annotation does not make the class a component on its own, and it does not guard manual registration.

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/WarpCommands.java

```yaml
# config/config.yml
enableWarp: true
```

If `enableWarp` is `false` or missing, the scanner skips `WarpCommands` without logging that the condition failed. It does not create that bean or register its command through the normal scan path. As of v7.0.0, with the setting `true`, the executor is registered through Paper as a Brigadier command. This example only supplies the root help handler.

If the evaluator cannot resolve the owning module or its resource folder, it logs a warning and lets scanning proceed as though the condition passed. In either locale the warning begins `@ConditionalOnConfig on <class> could not be evaluated:` and ends `Registering by default (fail-open).` This differs from a missing YAML file, which is treated as `false` before applying `negate`.

## Reload Drift Reporting <Badge type="tip" text="v6.3.0+" />

The component scan decides what to register. `/ul reload` or `/ul reload <name>` compares the recorded startup decisions with the current files, but never creates or removes components in response. The drift check warns when a recorded decision changes or when the check itself fails. The targeted command’s success reply (`Module <module> has been reloaded` in English) confirms reload completion, not a change to the registered component set.

The warning states the new decision and whether the container already holds a constructed instance. Both locales use the same English diagnostic:

```text
[UltiTools-API] @ConditionalOnConfig drift after reload: com.example.MyService (config/config.yml -> myFeature.enabled) now evaluates to disabled, but the component is already registered. @ConditionalOnConfig is evaluated once at component scan; a restart is required to remove the component.
```

If an instance exists and is now disabled, restart to remove it. If no instance exists and it is now enabled, restart to create it. If the instance state already matches the new decision, no action is needed. If it is absent and now disabled but you expected it to have been present, check the startup log for a registration failure.

## Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `String` | Required | YAML path relative to the module data folder |
| `path` | `String` | Required | Dot-separated path to a boolean setting; nested, flat dotted and mixed forms are supported |
| `negate` | `boolean` | `false` | Invert the boolean result before applying it |

Only the YAML boolean `true` counts as true. A missing path, a non-boolean value (including `"true"`) or an unreadable or unparseable file counts as false in the condition reader. Defining the same path in two forms in one file refuses the component scan, even if the values agree. Remove one definition and restart. See [Configuration Files](../essentials/config-file) for the shared path rules.

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

Use `negate = true` to register when the setting is `false`. It also registers when the setting or file is missing, because the default false result is inverted.

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/NormalModeService.java

## Complete Example

For a module containing the example classes on this page, declare its main class in `plugin.yml`. As of v7.0.0, the minimum accepted `api-version` is `700`; see [Quick Start](../quick-start) for the complete project setup.

```yaml
main: com.ultikits.docs.conditional.MyPlugin
api-version: 700
```

<<< @/../examples/src/main/java/com/ultikits/docs/conditional/MyPlugin.java

Place these settings in `config/config.yml` under the module data folder:

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

On startup this enables the warp and teleport executors and the welcome listener. It skips the economy service and normal-mode service. Changing a flag and running `/ul reload <name>` reports the difference; restart the server to apply the new component set.
