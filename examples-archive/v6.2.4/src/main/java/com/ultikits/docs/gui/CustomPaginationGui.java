package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.gui.BasePaginationPage;
import com.ultikits.ultitools.entities.Colors;
import mc.obliviate.inventory.Icon;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;

public class CustomPaginationGui extends BasePaginationPage {

    // Move the navigation buttons to the far edges of the toolbar.
    protected static final int PREV_BUTTON_COLUMN = 0;
    protected static final int NEXT_BUTTON_COLUMN = 8;

    public CustomPaginationGui(Player player) {
        super(player, "custom-pagination", "Custom Pagination", 5);
    }

    @Override
    protected List<Icon> provideItems() {
        return new ArrayList<>();
    }

    @Override
    protected Icon createPreviousButton() {
        // createActionButton takes a plain String name, not a Component.
        return createActionButton(
            Colors.BLUE,
            "§9← Back",
            e -> {
                if (!getPaginationManager().isFirstPage()) {
                    getPaginationManager().goPreviousPage();
                    refresh();
                }
            }
        );
    }

    @Override
    protected Icon createNextButton() {
        return createActionButton(
            Colors.GREEN,
            "§aNext →",
            e -> {
                if (!getPaginationManager().isLastPage()) {
                    getPaginationManager().goNextPage();
                    refresh();
                }
            }
        );
    }
}
