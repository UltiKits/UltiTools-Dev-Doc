package com.ultikits.docs.cache;

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
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService implements PlayerCacheSaver {

    @PlayerCache
    private final Map<UUID, Integer> scores = new ConcurrentHashMap<>();

    @PlayerCache(saveBeforeRemove = true)
    private final Map<UUID, Inventory> openInventories = new ConcurrentHashMap<>();

    @PlayerCache
    private final Map<UUID, Long> lastActivity = new ConcurrentHashMap<>();

    @Override
    public void savePlayerData(UUID playerId) {
        // Called only for the saveBeforeRemove=true field,
        // but you can save all data here
    }
}
