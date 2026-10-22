---
footer: false
---

# Quick Start

In this article, you will learn how to create an UltiTools module and how to use UltiTools-API in your own plugin.

[//]: # (## 使用 IDEA 插件快速创建)

[//]: # ()

[//]: # (UltiKits 开发了官方的 IDEA 插件，你可以使用他来快速创建项目。)

## Create a new Paper project

Everything starts with an empty project, so you need to create an empty Paper project.
You can use IDEA's [Minecraft plugin](https://plugins.jetbrains.com/plugin/8327-minecraft-development)
to quickly create an empty Paper project, or manually create an empty maven project.

## Add UltiTools-API to your project

Whether you are creating an UltiTools module or using UltiTools-API, you need to add UltiTools-API to your dependencies in your Java project.

::: code-group

```xml [Maven]
<dependency>
  <groupId>com.ultikits</groupId>
  <artifactId>UltiTools-API</artifactId>
  <version>6.3.0</version>
  <scope>provided</scope>
</dependency>
```

```groovy [Gradle]
dependencies {
  compileOnly 'com.ultikits:UltiTools-API:6.3.0'
}
```

:::

The newest version of UltiTools-API can be found in [Maven Central](https://search.maven.org/artifact/com.ultikits/UltiTools-API).

Reload your project after adding the dependency.

## Create a new UltiTools module

The following content will teach you how to create an UltiTools module. 

If you just want to use UltiTools-API in your own plugin, you can jump to [Use UltiTools-API](#use-ultitools-api).

### Create a module metadata file

Before you start writing code, you need to create a `plugin.yml` file in the `resources` folder.

UltiTools will read this file before loading the module to confirm the main class of the module.

::: tip Since v6.3.0
A jar with no readable `plugin.yml`, no `main:` entry, or a `main:` that does not resolve to
a concrete `UltiToolsPlugin` subclass is refused at load, naming the exact reason.
:::

When `main:` names a class that does not exist, the refusal line is followed by the
`ClassNotFoundException` stack trace. That trace is expected: it is printed on purpose, so you can
see which class lookup failed. A jar with no `main:` entry at all is refused without a trace.

```yaml
# Module name
name: TestPlugin
# Module version
version: '${project.version}'
# Module main class
main: com.test.plugin.MyPlugin
# UltiTools API 级别，例如 6.3.0 为 630
api-version: 630
# Module authors
authors: 
  - yourname
# Unique identifier used by UltiTools to check for updates
identify-string: test-plugin
```

As of v6.3.0, a module built for UltiTools-API 6.3.0 declares `api-version: 630`; `/upm` on 6.3.0 installs only modules that declare `630`, the framework's own API level (see [Module versioning](/guide/advanced/module-versioning)).

### Create the main class of the module

Create a class that extends `UltiToolsPlugin` and implement `registerSelf()` for startup work.
The optional `onReload()` and `onUnregister()` hooks handle custom reload and unload work; omit them when no custom work is needed.

::: tip Since v6.3.0
`reloadSelf()` and `unregisterSelf()` are `final`. Override `onReload()` and `onUnregister()`
instead.
:::

`onUnregister()` runs before the framework unregisters this module's commands and listeners, so the module's own beans are still alive during cleanup. `onReload()` runs after the framework's own reload steps: configuration reload and language catalogue refresh.

On `/ul reload`, the framework logs one line naming the module after `onReload()` has returned. A module whose existing override only logged its own reload no longer needs that log line and can delete the override. A module with real reload or unload work renames its existing `reloadSelf()`/`unregisterSelf()` override to `onReload()`/`onUnregister()`. Remove every `super.unregisterSelf()` call from the renamed hook, keep the module's real cleanup work, and let the framework unregister commands and listeners after `onUnregister()` returns.

As of v6.3.0, `onUnregister()` may throw anything, including a checked exception it does not declare. The framework still unregisters the module's commands and listeners, closes its container and removes it from the loaded modules, then rethrows the hook's own exception to the caller unchanged, the same instance and never wrapped. If a later cleanup step also fails, that failure is attached to the hook's exception as a suppressed exception instead of replacing it.

<<< @/../examples/src/main/java/com/ultikits/docs/quickstart/MyPlugin.java

Then you have completed an UltiTools module that does nothing.

### Reload results

As of v6.3.0, `/ul reload` and `/ul reload <name>` report what each module's reload actually did:

- The framework logs the module's reload line only after `onReload()` has returned. If a reload step or `onReload()` throws, it logs one error line naming the module and the cause instead, never the success line.
- `/ul reload <name>` replies success, or failure with the cause when the reload threw.
- `/ul reload` reloads every module even when one of them fails, and replies with a summary: all modules reloaded, or which ones failed.

A reload that completes only in part can say so without throwing. Override `onReload(ReloadReport report)` instead of `onReload()`, and record each part that did not reload with `report.partial(...)`:

```java
@Override
protected void onReload(ReloadReport report) {
    try {
        scoreboardService.restart();
    } catch (RuntimeException e) {
        getLogger().error(e, "Scoreboard service did not restart");
        report.partial("scoreboard service did not restart: " + e.getMessage());
    }
}
```

The framework then logs a warning naming those parts instead of the success line, `/ul reload <name>` replies with them instead of the success reply, and the `/ul reload` summary lists the module with them. The framework records parts of its own reload steps in the same report: as of v6.3.0 a config-bound `@Scheduled` or `@CmdCD` value it refused and kept is listed there too ([#595](https://github.com/UltiKits/UltiTools-Reborn/issues/595)). The default `onReload(ReloadReport)` calls `onReload()`, so a module that overrides only `onReload()` behaves as before. Throw instead when the reload cannot continue at all. `reloadSelf()` keeps its signature, and `reloadWithReport()` runs the same reload and returns the `ReloadReport`, for a module's own reload command.

The `language` setting in the framework's `config.yml` is one value for the whole server, and `/ul reload <name>` does not apply a changed value to one module. When it has changed on disk, the module keeps the language the framework runs with, and the reload is reported as partial, naming the old and new values and that a full `/ul reload` applies the change.

### Loaded-module list

As of v6.3.0, `getPluginManager().getPluginList()` returns an unmodifiable snapshot of the loaded modules, taken when you call it. Iterating it is safe from any thread, and adding to or removing from it throws `UnsupportedOperationException`. `PluginManager.unregister(...)` removes an unloaded module from the list itself.

## Use UltiTools-API

::: tip Since v6.2.2
You can use the simpler External Plugin API: `UltiToolsAPI.connect(this)` in your plugin's `onEnable()`. See the [External Plugin API guide](./advanced/external-plugin-api.md) for details.
:::

The following section describes the legacy connector approach, which remains supported but is not recommended for new projects. As of v6.3.0, the six-parameter constructor is removed. A connector uses the seven-parameter constructor and receives `resourceFolderPath` explicitly; new integrations should use the External Plugin API from their own `JavaPlugin`.

### Create a connector class (Legacy)

Create a new class that extends `UltiToolsPlugin`, this class will be the connector class of your plugin.

<<< @/../examples/src/main/java/com/ultikits/docs/quickstart/UltiToolsConnector.java

This connector is constructed by the integrating plugin with all seven arguments, including its resource directory. A standard module instead uses the no-argument main class shown under [Create a new UltiTools module](#create-a-new-ultitools-module).

### Register your connector class (Legacy)

For a legacy integration, construct the connector and pass that instance to `UltiToolsPlugin.getPluginManager().register(connector)`. Check the returned boolean before using it. This uses the `register(UltiToolsPlugin)` overload, not a reflective constructor call.

As of v6.3.0, the reflective `register(Class, Object...)` overload and the six-parameter constructor are removed. Do not pass metadata arguments to `register(...)`. For a new standalone plugin, use [the External Plugin API](./advanced/external-plugin-api.md); for a standard module, use the no-argument main class above.

## Verify installation

If it is a module, put the module in the `plugins/UltiTools/plugins` folder and restart the server.

If it is a plugin connected to UltiTools, put the plugin in the `plugins` folder and restart the server.

Use this command in the game by OP or in the command line to verify that you have successfully connected to UltiTools.

```shell
ul list
```

If everything goes well, you should see the name and version of your plugin in the output.

```text
ul list
[12:42:16] [Server thread/INFO]: BasicFunctions 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-Login 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-MysqlConnector 1.0.0
[12:42:16] [Server thread/INFO]: UltiTools-SidebarPlugin 1.0.0
[12:42:16] [Server thread/INFO]: Example 1.0.0           <--- This is our plugin
```

In the following articles, you will learn how to use commands, events, configuration files, data storage, development annotations, etc.
