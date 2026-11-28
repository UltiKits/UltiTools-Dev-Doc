package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigEntity("config/essentials.yml")
public class BoundCooldownConfig extends AbstractConfigEntity {

    @ConfigEntry(path = "features.wild.cooldown", comment = "Cooldown for /wild in seconds")
    private int wildCooldown = 60;

    public BoundCooldownConfig(String configFilePath) {
        super(configFilePath);
    }
}
