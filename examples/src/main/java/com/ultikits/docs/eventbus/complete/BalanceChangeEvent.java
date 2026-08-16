package com.ultikits.docs.eventbus.complete;

import com.ultikits.ultitools.events.ModuleEvent;
import lombok.Getter;

import java.util.UUID;

// In UltiEconomy module
public class BalanceChangeEvent extends ModuleEvent {
    @Getter private final UUID player;
    @Getter private final double oldBalance;
    @Getter private final double newBalance;

    public BalanceChangeEvent(UUID player, double oldBalance, double newBalance) {
        this.player = player;
        this.oldBalance = oldBalance;
        this.newBalance = newBalance;
    }
}
