package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.gui.BaseInventoryPage;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryOpenEvent;

public class InfoGui extends BaseInventoryPage {

    public InfoGui(Player player) {
        super(
            player,
            "info-page",
            Component.text("Server Information").color(TextColor.color(0xFF00A6)),
            3  // 3 rows = 27 slots
        );
    }

    @Override
    protected void setupContent(InventoryOpenEvent event) {
        // Create a decorative border using gray glass
        Icon border = createBackgroundIcon();
        fillBorder(border);

        // Create an information icon. Icon names and lore are plain strings --
        // use legacy section codes for colour, not Adventure components.
        Icon infoIcon = new Icon(Material.BOOK);
        infoIcon.setName("Server Info");
        infoIcon.setLore(
            "Players online: 5",
            "TPS: 20.0",
            "Memory: 2GB/4GB"
        );

        // Place it at the center of the bottom row
        addItem(getBottomCenterSlot(), infoIcon);
    }

    @Override
    protected void afterSetup(InventoryOpenEvent event) {
        // Called after content is setup (optional)
        // Useful for animations or deferred processing
    }
}
