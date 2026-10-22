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
public class MoneyService {

    @ExceptionCatch(defaultValue = "0")
    public int getBalance(String accountId) {
        // If exception occurs, returns 0 instead of null
        return queryBalance(accountId);
    }

    @ExceptionCatch(defaultValue = "false")
    public boolean isPlayerOnline(String playerName) {
        // Returns false instead of null
        return checkDatabase(playerName);
    }

    @ExceptionCatch(defaultValue = "empty")
    public List<User> getAllUsers() {
        // Returns empty list instead of null
        return queryAllUsers();
    }

    private int queryBalance(String accountId) { return 0; }

    private boolean checkDatabase(String playerName) { return false; }

    private List<User> queryAllUsers() { return new ArrayList<>(); }
}
