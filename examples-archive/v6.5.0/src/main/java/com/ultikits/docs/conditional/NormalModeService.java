package com.ultikits.docs.conditional;

import com.ultikits.ultitools.annotations.ConditionalOnConfig;
import com.ultikits.ultitools.annotations.Service;

@Service
@ConditionalOnConfig(value = "config/config.yml", path = "maintenance", negate = true)
public class NormalModeService {
    // Only active when maintenance: false (or missing)
}
