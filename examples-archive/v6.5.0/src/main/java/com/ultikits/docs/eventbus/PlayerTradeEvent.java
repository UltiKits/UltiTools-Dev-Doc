package com.ultikits.docs.eventbus;

import com.ultikits.ultitools.events.Cancellable;
import com.ultikits.ultitools.events.ModuleEvent;

public class PlayerTradeEvent extends ModuleEvent implements Cancellable {
    private boolean cancelled;

    @Override
    public boolean isCancelled() { return cancelled; }

    @Override
    public void setCancelled(boolean cancelled) { this.cancelled = cancelled; }

    // ... your event data
}
