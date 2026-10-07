package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.gui.BaseConfirmationPage;
import com.ultikits.ultitools.abstracts.gui.BasePaginationPage;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;

import java.util.ArrayList;
import java.util.List;

public class WarpListGui extends BasePaginationPage {
    private final WarpService warpService;

    public WarpListGui(Player player, WarpService warpService) {
        super(
            player,
            "warp-list",
            Component.text("Warp Points").color(TextColor.color(0xFF00A6)),
            5
        );
        this.warpService = warpService;
    }

    @Override
    protected List<Icon> provideItems() {
        List<Icon> icons = new ArrayList<>();

        for (WarpData warp : warpService.getAllWarps()) {
            Icon warpIcon = new Icon(Material.ENDER_EYE);
            warpIcon.setName("§d" + warp.getName());

            Location loc = WarpService.toLocation(warp.getLocation());
            warpIcon.setLore(
                String.format("World: %s", loc.getWorld().getName()),
                String.format("X: %.1f Y: %.1f Z: %.1f", loc.getX(), loc.getY(), loc.getZ()),
                "",
                "Left-click: Teleport",
                "Right-click: Delete"
            );

            warpIcon.onClick(event -> {
                if (event.isLeftClick()) {
                    player.performCommand("warp tp " + warp.getName());
                    player.closeInventory();
                } else if (event.isRightClick()) {
                    showDeleteConfirmation(warp);
                }
            });

            icons.add(warpIcon);
        }

        return icons;
    }

    private void showDeleteConfirmation(WarpData warp) {
        new DeleteWarpConfirmation(player, warp.getName(), warp).open();
    }

    private class DeleteWarpConfirmation extends BaseConfirmationPage {
        private final WarpData warp;

        public DeleteWarpConfirmation(Player player, String name, WarpData warp) {
            super(
                player,
                "delete-warp",
                Component.text("Delete Warp: " + name),
                3
            );
            this.warp = warp;
        }

        @Override
        protected void setupDialogContent(InventoryOpenEvent event) {
            Icon icon = new Icon(Material.BARRIER);
            icon.setName("Delete warp?");
            addItem(getBottomCenterSlot(), icon);
        }

        @Override
        protected void onConfirm(InventoryClickEvent event) {
            warpService.delete(warp.getId());
            player.sendMessage("Warp deleted");
            // Qualify the outer instance. A bare refresh() would resolve to the
            // one this dialog inherits from BaseInventoryPage and re-open the
            // dialog instead of the list behind it.
            WarpListGui.this.refresh();
        }
    }
}
