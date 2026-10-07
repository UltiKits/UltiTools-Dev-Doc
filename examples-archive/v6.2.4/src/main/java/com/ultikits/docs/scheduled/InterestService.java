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
public class InterestService {

    @Autowired
    private UltiToolsPlugin plugin;

    @Scheduled(period = 36000, async = true) // Every 30 minutes, async
    public void distributeInterest() {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);
        List<AccountEntity> accounts = dataOperator.getAll();
        for (AccountEntity account : accounts) {
            account.setBalance(account.getBalance() * 1.01);
            try {
                dataOperator.update(account);
            } catch (IllegalAccessException e) {
                Bukkit.getLogger().warning("Failed to update account: " + e.getMessage());
            }
        }
    }
}
