---
footer: false
---

# Quick Start

This guide builds a module for UltiTools-API 7.0 and verifies it with `/hellomodule hello`.

## Prerequisites

As of v7.0.0, use JDK 25 and Maven to build the module. Test it on a server running UltiTools 7.0 in the [framework's target environment](/guide/introduction#runtime-requirements). Put the UltiTools framework JAR in the server's `plugins/` directory; the module JAR goes in a different directory, described below. Download Paper 26.3 build 258 from the [official Paper downloads page](https://papermc.io/downloads/paper). Starting the framework requires network access to resolve its runtime libraries unless they are already cached.

Download the framework JAR from the [v7.0.0 release on GitHub](https://github.com/UltiKits/UltiTools-Reborn/releases/tag/v7.0.0) or from [Maven Central](https://repo.maven.apache.org/maven2/com/ultikits/UltiTools-API/7.0.0/UltiTools-API-7.0.0.jar). This JAR is the Paper plugin. A module built for 7.0 needs a 7.0 framework; 6.x versions do not load it.

## Project Setup

As of v7.0.0, you can use the 7.0 module template from the [UltiKits CLI](/guide/advanced/ultikits-cli). With `@ultikits/cli` 3.0.0 installed, run:

```bash
ultikits create HelloModule
cd HelloModule
```

The `HelloModule` argument names the target directory. At the prompts, enter `HelloModule` separately as the module name and `com.example.hellomodule` as the Java package. Enter a description and author, and accept the default framework version, `7.0.0`. If you are not using the CLI, create the files below in a new `HelloModule` directory instead.

### Initial Project Layout

```text
pom.xml
src/main/
├── java/com/example/hellomodule/
│   └── HelloModule.java
└── resources/
    ├── plugin.yml
    └── messages/
        ├── en.yml
        └── zh.yml
```

The CLI also generates a `README.md` and `.gitignore`. The next sections show the files required for this example. If you use the CLI, keep its `pom.xml`, `plugin.yml` and main class, then add the command and message keys below.

### Maven Build

For manual setup, use this `pom.xml`. It uses the same API coordinates, `provided` scopes and Java release as the 7.0 template. The `provided` dependencies are not bundled in the module JAR; UltiTools and Paper supply their APIs on the server.

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example.hellomodule</groupId>
  <artifactId>HelloModule</artifactId>
  <version>1.0.0</version>
  <properties>
    <java.version>25</java.version>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <ultitools.version>7.0.0</ultitools.version>
  </properties>
  <repositories>
    <repository>
      <id>papermc</id>
      <url>https://repo.papermc.io/repository/maven-public/</url>
    </repository>
  </repositories>
  <dependencies>
    <dependency>
      <groupId>io.papermc.paper</groupId>
      <artifactId>paper-api</artifactId>
      <version>26.3.build.258-stable</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>com.ultikits</groupId>
      <artifactId>UltiTools-API</artifactId>
      <version>${ultitools.version}</version>
      <scope>provided</scope>
    </dependency>
  </dependencies>
  <build>
    <resources>
      <resource>
        <directory>src/main/resources</directory>
        <filtering>true</filtering>
      </resource>
    </resources>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.16.0</version>
        <configuration><release>${java.version}</release></configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

### Module Descriptor

Place `plugin.yml` in `src/main/resources/` so Maven puts it at the JAR root. Set `name` to the module name and `main` to the fully qualified name of its concrete `UltiToolsPlugin` subclass. Set `version` to the module's own version; Maven resource filtering replaces `${project.version}` in this example. `source-language` is optional and defaults to `en`.

```yaml
name: HelloModule
version: '${project.version}'
main: com.example.hellomodule.HelloModule
api-version: 700
source-language: en
```

As of v7.0.0, `api-version` is required. It is the minimum UltiTools API level the module supports, not the Paper version or the module's own version. The framework accepts integer levels from `700` through its own level, inclusive. The template generates `700` for framework version `7.0.0`.

### Module Entry Point

Write `src/main/java/com/example/hellomodule/HelloModule.java`. `@UltiToolsModule` enables automatic registration of supported components in the scanned package. Implement `registerSelf()` and return `true` to accept startup. `onReload()` and `onUnregister()` are optional hooks for custom reload and cleanup work.

```java
package com.example.hellomodule;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;

@UltiToolsModule(scanBasePackages = "com.example.hellomodule")
public class HelloModule extends UltiToolsPlugin {
    @Override
    public boolean registerSelf() {
        return true;
    }
}
```

## First Command

As of v7.0.0, UltiTools turns `@CmdExecutor` and `@CmdMapping` into a Brigadier command tree and registers it through Paper. Add `src/main/java/com/example/hellomodule/HelloCommand.java` in the scanned package. `@CmdSender` supplies the player or console sender, and `BaseCommandExecutor` requires a `handleHelp` override. See [Command Executor](/guide/essentials/cmd-executor) for arguments and permissions.

```java
package com.example.hellomodule;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdMapping;
import com.ultikits.ultitools.annotations.command.CmdSender;
import com.ultikits.ultitools.text.Messages;
import org.bukkit.command.CommandSender;

@CmdExecutor(alias = {"hellomodule"})
public class HelloCommand extends BaseCommandExecutor {
    @Autowired
    private Messages messages;

    @CmdMapping(format = "hello")
    public void hello(@CmdSender CommandSender sender) {
        messages.send(sender, messages.key("command.hello"));
    }

    @Override
    protected void handleHelp(CommandSender sender) {
        messages.send(sender, messages.key("command.help"));
    }
}
```

## Player-Facing Text

As of v7.0.0, `Messages` and `messages/<locale>.yml` are the only text system. Put these UTF-8 catalogues under `src/main/resources/`. If you used the CLI, add the `command` entries to the generated files. `messages.key("command.hello")` refers to the module's own key; the catalogue value uses MiniMessage to colour the greeting. By default (`language: auto`), a player sees the greeting in their client language if the module has a matching catalogue; otherwise UltiTools tries the fallback language. See [Messages and Languages](/guide/essentials/messages) and [Legacy Text Migration](/guide/essentials/i18n).

```yaml
# src/main/resources/messages/en.yml
command:
  hello: '<green>Hello from HelloModule!</green>'
  help: 'Usage: /hellomodule hello'
```

```yaml
# src/main/resources/messages/zh.yml
command:
  hello: '<green>HelloModule 向你问好！</green>'
  help: '用法：/hellomodule hello'
```

## Build and Installation

From the module project directory, run:

```bash
mvn clean package
```

Maven writes `target/HelloModule-1.0.0.jar`. For a local build, stop the server, place the JAR in `plugins/UltiTools/plugins/` (create it if needed), and start the server again. When replacing your own build, remove the old copy while the server is stopped.

As of v7.0.0, `/upm install <module>`, `/upm update <module>` and `/upm uninstall <module>` queue changes for the next restart; they do not change the running modules. Use `/upm install` for a compatible module in the UltiCloud catalogue, not for the local JAR you just built. See [Module Versioning](/guide/advanced/module-versioning#updating-and-uninstalling-on-a-server) for the queue and `/upm pending`.

As of v7.0.0, Bukkit `/reload` is not supported, and `/ul reload` does not load new JARs or apply queued changes. Restart the server fully after changing a JAR.

## Verify Installation

After startup, run `ul list` in the server console (or `/ul list` as an operator in game). The output should include `HelloModule 1.0.0`. In game, run `/hellomodule hello`; the reply is `Hello from HelloModule!` in English or `HelloModule 向你问好！` in Chinese. If the module is missing, check the server startup log first. If the module is listed but the command is missing, verify that `HelloCommand` is in the scanned package.

## 6.x Documentation

For a project targeting 6.x, use the [archived v6.5.0 quick start](/v6.5.0/guide/quick-start.html) and the [older-server guide](/guide/advanced/older-servers). To move an existing module to 7.0, see the [upgrade guide](/guide/advanced/upgrading-to-7).
