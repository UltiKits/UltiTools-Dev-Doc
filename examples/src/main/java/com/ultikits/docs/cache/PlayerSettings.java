package com.ultikits.docs.cache;

// Example domain type; not part of the framework.
public class PlayerSettings {
    private boolean showScoreboard = true;
    private boolean dirty;

    public boolean isShowScoreboard() { return showScoreboard; }

    public void set(String key, Object value) {
        if ("showScoreboard".equals(key)) {
            this.showScoreboard = Boolean.parseBoolean(String.valueOf(value));
        }
        this.dirty = true;
    }

    public boolean isDirty() { return dirty; }

    public PlayerSettingsEntity toEntity() {
        return PlayerSettingsEntity.builder().showScoreboard(showScoreboard).build();
    }

    public static PlayerSettings fromEntity(PlayerSettingsEntity entity) {
        PlayerSettings settings = new PlayerSettings();
        settings.showScoreboard = entity.isShowScoreboard();
        return settings;
    }
}
