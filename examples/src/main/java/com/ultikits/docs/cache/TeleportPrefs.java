package com.ultikits.docs.cache;

// Example domain type; not part of the framework.
public class TeleportPrefs {
    private final boolean autoAccept;

    public TeleportPrefs(boolean autoAccept) { this.autoAccept = autoAccept; }

    public boolean isAutoAccept() { return autoAccept; }

    public static TeleportPrefs fromEntity(TeleportPrefsEntity entity) {
        return new TeleportPrefs(entity.isAutoAccept());
    }
}
