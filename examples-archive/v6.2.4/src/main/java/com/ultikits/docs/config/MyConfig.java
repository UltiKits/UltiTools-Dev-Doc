package com.ultikits.docs.config;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;
import com.ultikits.ultitools.annotations.config.NotEmpty;
import com.ultikits.ultitools.annotations.config.Range;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigEntity("config/config.yml")
public class MyConfig extends AbstractConfigEntity {

    @Range(min = 1, max = 100)
    @ConfigEntry(path = "maxHomes", comment = "Maximum homes per player (1-100)")
    private int maxHomes = 5;

    @NotEmpty
    @ConfigEntry(path = "serverName", comment = "Server display name")
    private String serverName = "My Server";

    public MyConfig(String configFilePath) {
        super(configFilePath);
    }
}
