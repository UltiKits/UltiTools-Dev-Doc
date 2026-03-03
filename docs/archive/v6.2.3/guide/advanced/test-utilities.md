# Test Utilities

::: info ultikits-test-utils v1.0.0
A standalone Maven artifact providing shared test helpers for UltiKits plugin module development.
:::

Writing tests for Minecraft plugins requires mocking the Bukkit singleton, player objects, and UltiTools framework classes. The `ultikits-test-utils` library provides ready-made helpers so you don't have to write the same boilerplate in every module.

## Setup

Add the dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>ultikits-test-utils</artifactId>
    <version>1.0.0</version>
    <scope>test</scope>
</dependency>
```

::: tip Parent POM
If your module uses `ultikits-module-parent`, this dependency is already included.
:::

## UltiToolsTestHelper

The core class for setting up the test environment.

### Mock Bukkit Server

Install a mock `Bukkit.getServer()` singleton:

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

The mock server provides:
- `getLogger()` — returns a real `java.util.logging.Logger`
- `getScheduler()` — returns a mock `BukkitScheduler`
- `getPluginManager()` — returns a mock `PluginManager`
- `getOnlinePlayers()` — returns an empty list
- `getMaxPlayers()` — returns 100

### Mock Plugin

Create a pre-configured `UltiToolsPlugin` mock:

```java
UltiToolsPlugin plugin = UltiToolsTestHelper.mockPlugin();
```

The mock plugin provides:
- `getLogger()` — returns a mock `PluginLogger`
- `i18n(key)` — passthrough (returns the key as-is)
- `getDataOperator(any())` — returns a mock `DataOperator`

### Reflection Helpers

Set and get private fields without writing reflection boilerplate:

```java
// Set a private instance field
UltiToolsTestHelper.setField(service, "plugin", mockPlugin);

// Get a private instance field
DataOperator<?> op = UltiToolsTestHelper.getField(service, "dataOperator");

// Set a static field (e.g., Bukkit.server)
UltiToolsTestHelper.setStaticField(Bukkit.class, "server", mockServer);

// Get a static field
Server server = UltiToolsTestHelper.getStaticField(Bukkit.class, "server");
```

### Method Reference

| Method | Description |
|--------|-------------|
| `mockBukkitServer()` | Installs a mock Bukkit Server singleton |
| `getMockServer()` | Returns the mock Server created by `mockBukkitServer()` |
| `mockPlugin()` | Creates a mock `UltiToolsPlugin` with common stubs |
| `cleanup()` | Resets `Bukkit.server` to null |
| `setStaticField(class, name, value)` | Sets a static field via reflection |
| `getStaticField(class, name)` | Gets a static field via reflection |
| `setField(target, name, value)` | Sets a private instance field (searches class hierarchy) |
| `getField(target, name)` | Gets a private instance field (searches class hierarchy) |

## MockFactories

Factory methods for creating commonly-mocked Bukkit objects with sensible defaults.

### Create a Mock Player

```java
import com.ultikits.ultitools.testing.MockFactories;

Player player = MockFactories.createMockPlayer("Steve");
// player.getName() → "Steve"
// player.getUniqueId() → deterministic UUID from name
// player.isOnline() → true
// player.hasPermission(any) → true
// player.getWorld() → mock World named "world"
// player.getLocation() → Location(world, 0, 64, 0)
```

With a specific UUID:

```java
UUID uuid = UUID.fromString("12345678-1234-1234-1234-123456789abc");
Player player = MockFactories.createMockPlayer("Steve", uuid);
```

### Create a Mock World

```java
World world = MockFactories.createMockWorld("world_nether");
// world.getName() → "world_nether"
```

### Method Reference

| Method | Description |
|--------|-------------|
| `createMockPlayer(name)` | Player with deterministic UUID, online, all permissions |
| `createMockPlayer(name, uuid)` | Player with specific UUID |
| `createMockWorld(name)` | World with name stub |
| `createMockServer()` | Basic Server mock |

## MockBukkitHelper

Utilities for cleaning up MockBukkit singleton state between tests. Use this when your test suite mixes MockBukkit tests with Mockito-based tests.

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

| Method | Description |
|--------|-------------|
| `ensureCleanState()` | Resets both `Bukkit.server` and MockBukkit's `mocked` flag |
| `safeUnmock()` | Calls `MockBukkit.unmock()` if MockBukkit is on the classpath and was initialized |

## Complete Test Example

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
The test utilities module uses Mockito 5.5.0, JUnit 5.10.0, and AssertJ 3.27.7. These are provided as compile-scope dependencies, so adding `ultikits-test-utils` as a test dependency automatically brings them into your test classpath.
:::
