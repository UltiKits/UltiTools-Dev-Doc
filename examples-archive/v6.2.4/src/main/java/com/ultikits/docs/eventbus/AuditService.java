package com.ultikits.docs.eventbus;

import com.ultikits.ultitools.annotations.ModuleEventHandler;
import com.ultikits.ultitools.annotations.Service;
import org.bukkit.Bukkit;

@Service
public class AuditService {

    @ModuleEventHandler
    public void onBalanceChange(BalanceChangeEvent event) {
        Bukkit.getLogger().info(
            event.getSourceModule() + " changed balance for "
            + event.getPlayer() + " by " + event.getAmount()
        );
    }
}
