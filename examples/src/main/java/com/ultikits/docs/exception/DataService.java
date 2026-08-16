package com.ultikits.docs.exception;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.*;
import com.ultikits.ultitools.aop.ExceptionHandler;
import com.ultikits.ultitools.interfaces.DataOperator;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DataService {

    @ExceptionCatch(IOException.class)
    public String loadData() {
        // Only IOException will be caught
        // Other exceptions will propagate up
        return readFromFile();
    }

    @ExceptionCatch({IOException.class, SQLException.class})
    public List<User> fetchUsers() {
        // Both IOException and SQLException will be caught
        // Subclasses are also caught
        return queryDatabase();
    }

    private String readFromFile() { return ""; }

    private List<User> queryDatabase() { return new ArrayList<>(); }
}
