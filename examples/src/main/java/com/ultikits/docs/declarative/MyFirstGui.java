package com.ultikits.docs.declarative;

import com.ultikits.ultitools.abstracts.gui.declarative.core.BuildContext;
import com.ultikits.ultitools.abstracts.gui.declarative.core.State;
import com.ultikits.ultitools.abstracts.gui.declarative.core.StatefulWidget;
import com.ultikits.ultitools.abstracts.gui.declarative.core.Widget;
import com.ultikits.ultitools.abstracts.gui.declarative.engine.DeclarativeGui;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.*;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;

public class MyFirstGui extends DeclarativeGui {

    public MyFirstGui(Player player) {
        // Parameters: player, GUI id, title, rows
        super(player, "my_first_gui", "Hello GUI", 6);
    }

    @Override
    public Widget build(BuildContext context) {
        // Return the root widget
        return Container.builder()
            .child(
                TextButton.builder()
                    .text("Click Me!")
                    .color("GREEN")
                    .slot(13)
                    .onClick(() -> {
                        player.sendMessage("You clicked the button!");
                    })
                    .build()
            )
            .build();
    }
}
