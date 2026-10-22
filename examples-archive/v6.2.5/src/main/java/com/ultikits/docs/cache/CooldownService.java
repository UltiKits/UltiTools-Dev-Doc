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
public class CooldownService {

    @PlayerCache
    private final Map<UUID, Long> cooldowns = new ConcurrentHashMap<>();

    public boolean isOnCooldown(UUID playerId) {
        Long expiry = cooldowns.get(playerId);
        return expiry != null && System.currentTimeMillis() < expiry;
    }

    public void setCooldown(UUID playerId, long durationMs) {
        cooldowns.put(playerId, System.currentTimeMillis() + durationMs);
    }
}
