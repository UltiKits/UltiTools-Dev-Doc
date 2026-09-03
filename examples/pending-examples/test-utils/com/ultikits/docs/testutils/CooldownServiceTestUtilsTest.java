package com.ultikits.docs.testutils;

import com.ultikits.docs.cache.CooldownService;
import com.ultikits.ultitools.testing.MockFactories;
import com.ultikits.ultitools.testing.UltiToolsTestHelper;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Compilable companion to the "Complete Test Example" on the Test Utilities guide page
 * (docs/src/guide/advanced/test-utilities.md), exercised against the real
 * {@link CooldownService} example class this project already compiles, so the guide's
 * prose and a real build cannot silently drift apart. The method calls here are taken
 * verbatim from ultikits-test-utils's own README usage snippet.
 *
 * <p><b>Not part of the default build.</b> ultikits-test-utils is not yet published to
 * Maven Central (see 08-19-SUMMARY.md / 08-RELEASE-PACKAGE.md in the framework repository's
 * .planning/ directory), and this project compiles against Central's latest release, so
 * pulling this file into the default source scan today would turn every push and every PR
 * red on a dependency that cannot resolve. See the {@code test-utils-examples} Maven
 * profile in {@code examples/pom.xml} for the exact condition that re-enables it.
 */
class CooldownServiceTestUtilsTest {

    private CooldownService service;

    @BeforeEach
    void setUp() {
        UltiToolsTestHelper.mockBukkitServer();
        service = new CooldownService();
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
