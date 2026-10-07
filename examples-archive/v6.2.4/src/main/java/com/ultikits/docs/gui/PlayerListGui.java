package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.gui.BasePaginationPage;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;

public class PlayerListGui extends BasePaginationPage {

    public PlayerListGui(Player viewer) {
        super(
            viewer,
            "player-list",
            Component.text("Online Players").color(TextColor.color(0x00FF00)),
            5  // 5 rows = 45 slots, 36 content slots per page
        );
    }

    @Override
    protected List<Icon> provideItems() {
        List<Icon> playerIcons = new ArrayList<>();

        for (Player onlinePlayer : Bukkit.getOnlinePlayers()) {
            Icon playerIcon = new Icon(Material.PLAYER_HEAD);
            playerIcon.setName("§a" + onlinePlayer.getName());

            String status = onlinePlayer.isOp() ? "Operator" : "Player";
            playerIcon.setLore(
                "Health: " + (int) onlinePlayer.getHealth(),
                "Status: " + status
            );

            playerIcon.onClick(event -> {
                player.sendMessage("Clicked: " + onlinePlayer.getName());
            });

            playerIcons.add(playerIcon);
        }

        return playerIcons;
    }
}
