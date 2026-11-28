package com.ultikits.docs.conditional;

import com.ultikits.ultitools.annotations.ConditionalOnConfig;
import com.ultikits.ultitools.annotations.Scheduled;
import com.ultikits.ultitools.annotations.Service;

@Service
@ConditionalOnConfig(value = "config/config.yml", path = "economy.enabled")
public class EconomyService {

    @Scheduled(period = 36000, async = true)
    public void distributeTax() {
        // Only runs if economy.enabled: true
    }
}
