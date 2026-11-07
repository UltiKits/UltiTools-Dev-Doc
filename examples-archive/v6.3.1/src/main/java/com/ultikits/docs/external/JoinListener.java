package com.ultikits.docs.external;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.*;
import com.ultikits.ultitools.annotations.command.*;
import com.ultikits.ultitools.api.UltiToolsAPI;
import com.ultikits.ultitools.interfaces.DataOperator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.UUID;

@EventListener
public class JoinListener implements Listener {

    @Autowired
    private GreetingService greetingService;

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        greetingService.greetPlayer(event.getPlayer());
    }
}
