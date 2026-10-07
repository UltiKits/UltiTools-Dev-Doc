package com.ultikits.docs.scheduled;

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
public class AutoSaveService {

    @Scheduled(period = 6000) // Every 5 minutes (6000 ticks)
    public void autoSave() {
        // This method is called automatically by the framework
        Bukkit.getLogger().info("Auto-saving data...");
    }
}
