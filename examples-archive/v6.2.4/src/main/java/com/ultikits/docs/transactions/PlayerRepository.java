package com.ultikits.docs.transactions;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PlayerRepository {

    @Autowired
    private UltiToolsPlugin plugin;

    @Transactional(readOnly = true)
    public List<PlayerEntity> getAllPlayers() {
        return plugin.getDataOperator(PlayerEntity.class).getAll();
    }

    @Transactional(readOnly = true)
    public PlayerEntity getPlayerById(UUID uuid) {
        return plugin.getDataOperator(PlayerEntity.class).query()
            .where("uuid").eq(uuid.toString()).first();
    }
}
