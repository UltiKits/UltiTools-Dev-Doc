package com.ultikits.docs.declarative;

import com.ultikits.ultitools.abstracts.gui.declarative.core.BuildContext;
import com.ultikits.ultitools.abstracts.gui.declarative.core.State;
import com.ultikits.ultitools.abstracts.gui.declarative.core.StatefulWidget;
import com.ultikits.ultitools.abstracts.gui.declarative.core.Widget;
import com.ultikits.ultitools.abstracts.gui.declarative.engine.DeclarativeGui;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.*;
import com.ultikits.ultitools.abstracts.gui.declarative.util.SlotUtils;
import com.ultikits.ultitools.entities.Colors;
import com.ultikits.ultitools.utils.XVersionUtils;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;

public class ExampleShopPage extends DeclarativeGui {

    private final List<ShopItem> items;
    private int currentPage = 0;
    private int selectedSlot = -1;
    
    private static final int ITEMS_PER_PAGE = 28; // 4 rows x 7 columns
    private static final int START_SLOT = 10;     // start at row 2, column 2

    /**
     * Shop item data class.
     */
    public static class ShopItem {
        private final ItemStack display;
        private final double price;
        private final String name;

        public ShopItem(ItemStack display, double price, String name) {
            this.display = display;
            this.price = price;
            this.name = name;
        }

        public ItemStack getDisplay() {
            return display;
        }

        public double getPrice() {
            return price;
        }

        public String getName() {
            return name;
        }
    }

    /**
     * Create the shop page.
     *
     * @param player viewer
     * @param items  item list
     */
    public ExampleShopPage(@NotNull Player player, @NotNull List<ShopItem> items) {
        super(player, "example_shop", "§6§lItem Shop", 6);
        this.items = new ArrayList<>(items);
    }

    @Override
    @NotNull
    public Widget build(@NotNull BuildContext context) {
        List<Widget> children = new ArrayList<>();

        // 1. title
        children.add(createTitle());

        // 2. decorative borders
        children.addAll(createBorders());

        // 3. item grid
        children.add(createItemGrid());

        // 4. pagination controls
        children.add(createPaginationControls());

        // 5. selected item info (if any)
        if (selectedSlot >= 0) {
            children.add(createSelectedInfo());
        }

        // 6. close button
        children.add(createCloseButton());

        return Container.builder()
                .children(children)
                .build();
    }

    /** Create title button. */
    @NotNull
    private Widget createTitle() {
        return TextButton.builder()
                .text("§6§lItem Shop")
                .color("YELLOW")
                .slot(4)
                .build();
    }

    /** Create decorative borders. */
    @NotNull
    private List<Widget> createBorders() {
        List<Widget> borders = new ArrayList<>();
        ItemStack borderGlass = XVersionUtils.getColoredPlaneGlass(Colors.GRAY);

        // top and bottom borders
        for (int col = 0; col < 9; col++) {
            borders.add(ItemDisplay.builder(borderGlass)
                    .slot(col)
                    .build());
            borders.add(ItemDisplay.builder(borderGlass)
                    .slot(45 + col)
                    .build());
        }

        // left and right borders
        for (int row = 1; row < 5; row++) {
            borders.add(ItemDisplay.builder(borderGlass)
                    .slot(row * 9)
                    .build());
            borders.add(ItemDisplay.builder(borderGlass)
                    .slot(row * 9 + 8)
                    .build());
        }

        return borders;
    }

    /** Create the item grid widget. */
    @NotNull
    private Widget createItemGrid() {
        List<ShopItem> pageItems = getPageItems();
        
        List<Widget> itemWidgets = new ArrayList<>();
        for (int i = 0; i < pageItems.size(); i++) {
            ShopItem item = pageItems.get(i);
            int slot = calculateItemSlot(i);
            boolean isSelected = (slot == selectedSlot);

            itemWidgets.add(createItemWidget(item, slot, isSelected));
        }

        return Container.builder()
                .children(itemWidgets)
                .build();
    }

    /** Create a single item widget. */
    @NotNull
    private Widget createItemWidget(@NotNull ShopItem item, int slot, boolean isSelected) {
        ItemStack display = item.getDisplay().clone();
        
        // optionally add visual effect when selected
        if (isSelected) {
            // add selection effect here
        }

        return ItemDisplay.builder(display)
                .slot(slot)
                .name("§e" + item.getName())
                .lore(
                        "§7Price: §6$" + item.getPrice(),
                        "",
                        isSelected ? "§a§lSELECTED" : "§eClick to select"
                )
                .onClick(() -> selectItem(slot))
                .key("item-" + slot)
                .build();
    }

