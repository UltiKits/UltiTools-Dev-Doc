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
public class ConfigService {

    @ExceptionCatch(silent = true)
    public void saveOptionalConfig() {
        // Any exception is caught and NOT logged
        // Useful for non-critical background operations
        writeConfigBackup();
    }

    @ExceptionCatch(value = FileNotFoundException.class, silent = true)
    public boolean fileExists(String path) {
        // FileNotFoundException is silently caught
        // Other exceptions are still logged
        return checkFile(path);
    }

    private void writeConfigBackup() { }

    private boolean checkFile(String path) { return true; }
}
