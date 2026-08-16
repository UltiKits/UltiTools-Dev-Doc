package com.ultikits.docs.ioc;

import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.PostConstruct;
import com.ultikits.ultitools.annotations.Service;

@Service
public class DatabaseConnection {
    private String connectionUrl;

    @Autowired
    private ConfigService config;

    @PostConstruct
    public void initialize() {
        // Called after injection is complete
        this.connectionUrl = config.getDatabaseUrl();
        // Connect to database
        connectToDatabase();
    }

    private void connectToDatabase() {
        // initialization logic here
    }
}
