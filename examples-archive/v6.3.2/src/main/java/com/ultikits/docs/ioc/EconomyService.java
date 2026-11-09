package com.ultikits.docs.ioc;

import com.ultikits.ultitools.annotations.ConditionalOnConfig;
import com.ultikits.ultitools.annotations.Service;

@Service
@ConditionalOnConfig(value = "config/config.yml", path = "features.economy")
public class EconomyService {
    // Only registered if features.economy: true in config.yml
}
