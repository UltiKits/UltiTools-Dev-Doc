---
footer: false
---

# 快速开始

本指南以 UltiTools-API 7.0 为目标构建模块，并用 `/hellomodule hello` 验证安装。

## 前置条件

自 v7.0.0 起，使用 JDK 25 和 Maven 构建模块。在符合[框架目标环境](/zh/guide/introduction#运行环境)的服务器上运行 UltiTools 7.0 来测试模块。将 UltiTools 框架 JAR 放在服务器的 `plugins/` 目录；模块 JAR 的安装目录不同，见下文。请从 [Paper 官方下载页](https://papermc.io/downloads/paper)获取 Paper 26.3 build 258。启动框架时需要联网解析运行库，除非这些库已缓存。

从 [GitHub 的 v7.0.0 发布页](https://github.com/UltiKits/UltiTools-Reborn/releases/tag/v7.0.0)或 [Maven Central](https://repo.maven.apache.org/maven2/com/ultikits/UltiTools-API/7.0.0/UltiTools-API-7.0.0.jar)下载框架 JAR。这个 JAR 是 Paper 插件。为 7.0 构建的模块需要 7.0 框架，6.x 版本不会加载它。

## 项目创建

自 v7.0.0 起，可以用 [UltiKits CLI](/zh/guide/advanced/ultikits-cli) 的 7.0 模块模板创建项目。安装 `@ultikits/cli` 3.0.0 后，执行：

```bash
ultikits create HelloModule
cd HelloModule
```

参数 `HelloModule` 指定目标目录名。在交互提示中另填模块名 `HelloModule`，Java 包名填 `com.example.hellomodule`，再填写简介和作者，框架版本保留默认的 `7.0.0`。如果不使用 CLI，请新建 `HelloModule` 目录，再按下文手工创建文件。

### 初始目录结构

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

CLI 还会生成 `README.md` 和 `.gitignore`。下文只展示本示例所需的文件。如果使用 CLI，保留生成的 `pom.xml`、`plugin.yml` 和主类，再添加下文的命令与消息键。

### Maven 构建配置

手工创建项目时，使用下面的 `pom.xml`。它使用与 7.0 模板相同的 API 坐标、`provided` 作用域和 Java 编译目标。`provided` 依赖不打入模块 JAR，运行时由 UltiTools 和 Paper 提供各自的 API。

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

### 模块描述文件

将 `plugin.yml` 放在 `src/main/resources/`，Maven 会将它打包到 JAR 根目录。`name` 填模块名，`main` 填具体 `UltiToolsPlugin` 子类的完整类名。`version` 填模块自身的版本；本例由 Maven 资源过滤替换 `${project.version}`。`source-language` 可省略，默认值为 `en`。

```yaml
name: HelloModule
version: '${project.version}'
main: com.example.hellomodule.HelloModule
api-version: 700
source-language: en
```

自 v7.0.0 起，`api-version` 是必填项。它是模块支持的最低 UltiTools API 级别，不是 Paper 版本，也不是模块自身的版本。框架接受 `700` 至自身 API 级别之间的整数，含两端。选择框架版本 `7.0.0` 时，模板生成的值为 `700`。

### 模块主类

编写 `src/main/java/com/example/hellomodule/HelloModule.java`。`@UltiToolsModule` 启用扫描包内受支持组件的自动注册。实现 `registerSelf()` 并返回 `true`，允许模块启动。`onReload()` 和 `onUnregister()` 是可选钩子，用于自定义重载与清理。

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

## 第一个命令

自 v7.0.0 起，UltiTools 将 `@CmdExecutor` 和 `@CmdMapping` 编译成 Brigadier 命令树，通过 Paper 注册。在扫描包中添加 `src/main/java/com/example/hellomodule/HelloCommand.java`。`@CmdSender` 注入命令发送者，支持玩家或控制台；继承 `BaseCommandExecutor` 需要重写 `handleHelp`。命令参数和权限见[命令执行器](/zh/guide/essentials/cmd-executor)。

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

## 玩家可见文本

自 v7.0.0 起，`Messages` 和 `messages/<locale>.yml` 是唯一的文本系统。将下面的 UTF-8 语言文件放在 `src/main/resources/` 下。如果使用了 CLI，将 `command` 条目添加到已有文件中。`messages.key("command.hello")` 引用当前模块的消息键；消息值使用 MiniMessage 为问候文字着色。默认配置 `language: auto` 下，模块有匹配的语言文件时，玩家会收到客户端语言的问候；否则框架会尝试后备语言。见[消息与语言](/zh/guide/essentials/messages)和[旧文本迁移](/zh/guide/essentials/i18n)。

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

## 构建与安装

在模块项目目录执行：

```bash
mvn clean package
```

Maven 生成 `target/HelloModule-1.0.0.jar`。安装本地构建时，先停止服务器，把 JAR 放进 `plugins/UltiTools/plugins/`（如无此目录则创建），再启动服务器。替换自己的构建时，在停服期间移除旧副本。

自 v7.0.0 起，`/upm install <模块名>`、`/upm update <模块名>` 和 `/upm uninstall <模块名>` 将变更排队到下次重启，不会改变正在运行的模块。`/upm install` 用于安装 UltiCloud 目录中的兼容模块，不用于安装刚构建的本地 JAR。关于待生效清单与 `/upm pending`，见[模块版本规范](/zh/guide/advanced/module-versioning#在服务器上更新和卸载)。

自 v7.0.0 起，不支持 Bukkit `/reload`；`/ul reload` 不加载新的 JAR，也不应用排队的变更。JAR 发生变更后，请完整重启服务器。

## 验证安装

启动后，在服务器控制台执行 `ul list`，或以管理员身份在游戏中执行 `/ul list`。输出应包含 `HelloModule 1.0.0`。在游戏中执行 `/hellomodule hello`，英文回复为 `Hello from HelloModule!`，中文回复为 `HelloModule 向你问好！`。如果列表中没有模块，先检查服务器启动日志；如果模块已列出但没有命令，请确认 `HelloCommand` 位于扫描包内。

## 6.x 文档

面向 6.x 的项目请参阅[归档的 v6.5.0 快速开始](/zh/v6.5.0/guide/quick-start.html)和[旧服务器指南](/zh/guide/advanced/older-servers)。如果要将已有模块迁到 7.0，请参阅[升级指南](/zh/guide/advanced/upgrading-to-7)。
