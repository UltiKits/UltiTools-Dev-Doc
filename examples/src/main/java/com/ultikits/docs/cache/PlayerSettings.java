package com.ultikits.docs.cache;

// Example domain type; not part of the framework.
public class PlayerSettings {
    private boolean showScoreboard = true;

    public boolean isShowScoreboard() { return showScoreboard; }

    public static PlayerSettings fromEntity(PlayerSettingsEntity entity) {
        PlayerSettings settings = new PlayerSettings();
        settings.showScoreboard = entity.isShowScoreboard();
        return settings;
    }
}
