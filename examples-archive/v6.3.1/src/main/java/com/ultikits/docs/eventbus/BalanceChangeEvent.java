package com.ultikits.docs.eventbus;

import com.ultikits.ultitools.events.ModuleEvent;
import lombok.Getter;

import java.util.UUID;

public class BalanceChangeEvent extends ModuleEvent {
    @Getter private final UUID player;
    @Getter private final double amount;

    public BalanceChangeEvent(UUID player, double amount) {
        this.player = player;
        this.amount = amount;
    }
}
