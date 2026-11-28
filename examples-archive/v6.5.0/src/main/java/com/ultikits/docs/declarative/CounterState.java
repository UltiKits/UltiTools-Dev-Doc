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

// 2. Define the State
public class CounterState extends State<CounterWidget> {
    private int count = 0; // persistent across rebuilds

    @Override
    public Widget build(BuildContext context) {
        return TextButton.builder()
            .slot(13)
            .text("Count: " + count)
            .color("BLUE")
            .onClick(() -> {
                // 3. update state inside setState
                setState(() -> {
                    count++;
                });
            })
            .build();
    }
}
