package com.ultikits.docs.config;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;
import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@ConfigEntity("some/path/to/config")
public class SomeConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "somepath", comment = "somecomment")
    private boolean something = false;
    @ConfigEntry(path = "someMapPath", comment = "somecomment2", parser = StringHashMapParser.class)
    private Map<String, String> someMap = new HashMap<>();

    public SomeConfig(String configFilePath) {
        super(configFilePath);
    }
}
