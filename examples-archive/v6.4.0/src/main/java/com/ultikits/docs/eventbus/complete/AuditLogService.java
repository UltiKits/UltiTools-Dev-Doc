package com.ultikits.docs.eventbus.complete;

import com.ultikits.ultitools.annotations.ModuleEventHandler;
import com.ultikits.ultitools.annotations.Service;
import org.bukkit.Bukkit;

// In a separate audit module
@Service
public class AuditLogService {

    @ModuleEventHandler
    public void onBalanceChange(BalanceChangeEvent event) {
        double delta = event.getNewBalance() - event.getOldBalance();
        Bukkit.getLogger().info(String.format(
            "[Audit] %s balance: %.2f -> %.2f (delta: %+.2f) from %s",
            event.getPlayer(), event.getOldBalance(),
            event.getNewBalance(), delta, event.getSourceModule()
        ));
    }
}
