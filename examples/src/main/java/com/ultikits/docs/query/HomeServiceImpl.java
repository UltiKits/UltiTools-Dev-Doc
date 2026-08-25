package com.ultikits.docs.query;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.abstracts.data.AuditableDataEntity;
import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.*;
import com.ultikits.ultitools.interfaces.DataOperator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.bukkit.entity.Player;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class HomeServiceImpl implements HomeService {

    private final UltiToolsPlugin plugin;

    @Autowired
    public HomeServiceImpl(UltiToolsPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public HomeEntity getHome(String playerUuid, String homeName) {
        return plugin.getDataOperator(HomeEntity.class).query()
            .where("player_id").eq(playerUuid)
            .and("name").eq(homeName)
            .first();
    }

    @Override
    public List<HomeEntity> getAllHomes(String playerUuid) {
        return plugin.getDataOperator(HomeEntity.class).query()
            .where("player_id").eq(playerUuid)
            .orderBy("name")
            .list();
    }

    @Override
    public boolean homeExists(String playerUuid, String homeName) {
        return plugin.getDataOperator(HomeEntity.class).query()
            .where("player_id").eq(playerUuid)
            .and("name").eq(homeName)
            .exists();
    }

    @Override
    public void deleteHome(String playerUuid, String homeName) {
        plugin.getDataOperator(HomeEntity.class).query()
            .where("player_id").eq(playerUuid)
            .and("name").eq(homeName)
            .delete();
    }
}