    /** Create pagination controls. */
    @NotNull
    private Widget createPaginationControls() {
        List<Widget> controls = new ArrayList<>();

        // previous page
        if (currentPage > 0) {
            controls.add(TextButton.builder()
                    .text("§a← Previous")
                    .color("GREEN")
                    .slot(45)
                    .onClick(this::goToPreviousPage)
                    .build());
        }

        // page indicator
        int totalPages = (int) Math.ceil((double) items.size() / ITEMS_PER_PAGE);
        controls.add(TextButton.builder()
                .text("§7Page §f" + (currentPage + 1) + "§7/§f" + totalPages)
                .color("GRAY")
                .slot(49)
                .build());

        // next page
        if (currentPage < totalPages - 1) {
            controls.add(TextButton.builder()
                    .text("§aNext →")
                    .color("GREEN")
                    .slot(53)
                    .onClick(this::goToNextPage)
                    .build());
        }

        return Container.builder()
                .children(controls)
                .build();
    }

    /** Create selected item info display. */
    @NotNull
    private Widget createSelectedInfo() {
        ShopItem selected = getSelectedItem();
        if (selected == null) {
            return Container.builder().build();
        }

        return TextButton.builder()
                .text("§aBuy: §f" + selected.getName())
                .color("LIME")
                .slot(47)
                .lore("§7Price: §6$" + selected.getPrice())
                .onClick(this::buySelectedItem)
                .build();
    }

    /** Create close button. */
    @NotNull
    private Widget createCloseButton() {
        return TextButton.builder()
                .text("§c§lClose")
                .color("RED")
                .slot(51)
                .onClick(() -> player.closeInventory())
                .build();
    }

    // ========== business logic ==========

    /** Get items for the current page. */
    @NotNull
    private List<ShopItem> getPageItems() {
        int start = currentPage * ITEMS_PER_PAGE;
        int end = Math.min(start + ITEMS_PER_PAGE, items.size());
        
        if (start >= items.size()) {
            return new ArrayList<>();
        }
        return items.subList(start, end);
    }

    /** Calculate the slot index for the item at `index`. */
    private int calculateItemSlot(int index) {
        int row = index / 7;  // 7 items per row
        int col = index % 7;
        return SlotUtils.toSlotIndex(START_SLOT, row, col);
    }

    /** Select an item. */
    private void selectItem(int slot) {
        setState(() -> {
            selectedSlot = slot;
        });
    }

    /** Get the currently selected ShopItem, or null. */
    private ShopItem getSelectedItem() {
        if (selectedSlot < 0) {
            return null;
        }
        
        // compute index within current page
        int indexInPage = -1;
        List<ShopItem> pageItems = getPageItems();
        for (int i = 0; i < pageItems.size(); i++) {
            if (calculateItemSlot(i) == selectedSlot) {
                indexInPage = i;
                break;
            }
        }
        
        if (indexInPage < 0 || indexInPage >= pageItems.size()) {
            return null;
        }
        
        return pageItems.get(indexInPage);
    }

    /** Buy the selected item. */
    private void buySelectedItem() {
        ShopItem selected = getSelectedItem();
        if (selected == null) {
            return;
        }

        // add actual purchase logic here (balance check, give item, etc.)
        player.sendMessage("§aYou bought §f" + selected.getName() + " §afor §6$" + selected.getPrice());
        
        // clear selection after purchase
        setState(() -> {
            selectedSlot = -1;
        });
    }

    /** Go to previous page. */
    private void goToPreviousPage() {
        if (currentPage > 0) {
            setState(() -> {
                currentPage--;
                selectedSlot = -1;  // clear selection when page changes
            });
        }
    }

    /** Go to next page. */
    private void goToNextPage() {
        int totalPages = (int) Math.ceil((double) items.size() / ITEMS_PER_PAGE);
        if (currentPage < totalPages - 1) {
            setState(() -> {
                currentPage++;
                selectedSlot = -1;  // clear selection when page changes
            });
        }
    }

    // ========== lifecycle hooks ==========

    @Override
    protected void onGuiOpen(@NotNull InventoryOpenEvent event) {
        player.sendMessage("§aWelcome to the shop!");
    }

    @Override
    protected void onGuiClose(@NotNull InventoryCloseEvent event) {
        // cleanup
    }

    @Override
    protected boolean onGuiClick(@NotNull InventoryClickEvent event) {
        // extra click handling (if needed)
        return true;  // cancel default behaviour to prevent item pickup
    }
}
