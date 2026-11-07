package com.ultikits.docs.scheduled;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigEntity("config/economy.yml")
public class BoundScheduleConfig extends AbstractConfigEntity {

    @ConfigEntry(path = "interest.interval", comment = "Seconds between interest payouts")
    private int interestInterval = 1800;

    public BoundScheduleConfig(String configFilePath) {
        super(configFilePath);
    }
}
