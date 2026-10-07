package com.ultikits.docs.validation;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;
import com.ultikits.ultitools.annotations.config.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Getter
@Setter
@ConfigEntity("config/config.yml")
public class PluginConfig extends AbstractConfigEntity {

    @Range(min = 0, max = 300)
    @ConfigEntry(path = "teleport.warmup", comment = "Teleport warmup in seconds (0-300)")
    private int teleportWarmup = 3;

    @Range(min = 0, max = 3600)
    @ConfigEntry(path = "teleport.cooldown", comment = "Teleport cooldown in seconds (0-3600)")
    private int teleportCooldown = 60;

    @Range(min = 1, max = 100)
    @ConfigEntry(path = "home.maxHomes", comment = "Maximum homes per player (1-100)")
    private int maxHomes = 5;

    @NotEmpty
    @ConfigEntry(path = "messages.prefix", comment = "Chat prefix for plugin messages")
    private String messagePrefix = "[MyPlugin]";

    @Size(min = 1, max = 20)
    @ConfigEntry(path = "worlds.allowed", comment = "Worlds where the plugin is active")
    private List<String> allowedWorlds = Arrays.asList("world");

    @Pattern(regex = "^(DIAMOND|GOLD|IRON|STONE|WOOD)$")
    @ConfigEntry(path = "gui.borderItem", comment = "Border item material")
    private String borderItem = "DIAMOND";

    public PluginConfig(String configFilePath) {
        super(configFilePath);
    }
}
