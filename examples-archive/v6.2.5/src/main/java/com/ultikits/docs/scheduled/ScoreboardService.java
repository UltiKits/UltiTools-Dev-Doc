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
public class ScoreboardService {

    @Scheduled(delay = 20, period = 200) // Start after 1 second, repeat every 10 seconds
    public void updateScoreboard() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            // Update each player's scoreboard
        }
    }
}
