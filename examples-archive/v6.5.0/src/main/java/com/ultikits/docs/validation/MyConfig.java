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
public class MyConfig extends AbstractConfigEntity {

    @Range(min = 1, max = 10)
    @ConfigEntry(path = "maxHomes", comment = "Maximum number of homes (1-10)")
    private int maxHomes = 5;

    @Range(min = 0.0, max = 100.0)
    @ConfigEntry(path = "taxRate", comment = "Tax rate percentage (0-100)")
    private double taxRate = 5.0;

    public MyConfig(String configFilePath) {
        super(configFilePath);
    }
}
