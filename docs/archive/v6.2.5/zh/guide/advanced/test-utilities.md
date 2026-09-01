# 测试工具

::: info ultikits-test-utils v1.0.0
一个独立的 Maven 构件，提供 UltiKits 插件模块开发所需的共享测试辅助工具。
:::

为 Minecraft 插件编写测试需要 mock Bukkit 单例、玩家对象和 UltiTools 框架类。`ultikits-test-utils` 库提供了现成的辅助工具，避免在每个模块中重复编写相同的样板代码。

## 引入依赖

在 `pom.xml` 中添加依赖：

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>ultikits-test-utils</artifactId>
    <version>1.0.0</version>
    <scope>test</scope>
</dependency>
```

::: tip 父 POM
如果你的模块使用了 `ultikits-module-parent`，该依赖已自动包含。
:::

## UltiToolsTestHelper

测试环境搭建的核心类。

### Mock Bukkit 服务器

安装一个 mock 的 `Bukkit.getServer()` 单例：

```java
import com.ultikits.ultitools.testing.UltiToolsTestHelper;

class MyServiceTest {

    @BeforeEach
    void setUp() {
        UltiToolsTestHelper.mockBukkitServer();
    }

    @AfterEach
    void tearDown() {
        UltiToolsTestHelper.cleanup();
    }
}
```

mock 服务器提供以下功能：
- `getLogger()` — 返回真实的 `java.util.logging.Logger`
- `getScheduler()` — 返回 mock 的 `BukkitScheduler`
- `getPluginManager()` — 返回 mock 的 `PluginManager`
- `getOnlinePlayers()` — 返回空列表
- `getMaxPlayers()` — 返回 100

### Mock 插件

创建一个预配置的 `UltiToolsPlugin` mock：

```java
UltiToolsPlugin plugin = UltiToolsTestHelper.mockPlugin();
```

mock 插件提供以下功能：
- `getLogger()` — 返回 mock 的 `PluginLogger`
- `i18n(key)` — 透传（原样返回 key）
- `getDataOperator(any())` — 返回 mock 的 `DataOperator`

### 反射辅助方法

无需编写反射样板代码即可设置和获取私有字段：

```java
// 设置私有实例字段
UltiToolsTestHelper.setField(service, "plugin", mockPlugin);

// 获取私有实例字段
DataOperator<?> op = UltiToolsTestHelper.getField(service, "dataOperator");

// 设置静态字段（如 Bukkit.server）
UltiToolsTestHelper.setStaticField(Bukkit.class, "server", mockServer);

// 获取静态字段
Server server = UltiToolsTestHelper.getStaticField(Bukkit.class, "server");
```

### 方法参考

| 方法 | 说明 |
|------|------|
| `mockBukkitServer()` | 安装 mock Bukkit 服务器单例 |
| `getMockServer()` | 返回 `mockBukkitServer()` 创建的 mock 服务器 |
| `mockPlugin()` | 创建带有常用 stub 的 mock `UltiToolsPlugin` |
| `cleanup()` | 将 `Bukkit.server` 重置为 null |
| `setStaticField(class, name, value)` | 通过反射设置静态字段 |
| `getStaticField(class, name)` | 通过反射获取静态字段 |
| `setField(target, name, value)` | 设置私有实例字段（搜索类层次结构） |
| `getField(target, name)` | 获取私有实例字段（搜索类层次结构） |

## MockFactories

创建常用 mock Bukkit 对象的工厂方法，提供合理的默认值。

### 创建 Mock 玩家

```java
import com.ultikits.ultitools.testing.MockFactories;

Player player = MockFactories.createMockPlayer("Steve");
// player.getName() → "Steve"
// player.getUniqueId() → 基于名称生成的确定性 UUID
// player.isOnline() → true
// player.hasPermission(any) → true
// player.getWorld() → 名为 "world" 的 mock World
// player.getLocation() → Location(world, 0, 64, 0)
```

使用指定的 UUID：

```java
UUID uuid = UUID.fromString("12345678-1234-1234-1234-123456789abc");
Player player = MockFactories.createMockPlayer("Steve", uuid);
```

### 创建 Mock 世界

```java
World world = MockFactories.createMockWorld("world_nether");
// world.getName() → "world_nether"
```

### 方法参考

| 方法 | 说明 |
|------|------|
| `createMockPlayer(name)` | 创建带有确定性 UUID、在线状态、所有权限的玩家 |
| `createMockPlayer(name, uuid)` | 创建带有指定 UUID 的玩家 |
| `createMockWorld(name)` | 创建带有名称 stub 的世界 |
| `createMockServer()` | 创建基本的服务器 mock |

## MockBukkitHelper

用于在测试之间清理 MockBukkit 单例状态的工具。当测试套件混合使用 MockBukkit 测试和 Mockito 测试时使用。

```java
class MixedTest {

    @BeforeEach
    void setUp() {
        MockBukkitHelper.ensureCleanState();
    }

    @AfterEach
    void tearDown() {
        MockBukkitHelper.safeUnmock();
    }
}
```

| 方法 | 说明 |
|------|------|
| `ensureCleanState()` | 重置 `Bukkit.server` 和 MockBukkit 的 `mocked` 标志 |
| `safeUnmock()` | 如果 MockBukkit 在类路径中且已初始化，调用 `MockBukkit.unmock()` |

## 完整测试示例

```java
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ultikits.ultitools.testing.UltiToolsTestHelper;
import com.ultikits.ultitools.testing.MockFactories;

class CooldownServiceTest {

    private UltiToolsPlugin plugin;
    private CooldownService service;

    @BeforeEach
    void setUp() {
        UltiToolsTestHelper.mockBukkitServer();
        plugin = UltiToolsTestHelper.mockPlugin();
        service = new CooldownService();
        UltiToolsTestHelper.setField(service, "plugin", plugin);
    }

    @AfterEach
    void tearDown() {
        UltiToolsTestHelper.cleanup();
    }

    @Test
    void shouldSetAndCheckCooldown() {
        Player player = MockFactories.createMockPlayer("Steve");
        UUID uuid = player.getUniqueId();

        service.setCooldown(uuid, 5000);

        assertThat(service.isOnCooldown(uuid)).isTrue();
    }

    @Test
    void shouldNotBeOnCooldownByDefault() {
        Player player = MockFactories.createMockPlayer("Alex");

        assertThat(service.isOnCooldown(player.getUniqueId())).isFalse();
    }
}
```

::: tip
测试工具模块使用 Mockito 5.5.0、JUnit 5.10.0 和 AssertJ 3.27.7。这些作为 compile 作用域的依赖提供，因此添加 `ultikits-test-utils` 作为 test 依赖会自动将它们引入测试类路径。
:::
