package com.ultikits.docs.scheduled;

import com.ultikits.ultitools.UltiTools;
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
public class ServerMonitorService {

    @Autowired
    private UltiToolsPlugin plugin;

    // Check server health every minute
    @Scheduled(delay = 1200, period = 1200, async = true)
    public void checkServerHealth() {
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        long maxMemory = runtime.maxMemory();
        double memoryUsage = (double) usedMemory / maxMemory * 100;

        if (memoryUsage > 90) {
            Bukkit.getScheduler().runTask(UltiTools.getInstance(), () -> {
                Bukkit.broadcastMessage("[Monitor] Warning: Memory usage at "
                    + String.format("%.1f", memoryUsage) + "%");
            });
        }
    }

    // Clean expired data daily (24 hours = 1,728,000 ticks)
    @Scheduled(period = 1728000, async = true)
    public void cleanExpiredData() {
        DataOperator<TempDataEntity> dataOperator =
            plugin.getDataOperator(TempDataEntity.class);
        dataOperator.query()
            .where("expireTime").lt(System.currentTimeMillis())
            .delete();
    }
}
