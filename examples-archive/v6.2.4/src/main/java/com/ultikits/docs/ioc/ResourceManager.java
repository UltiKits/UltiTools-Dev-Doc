package com.ultikits.docs.ioc;

import com.ultikits.ultitools.annotations.PostConstruct;
import com.ultikits.ultitools.annotations.PreDestroy;
import com.ultikits.ultitools.annotations.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

@Service
public class ResourceManager {
    private Connection dbConnection;

    @PostConstruct
    public void connect() throws SQLException {
        dbConnection = createConnection();
    }

    // @PreDestroy methods may declare checked exceptions; they are logged and
    // do not stop shutdown. Note java.sql.Connection exposes isClosed(), not
    // isOpen().
    @PreDestroy
    public void cleanup() throws SQLException {
        // Called before shutdown
        if (dbConnection != null && !dbConnection.isClosed()) {
            dbConnection.close();
        }
    }

    private Connection createConnection() throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:plugins/MyPlugin/data.db");
    }
}
