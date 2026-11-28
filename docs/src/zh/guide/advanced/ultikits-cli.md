# UltiKits CLI

`@ultikits/cli` 是官方命令行工具，用于将 UltiTools 插件模块发布到 [UltiCloud](https://panel.ultikits.com/) 市场。开发者可以使用它进行身份验证、初始化项目元数据、上传 JAR 文件，以及管理已发布的模块和版本。

本页对应 `@ultikits/cli` 3.0.0。1.x 版本无法连接 UltiCloud，请用 `npm install -g @ultikits/cli@latest` 升级并重新运行 `ultikits login`。

::: info 模块模板（自 v7.0.0 起）
CLI 3.0.0 的 `ultikits create` 为 Paper 26.3 和 JDK 25 生成模块工程，默认框架版本为 `7.0.0`，不接受低于 `7.0.0` 的版本。仍需 6.x 模板时，请使用 CLI `2.0.1`。
:::

如果要手工创建 7.0 模块，请按快速开始编写 [`pom.xml`](/zh/guide/quick-start#maven-构建配置) 和[模块描述文件](/zh/guide/quick-start#模块描述文件)，然后继续编写主类。

`ultikits create [directory]` 的可选参数只指定输出目录；`create` 始终通过交互提示收集输入，没有非交互选项。

::: tip 推荐：本地发布
官方 UltiTools 模块由维护者在本地发布：把验收通过的 JAR 附加到 GitHub Release，再用 CLI 将同一个文件发布到 UltiCloud。第三方开发者也可以使用相同的路径。
[GitHub Actions](#ci-cd-github-actions) 是可选的手动工作流，不是官方模块的发布路径。
:::

## 安装

```bash
npm install -g @ultikits/cli
```

验证安装：

```bash
ultikits --version
```

::: info 环境要求

- Node.js 18 及以上
- npm 或其他 Node 包管理器
- JDK 25 及以上版本和 Maven，用于构建 7.0 模板生成的工程

:::

## 身份验证

在发布之前，需要先通过 UltiCloud 身份验证。CLI 支持两种方式。

### 浏览器登录（设备授权）

```bash
ultikits login
```

CLI 会显示用户码和确认链接并打开浏览器。在浏览器中确认用户码后，CLI 会自动轮询并完成登录。

CLI 凭据保存在 `~/.ultikits/credentials.json`。

### 开发者密钥

如果你需要非交互式登录（例如在远程服务器上），可以使用开发者密钥：

1. 访问 [panel.ultikits.com/developer](https://panel.ultikits.com/developer)
2. 复制你的开发者密钥（`ucd_…`）
3. 运行 `ultikits login --token` 并在提示时粘贴密钥，或直接运行 `ultikits login --token ucd_…`
4. CLI 会先向 UltiCloud 验证密钥，再保存

### 环境变量

在 CI/CD 流水线中，设置 `ULTIKITS_TOKEN` 环境变量即可，无需运行 `ultikits login`：

```bash
export ULTIKITS_TOKEN=ucd_...
```

该值必须是开发者密钥（`ucd_…`）或 CLI 凭据（`ucc_…`），旧版 Access Token 会被拒绝。设置后它优先于已保存的凭据。`--api-url` 或 `ULTIKITS_API_URL` 可选择其他 UltiCloud API（仅限 https），默认是 `https://api.ultikits.com`。

### 其他验证命令

```bash
ultikits whoami     # 查看当前身份验证状态
ultikits logout     # 删除已保存的凭据
```

## 创建新模块

在 CLI 3.0.0 中，`ultikits create` 只生成面向 UltiTools-API 7.0.0 及以上版本的模块工程。模板以 Paper 26.3 和 Java 25 为目标。

要升级已有的 6.x 模块，见[从 6.x 升级到 7.0](/zh/guide/advanced/upgrading-to-7)。

```bash
ultikits create
```

项目目录默认与模块同名。要指定其他目录名，可运行 `ultikits create my-plugin-dir`。

### 交互提示

| 提示原文 | 默认值 | 释义及输入要求 |
|----------|--------|----------------|
| `Module name (e.g., UltiHome):` | 无 | 模块名。至少两个 ASCII 字母或数字，首字符须为大写字母。不得使用 `UltiToolsPlugin` 或 `UltiToolsModule`。 |
| `Java package name:` | 根据模块名推导，例如 `UltiHome` 对应 `com.ultikits.plugins.home` | Java 包名，由点分隔的小写标识符组成。每段以 `a`–`z` 或 `_` 开头，后续字符只能是小写字母、数字或下划线。不得使用保留字。 |
| `Short description:` | 无 | 模块简介。去掉首尾空白后不能为空。 |
| `Author:` | `git config user.name` 的值（如有） | 作者名。去掉首尾空白后不能为空。 |
| `UltiTools-API version:` | `7.0.0` | 框架版本。使用三段数字（`X.Y.Z`），可附加一段或多段以连字符分隔的 ASCII 字母数字后缀，例如 `7.0.0-SNAPSHOT`。换算出的 API 级别不得超出 32 位有符号整数的范围。低于 `7.0.0` 的版本会被拒绝，命令会要求重新输入。 |

### 生成的工程

以模块名 `UltiHome` 和默认 Java 包名为例，命令会生成以下文件：

```text
UltiHome/
├── .gitignore
├── README.md
├── pom.xml
└── src/main/
    ├── java/com/ultikits/plugins/home/UltiHome.java
    └── resources/
        ├── plugin.yml
        └── messages/
            ├── en.yml
            └── zh.yml
```

CLI 还会尝试初始化 Git 仓库，但不会创建空的 `src/test/java` 目录。

生成的 `pom.xml` 设置了编译参数 `--release 25`，并包含测试依赖。请安装 JDK 25 或更高版本，并用它运行 Maven。

模块描述文件 `plugin.yml` 中的 `api-version` 是不带引号的整数。CLI 将所选框架版本的三段数字拼接起来，不计后缀：`7.0.0-SNAPSHOT` 生成 `api-version: 700`，`7.0.1` 则生成 `api-version: 701`。

`messages/en.yml` 和 `messages/zh.yml` 使用相同的示例消息键，值用 MiniMessage 编写。描述文件将源语言设为 `source-language: en`。用法见[消息与语言](/zh/guide/essentials/messages)。

生成的主类实现 `registerSelf()`，并提供 `onUnregister()` 和 `onReload()` 两个钩子。它不覆写 `final` 方法 `unregisterSelf()` 和 `reloadSelf()`。

```java
package com.ultikits.plugins.home;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;

@UltiToolsModule(scanBasePackages = "com.ultikits.plugins.home")
public class UltiHome extends UltiToolsPlugin {

    @Override
    public boolean registerSelf() {
        return true;
    }

    @Override
    protected void onUnregister() {
        // Release any module-owned resources here.
    }

    @Override
    protected void onReload() {
        // Refresh any module-owned state after configuration reload.
    }
}
```

### 构建与测试

按命令输出的 `Next steps:`（下一步）操作。以示例中的默认目录为例，使用 JDK 25 或更高版本运行：

```bash
cd UltiHome
mvn package
```

`mvn package` 会运行你在 `src/test/java` 中添加的测试，并将模块 JAR 写入 `target/`。要测试模块，把生成的 JAR 放入服务器的 `plugins/UltiTools/plugins/` 目录，然后重启服务器。服务器应运行 Paper 26.3、Java 25 和与模块匹配的 UltiTools-API 版本。

### 不启动服务器的模块测试 {#serverless-module-tests}

将 JUnit Jupiter 测试放在 `src/test/java` 下，与被测代码使用相同的 Java 包。7.0 脚手架已添加 Jupiter 和 Mockito 测试依赖；手写工程需要将两者添加为 `test` 依赖，并使用支持 Jupiter 的 Surefire 版本。运行 `mvn test`。下列示例使用 JUnit Jupiter 6.1.3（`org.junit.jupiter.api`，与 7.0 脚手架一致）和 UltiTools 公开 API。模拟对象只记录或提供测试值，不运行 Paper。

#### 消息文件

本例在两份文件的 `greeting:` 下各写一个缩进的 `named` 键：在 `src/main/resources/messages/en.yml` 写入 `named: "Hello, <name>!"`，在 `src/main/resources/messages/zh.yml` 中写入 `named: "你好，<name>！"`。比较两份文件中所有标量值的键，包括数字和布尔值，再给占位符传入可区分的测试值，分别渲染两种语言的消息。用 Paper API 提供的 SnakeYAML 读取标量原文，与框架加载消息时的处理一致。即使键集合相同，漏写、拼错或转义 `<name>` 也会导致结果与预期文本不符。为模块中每条带参数的消息添加这样的渲染断言。直接读取模块的资源目录，避免误读依赖 JAR 中的同名文件。这里不检查服务器的语言选择、覆盖文件或游戏内投递。

```java
package com.example.mymodule;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.nodes.MappingNode;
import org.yaml.snakeyaml.nodes.ScalarNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class MessageCatalogueTest {
    @Test
    void bothLocalesProvideTheSameKeysAndRenderTheName() throws Exception {
        var en = load("en");
        var zh = load("zh");
        assertEquals(en.keySet(), zh.keySet());
        assertEquals("Hello, test-name!", renderGreeting(en));
        assertEquals("你好，test-name！", renderGreeting(zh));
    }

    private static Map<String, String> load(String locale) throws Exception {
        var module = Path.of(System.getProperty("basedir", "."));
        var catalogue = module.resolve("src/main/resources/messages/" + locale + ".yml");
        try (var reader = Files.newBufferedReader(catalogue, StandardCharsets.UTF_8)) {
            var messages = new LinkedHashMap<String, String>();
            collectScalars(assertInstanceOf(MappingNode.class, new Yaml().compose(reader)), "", messages);
            return messages;
        }
    }

    private static void collectScalars(MappingNode mapping, String prefix, Map<String, String> messages) {
        for (var entry : mapping.getValue()) {
            var key = assertInstanceOf(ScalarNode.class, entry.getKeyNode()).getValue();
            var path = prefix + key;
            if (entry.getValueNode() instanceof MappingNode nested) {
                collectScalars(nested, path + ".", messages);
            } else {
                var scalar = assertInstanceOf(ScalarNode.class, entry.getValueNode(), path);
                assertNull(messages.putIfAbsent(path, scalar.getValue()), "Duplicate message key: " + path);
            }
        }
    }

    private static String renderGreeting(Map<String, String> messages) {
        String template = messages.get("greeting.named");
        assertNotNull(template);
        var rendered = MiniMessage.miniMessage().deserialize(template, Placeholder.unparsed("name", "test-name"));
        return PlainTextComponentSerializer.plainText().serialize(rendered);
    }
}
```

#### 表单与箱子回调

使用[界面意图与会话](./ui-service)中的两个类。构造 `FormResponse` 时使用捕获到的表单中的输入句柄，不要另建同名句柄。对箱子界面，从捕获到的 `Grid` 取出动作，传入模拟点击对象并调用它。测试执行器直接运行回调，只验证模块对此的处理；Paper 的调度、表单输入、布局和物品栏事件分发需在 Paper 服务器和客户端上确认。

```java
package com.example.mymodule.ui;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;
import com.ultikits.ultitools.scheduling.Scheduler;
import com.ultikits.ultitools.scheduling.TaskContext;
import com.ultikits.ultitools.ui.Form;
import com.ultikits.ultitools.ui.FormResponse;
import com.ultikits.ultitools.ui.Grid;
import com.ultikits.ultitools.ui.GridClick;
import com.ultikits.ultitools.ui.GridSession;
import com.ultikits.ultitools.ui.GridSlot;
import com.ultikits.ultitools.ui.UiResult;
import com.ultikits.ultitools.ui.UiService;
import com.ultikits.ultitools.ui.UiSession;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ModuleUiTest {
    @Test
    @SuppressWarnings("unchecked")
    void submittedValuesReachTheHomeCallback() {
        var ui = mock(UiService.class);
        var player = mock(Player.class);
        var scheduler = mock(Scheduler.class);
        var entity = mock(TaskContext.class);
        var createHome = mock(HomeFormExample.CreateHome.class);
        UiSession<FormResponse> session = mock(UiSession.class);
        var result = new CompletableFuture<UiResult<FormResponse>>();
        when(ui.show(eq(player), any(Form.class))).thenReturn(session);
        when(session.result()).thenReturn(result);
        when(scheduler.entity(player)).thenReturn(entity);
        doAnswer(call -> {
            call.getArgument(0, Runnable.class).run();
            return null;
        }).when(entity).execute(any(Runnable.class));

        var completion = HomeFormExample.show(ui, scheduler, player, createHome);
        var form = ArgumentCaptor.forClass(Form.class);
        verify(ui).show(eq(player), form.capture());
        var inputs = form.getValue().inputs();
        var response = FormResponse.of(form.getValue(), Map.of(
                inputs.get(0), "Cabin", inputs.get(1), true, inputs.get(2), 3.0));
        result.complete(new UiResult.Completed<>(response));
        completion.toCompletableFuture().join();

        verify(createHome).create(player, "Cabin", true, 3.0);
    }

    @Test
    void arenaIconPassesTheViewerAndClosesTheSession() {
        var ui = mock(UiService.class);
        var player = mock(Player.class);
        var joined = new AtomicReference<Player>();
        ArenaMenuExample.show(ui, player, joined::set);
        var grid = ArgumentCaptor.forClass(Grid.class);
        verify(ui).show(eq(player), grid.capture());
        var session = mock(GridSession.class);
        var click = mock(GridClick.class);
        when(click.viewer()).thenReturn(player);
        when(click.session()).thenReturn(session);

        grid.getValue().item(new GridSlot(0, 4)).orElseThrow().action().orElseThrow().onClick(click);

        assertSame(player, joined.get());
        verify(session).close();
    }
}
```

#### 配置绑定的调度

使用[绑定到配置项的时间](./scheduled-tasks#绑定到配置项的时间)中的两个类。检查方法是否指向预期的配置类和 YAML 键；任务的业务逻辑可另用测试依赖直接调用。两种测试都不验证配置登记、首次触发的 tick、重复间隔或 `/ul reload` 应用新值的行为；这些需在 Paper 上确认。

```java
package com.example.mymodule.scheduling;

import com.ultikits.ultitools.annotations.ConfigEntry;
import com.ultikits.ultitools.annotations.Scheduled;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BoundScheduleTest {
    @Test
    void bothTimingsUseTheSameConfigKey() throws ReflectiveOperationException {
        var method = BoundScheduleService.class.getMethod("distributeInterest");
        var schedule = method.getAnnotation(Scheduled.class);
        assertEquals(BoundScheduleConfig.class, schedule.config());
        var field = BoundScheduleConfig.class.getDeclaredField("interestInterval");
        String key = field.getAnnotation(ConfigEntry.class).path();
        assertEquals("interest.interval", key);
        assertEquals(key, schedule.delayKey());
        assertEquals(key, schedule.periodKey());
    }
}
```

#### 配置校验

把候选值交给 `validateProposedProperties`。它校验候选状态，失败时也会恢复原字段值。本例不读写 YAML，检查空值是否被拒绝。校验会尝试构造一个临时实例，所以测试中的嵌套配置类须声明为 `public static`，并提供可访问的 `(String)` 或无参构造器。要验证实际加载或重载的结果，请在 Paper 上使用真实 YAML 文件测试。

```java
package com.example.mymodule.config;

import com.google.gson.JsonObject;
import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;
import com.ultikits.ultitools.annotations.config.NotEmpty;
import com.ultikits.ultitools.exceptions.ConfigurationException;
import com.ultikits.ultitools.exceptions.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class ConfigValidationTest {
    @ConfigEntity("config/profile.yml")
    public static class ProfileConfig extends AbstractConfigEntity {
        @ConfigEntry(path = "display-name")
        @NotEmpty
        private String name = "Explorer";

        public ProfileConfig(String path) {
            super(path);
        }
    }

    @Test
    void checksProposedValuesWithoutChangingTheLoadedValue() {
        var config = new ProfileConfig("config/profile.yml");
        var changes = new JsonObject();
        changes.addProperty("display-name", "");
        var failure = assertThrows(ConfigurationException.class,
                () -> config.validateProposedProperties(changes));
        assertEquals(ErrorCode.CONFIG_VALIDATION_FAILED, failure.getErrorCode());

        changes.addProperty("display-name", "Ranger");
        assertDoesNotThrow(() -> config.validateProposedProperties(changes));
        assertEquals("Explorer", config.name);
    }
}
```

#### 数据实体

使用[数据存储](../essentials/data-storage)中的 `PlayerNote` 和 `PlayerNoteStore`。检查实体的映射声明，以及模块是否调用了预期的数据操作。模拟操作器给记录赋一个 ID，测试只检查调用端是否返回该 ID，不验证作用域登记、ID 生成或持久化。请在 Paper 上验证登记，并用模块支持的存储后端验证写入和读回。

```java
package com.example.mymodule.data;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Table;
import com.ultikits.ultitools.interfaces.DataOperator;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PlayerNoteStoreTest {
    @Test
    @SuppressWarnings("unchecked")
    void addsTheNoteToTheExpectedEntityAndReturnsItsAssignedId() {
        var module = mock(UltiToolsPlugin.class);
        DataOperator<PlayerNote> operator = mock(DataOperator.class);
        when(module.getDataOperator(PlayerNote.class)).thenReturn(operator);
        doAnswer(call -> {
            call.getArgument(0, PlayerNote.class).setId("test-id");
            return null;
        }).when(operator).insert(any(PlayerNote.class));

        assertEquals("test-id", new PlayerNoteStore(module).addNote("Meet at spawn"));

        var inserted = ArgumentCaptor.forClass(PlayerNote.class);
        verify(operator).insert(inserted.capture());
        assertEquals("Meet at spawn", inserted.getValue().getText());
        assertEquals("my_module_player_notes", PlayerNote.class.getAnnotation(Table.class).value());
    }
}
```

#### 引导期内容

使用[声明自定义内容](./startup-phases#bootstrap-content)中的 `MyModuleBootstrap`。模拟引导上下文即可验证钩子提交了哪些声明，无需初始化注册表。要验证 Paper 是否接受声明，请装入打包好的模块完整启动服务器，确认附魔、标签和内置数据包可用。

```java
package com.example.mymodule;

import java.util.List;
import com.ultikits.ultitools.bootstrap.DatapackChannel;
import com.ultikits.ultitools.bootstrap.EnchantmentChannel;
import com.ultikits.ultitools.bootstrap.EnchantmentDefinition;
import com.ultikits.ultitools.bootstrap.ModuleBootstrapContext;
import com.ultikits.ultitools.bootstrap.TagChannel;
import io.papermc.paper.registry.RegistryKey;
import net.kyori.adventure.key.Key;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MyModuleBootstrapTest {
    @Test
    void declaresTheEnchantmentTagsAndEmbeddedPack() {
        var context = mock(ModuleBootstrapContext.class);
        var enchantments = mock(EnchantmentChannel.class);
        var packs = mock(DatapackChannel.class);
        when(context.enchantments()).thenReturn(enchantments);
        var tags = mock(TagChannel.class);
        when(context.tags()).thenReturn(tags);
        when(context.datapacks()).thenReturn(packs);

        new MyModuleBootstrap().bootstrap(context);

        verify(enchantments).register(eq(Key.key("mymodule:frost_edge")), any(EnchantmentDefinition.class));
        verify(tags).addToTag(RegistryKey.ENCHANTMENT, Key.key("minecraft:in_enchanting_table"),
                List.of(Key.key("mymodule:frost_edge")));
        verify(tags).setTag(RegistryKey.ITEM, Key.key("mymodule:frost_weapons"),
                List.of(Key.key("minecraft:diamond_sword")));
        verify(packs).embedded("frost");
    }
}
```

## 项目配置

### 初始化项目配置

在模块根目录下运行：

```bash
ultikits init
```

通过交互式提示创建 `ultikits.json` 文件：

```json
{
  "identifyString": "myplugin",
  "name": "MyPlugin",
  "shortDescription": "插件简介。",
  "categoryId": 1
}
```

| 字段 | 说明 |
|------|------|
| `identifyString` | 模块唯一标识符。3-64 个字符，小写字母、数字、`.` 和 `_`，必须以字母开头。 |
| `name` | 在市场中显示的名称。 |
| `shortDescription` | 简短描述，最多 200 个字符。 |
| `categoryId` | 模块分类（见下表）。 |

### 分类

| ID | 分类 |
|----|------|
| 1 | 实用工具 (Utilities) |
| 2 | 经济 (Economy) |
| 3 | 世界管理 (World Management) |
| 4 | 社交聊天 (Social & Chat) |
| 5 | 权限安全 (Permissions & Security) |
| 6 | 游戏玩法 (Gameplay) |

## 发布

### 基本用法

先构建并测试模块，保留准备发布的 JAR。把这个文件附加到 GitHub Release，再用 CLI 发布相同字节的文件，不要在两次上传之间重新构建：

```bash
mvn clean verify
ultikits publish target/MyPlugin-1.2.0.jar \
  --module-version 1.2.0 \
  --changelog "CHANGELOG.md 中 1.2.0 节的正文"
```

未指定 JAR 路径时，CLI 在 `./target/` 中查找文件（跳过 `-sources.jar` 和 `-javadoc.jar`）。选定 JAR 后，CLI 自动完成以下操作：
1. 使用这个文件上传
2. 从 JAR 中读取 `plugin.yml` 获取名称和版本
3. 读取 `ultikits.json` 获取标识符、描述和分类
4. 如果模块在 UltiCloud 上不存在则自动创建，这需要 manage 凭据（`ultikits login`，或轮换为管理作用域的开发者密钥）
5. 创建新版本并上传 JAR

### 带参数发布

显式指定 JAR 路径，并通过命令行参数覆盖元数据。建议把已发布版本在 `CHANGELOG.md` 中对应一节的正文作为一个完整的 `--changelog` 参数，不要传整份文件或通用占位说明。下面的示例文本应替换为该节正文：

```bash
ultikits publish target/MyPlugin-1.2.0.jar \
  --module-version 1.2.0 \
  --changelog "CHANGELOG.md 中 1.2.0 节的正文"
```

可用参数：

| 参数 | 说明 |
|------|------|
| `--id <identifyString>` | 覆盖模块标识符 |
| `--name <name>` | 显示名称，只在创建模块时使用 |
| `--module-version <version>` | 覆盖版本号 |
| `--changelog <text>` | 版本更新日志 |
| `--short-description <text>` | 简短描述，只在创建模块时使用 |
| `--api-url <url>` | UltiCloud API 地址（默认 `ULTIKITS_API_URL`、登录时保存的地址或 `https://api.ultikits.com`） |
| `-y, --yes` | 跳过所有确认提示 |

### 非交互模式

在 CI/CD 中使用 `--yes` 跳过提示，配合 `ULTIKITS_TOKEN` 进行身份验证：

```bash
ULTIKITS_TOKEN=ucd_... ultikits publish --yes \
  --module-version "1.2.0" \
  --changelog "CHANGELOG.md 中 1.2.0 节的正文"
```

### 元数据优先级

CLI 从多个来源解析元数据，优先级如下：

**CLI 参数** > **ultikits.json** > **JAR 中的 plugin.yml**

例如，如果你传入 `--module-version 1.2.0`，它会覆盖 `plugin.yml` 中的版本号。

### 上传失败与重试

文件上传从未完成的版本不算已发布，不会出现在公开列表中，也不会被选为最新版本。上传失败或中断后，用**同一个 JAR** 再次执行相同的 `ultikits publish` 命令：CLI 会为待上传的版本重新申请上传票据，旧票据随之失效。待上传版本保留首次声明的大小与 SHA-256，要上传不同的文件，请在开发者中心删除该待上传版本，或发布更高的版本号。新版本号必须大于该模块已有的所有版本（包括仍在等待上传的版本）。

已发布版本不可覆盖。修改文件后应发布新版本。如果网络故障导致结果不明，先运行 [`ultikits versions list`](#列出版本)：列出的版本已发布，不能通过重试替换。

### 模块的 API 级别

自 v6.3.0 起，UltiCloud 从你发布的 JAR 根目录的 `plugin.yml` 中读取 `api-version`，与该版本一起保存。没有任何命令行参数或 `ultikits.json` 字段可以设置它，UltiCloud 只从 JAR 中读取。请以整数形式声明：

```yaml
api-version: 700
```

从 6.3.0 起，6.x 服务器查询的级别范围为 630 到框架自身的 API 级别；更早的框架只查询低于 630 的版本。自 v7.0.0 起，服务器请求使用 `minApiLevel=700`，`/upm install` 和 `/upm update` 也只接受从 700 到框架自身级别的整数声明。

脚手架按你选的 UltiTools-API 版本写入对应的整数：`7.0.0` 和 `7.0.0-SNAPSHOT` 对应 `700`，`7.0.1` 对应 `701`。服务器上的框架 API 级别低于模块声明的级别时，框架会拒绝加载该模块。只改 `api-version` 不能让 6.x 模块在 7.0 上运行，必须针对 UltiTools-API 7.0 重新构建。见[模块版本规范](/zh/guide/advanced/module-versioning#按-api-级别选择版本)。

根目录 `plugin.yml` 没有声明整数 `api-version` 的 JAR 会在上传时被拒绝：版本不会发布，仍以已声明的文件处于待上传状态。见[因 API 级别被拒绝上传](#因-api-级别被拒绝上传)。

## 模块管理

### 列出模块

```bash
ultikits modules list
```

输出：

```
  myplugin — MyPlugin (1.0.0)
  anotherplugin — AnotherPlugin (无已发布版本 / no versions)
共 2 个模块 / 2 module(s)
```

### 模块详情

```bash
ultikits modules info myplugin
```

输出：

```
  名称 / Name:          MyPlugin
  标识符 / Identifier:  myplugin
  简介 / Summary:       插件简介
  分类 / Category:      Utilities (#1)
  最新版本 / Latest:    1.0.0
  下载 / Downloads:     42
  更新 / Updated:       2026-11-07T12:00:00.000Z
```

### 删除模块

```bash
ultikits modules delete myplugin
```

::: danger 模块会立即消失
模块会立即从目录和下载中消失。30 天内可用 `ultikits modules restore myplugin` 恢复（网页面板没有恢复功能），之后永久清除。
:::

CLI 会要求你再输入一次标识符。使用 `-y` 或没有终端时需加 `--confirm myplugin`。

### 其他模块命令

以下命令需要 manage 凭据（`ultikits login`，或轮换为管理作用域的开发者密钥）：

```bash
ultikits modules create --id myplugin --name MyPlugin   # 默认值取自 ultikits.json
ultikits modules update myplugin --short-description "新的简介"
ultikits modules restore myplugin
```

## 版本管理

### 列出版本

```bash
ultikits versions list myplugin
```

该命令从公开目录列出所有已发布和已撤回的版本及其大小和发布时间；不含待上传版本，也不发送凭据。

要核对上传的文件，读取该版本的元数据，将返回的 `sha256` 与 `sizeBytes` 与保留的 JAR 比对：

```bash
curl --fail-with-body 'https://api.ultikits.com/v1/catalogue/modules/myplugin/versions/1.2.0'
```

### 撤回版本

```bash
ultikits versions withdraw myplugin 1.2.0
```

该命令撤回已发布版本，需要 manage 凭据，且不可恢复：该版本号及更低版本不能再发布；已下载的副本不受影响。使用 `-y` 或没有终端时需加 `--confirm myplugin@1.2.0`。`versions delete` 是同一命令的旧名称。

## CI/CD — GitHub Actions {#ci-cd-github-actions}

推荐使用本地发布。如果项目需要通过 CI 发布，可以使用下面的可选方案，仅在维护者手动启动时运行。推送、合并或创建 GitHub Release 都不会触发它。在模块仓库中创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to UltiCloud

on:
  workflow_dispatch:
    inputs:
      version:
        description: Module version, for example 1.2.0
        required: true
        type: string

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Extract release notes
        env:
          MODULE_VERSION: ${{ inputs.version }}
        shell: bash
        run: |
          set -euo pipefail
          python3 - <<'PY'
          import os
          import re
          from pathlib import Path

          version = os.environ["MODULE_VERSION"]
          if not re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version):
              raise SystemExit("Expected a release version such as 1.2.0")
          lines = Path("CHANGELOG.md").read_text(encoding="utf-8").splitlines()
          heading = re.compile(r"^##[ \t]+(?:\[v?([^\]]+)\]|v?([0-9]+\.[0-9]+\.[0-9]+))(?=[ \t]|$)")
          sections = []
          start = None
          fence = None
          for index, line in enumerate(lines):
              marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
              if fence:
                  if re.fullmatch(r" {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}[ \t]*", line):
                      fence = None
                  continue
              if marker:
                  fence = marker.group(1)
                  continue
              if re.match(r"^##(?:[ \t]|$)", line):
                  if start is not None:
                      sections.append(lines[start:index])
                      start = None
                  match = heading.match(line)
                  if match and (match.group(1) or match.group(2)) == version:
                      start = index + 1
          if start is not None:
              sections.append(lines[start:])
          if len(sections) != 1:
              raise SystemExit("Expected exactly one CHANGELOG section for " + version)
          body = "\n".join(sections[0]).strip()
          if not body:
              raise SystemExit("The CHANGELOG section is empty")
          Path("release-notes.md").write_text(body + "\n", encoding="utf-8")
          PY

      - name: Set up JDK 25
        uses: actions/setup-java@v4
        with:
          java-version: '25'
          distribution: 'temurin'
          cache: maven

      - name: Set project version and verify
        env:
          MODULE_VERSION: ${{ inputs.version }}
        shell: bash
        run: |
          set -euo pipefail
          [[ "$MODULE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
          mvn -B versions:set "-DnewVersion=$MODULE_VERSION" -DgenerateBackupPoms=false
          mvn -B clean verify

      - name: Retain the built JAR
        uses: actions/upload-artifact@v4
        with:
          name: module-${{ inputs.version }}
          path: target/MyPlugin-${{ inputs.version }}.jar
          if-no-files-found: error
          retention-days: 7

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install a pinned UltiKits CLI
        run: npm install -g @ultikits/cli@3.0.0 --ignore-scripts

      - name: Publish to UltiCloud
        env:
          ULTIKITS_TOKEN: ${{ secrets.ULTIKITS_TOKEN }}
          MODULE_VERSION: ${{ inputs.version }}
        shell: bash
        run: |
          set -euo pipefail
          ultikits publish "target/MyPlugin-${MODULE_VERSION}.jar" --yes \
            --module-version "$MODULE_VERSION" \
            --changelog "$(cat release-notes.md)"
```

提取器接受唯一的 `## [1.2.0]`、`## [v1.2.0]` 或 `## 1.2.0` 标题，后面可以带日期。它保留子标题和围栏代码，到下一个二级标题或文件末尾结束；版本无效、节缺失、重复或正文为空时，在构建和发布之前拒绝。检查所选 ref，确保更新说明描述的是准备构建的字节。

### 配置步骤

1. 添加工作流文件，把两处精确 JAR 路径中的 `MyPlugin` 改为自己构建产物的最终名称。不要用通配符，以免上传源码包或未打包依赖的 JAR。
2. 把开发者密钥（`ucd_…`）设置为仓库的 `ULTIKITS_TOKEN` Secret，不要写进工作流正文或手动输入参数。上传作用域的密钥无法创建不存在的模块，请先创建模块。
3. 保持 CLI 版本固定，检查版本变更后再更新这个固定值。

::: warning 推送即发布
不要加入 `push` 或合并触发器，否则合并版本号改动就会自动发布。把工作流输入直接插入 `run:` 也可能造成 shell 注入；应像示例一样通过环境变量传递，并对变量展开放置引号。
:::

### 发布新版本

1. 检查源码和该版本的 `CHANGELOG.md` 一节。
2. 打开 **Actions > Publish to UltiCloud > Run workflow**，选择准备发布的分支或标签。
3. 只输入模块版本。工作流会从检出的 `CHANGELOG.md` 读取该版本完整节的正文，不使用多行表单输入。
4. 明确启动工作流，然后核对上传的版本与文件。这个可选方案只构建一次并发布到 UltiCloud，不会创建 GitHub Release。如需在 GitHub 发布，从工作流运行页下载 `module-<version>` 产物，解压出其中的 JAR 并附加该文件，不要重新构建。

## 常见问题

### "Not logged in" 错误

```
未登录：请运行 ultikits login，或设置环境变量 ULTIKITS_TOKEN。
```

运行 `ultikits login` 进行交互式验证，或设置 `ULTIKITS_TOKEN` 环境变量。CLI 1.x 写入的凭据文件会得到 `凭据文件是旧版格式，对新接口无效，请重新 ultikits login。`，请重新运行 `ultikits login`。

### "No JAR file specified and none found in ./target/"

CLI 默认在 `./target/` 中查找 `.jar` 文件。确保先构建项目：

```bash
mvn clean package -DskipTests
```

### 缺少必填字段

```
Missing required fields:
  - identifyString (use --id or ultikits.json)
```

使用 `ultikits init` 创建 `ultikits.json`，或通过 CLI 参数传入缺少的字段。

### 发布时凭据无效

`[invalid_credential]` 表示凭据错误或已过期，`[role_required]` 表示该账号还不是开发者。确认仓库上的 `ULTIKITS_TOKEN` Secret 设置正确：

```bash
gh secret list --repo YourOrg/YourPlugin
```

该 Secret 必须是开发者密钥（`ucd_…`）。`[key_scope_insufficient]` 表示模块不存在，而上传作用域的密钥无法创建它。

### 因 API 级别被拒绝上传

`ultikits publish` 会报以下两种代码之一：

```
JAR 里的 plugin.yml 需要整数 api-version：补上后重新构建再发布。 [upload_api_level_missing]
上传的文件不是有效的 ZIP/JAR：检查构建产物路径。 [upload_jar_invalid]
```

`upload_api_level_missing` 涵盖：根目录没有 `plugin.yml` 或 `api-version`、值为空、声明了两次，以及 `'1.19'` 这样不是整数的 Bukkit 风格值；消息不会指出具体是哪一种。`upload_jar_invalid` 表示文件不是可读的 ZIP/JAR（例如不完整的 JAR）。按[模块的 API 级别](#模块的-api-级别)声明级别并重新构建。被拒绝的版本仍以旧文件的校验和处于待上传状态：请在开发者中心删除该待上传版本后重新发布，或改用更高的版本号。
