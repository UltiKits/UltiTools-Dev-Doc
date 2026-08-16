package com.ultikits.docs.ioc;

import com.ultikits.ultitools.annotations.Service;

@Service
public class ConfigService {

    public String getDatabaseUrl() {
        return "jdbc:sqlite:plugins/MyPlugin/data.db";
    }
}
