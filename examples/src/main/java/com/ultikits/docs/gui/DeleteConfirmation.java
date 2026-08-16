package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.gui.BaseConfirmationPage;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;

public class DeleteConfirmation extends BaseConfirmationPage {
    private final String itemName;

    public DeleteConfirmation(Player player, String itemName) {
        super(
            player,
            "delete-confirm",
            Component.text("Confirm Deletion").color(TextColor.color(0xFF0000)),
            3
        );
        this.itemName = itemName;
    }

    @Override
    protected void setupDialogContent(InventoryOpenEvent event) {
        // Display the item being deleted in the center
        Icon warningIcon = new Icon(Material.BARRIER);
        warningIcon.setName("Delete " + itemName + "?");
        warningIcon.setLore(
            "Are you sure you want to delete this?",
            "This action cannot be undone."
        );
        addItem(getBottomCenterSlot(), warningIcon);
    }

    @Override
    protected String getOkButtonName() {
        return "Delete";
    }

    @Override
    protected String getCancelButtonName() {
        return "Cancel";
    }

    @Override
    protected void onConfirm(InventoryClickEvent event) {
        // Perform deletion
        player.sendMessage("Deleted: " + itemName);
        // ... deletion logic ...
    }

    @Override
    protected void onCancel(InventoryClickEvent event) {
        player.sendMessage("Deletion cancelled");
    }
}
