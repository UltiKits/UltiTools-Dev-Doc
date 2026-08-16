package com.ultikits.docs.cache;

import java.util.UUID;

// Example domain type; not part of the framework.
public class TeleportPrefs {
    private boolean autoAccept;

    public boolean isAutoAccept() { return autoAccept; }

    public void setAutoAccept(boolean v) { this.autoAccept = v; }

    public TeleportPrefsEntity toEntity(UUID playerId) {
        return TeleportPrefsEntity.builder()
            .playerId(playerId.toString())
            .autoAccept(autoAccept)
            .build();
    }
}
