package com.ultikits.docs.declarative;

import com.ultikits.ultitools.abstracts.gui.declarative.core.BuildContext;
import com.ultikits.ultitools.abstracts.gui.declarative.core.Widget;
import com.ultikits.ultitools.abstracts.gui.declarative.engine.DeclarativeGui;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.Container;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.GridView;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.ItemDisplay;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.TextButton;
import com.ultikits.ultitools.item.ItemSpec;
import com.ultikits.ultitools.scheduling.Scheduler;
import com.ultikits.ultitools.text.Text;
import com.ultikits.ultitools.ui.UiService;
import org.bukkit.Material;
import org.bukkit.entity.Player;

import java.util.List;

public class ExampleShopPage extends DeclarativeGui {
    private static final int COLUMNS = 7;
    private static final int ITEMS_PER_PAGE = 4 * COLUMNS;
    private static final ItemSpec BORDER = ItemSpec.builder(Material.GRAY_STAINED_GLASS_PANE).build();

    private final List<ShopItem> items;
    private int currentPage;
    private ShopItem selectedItem;

    public record ShopItem(String id, ItemSpec display, String name, int price) {}

    public ExampleShopPage(UiService ui, Scheduler scheduler, Player viewer, List<ShopItem> items) {
        super(ui, scheduler, viewer, "example_shop", Text.plain("Item Shop"), 6);
        this.items = List.copyOf(items);
    }

    @Override
    public Widget build(BuildContext context) {
        int start = currentPage * ITEMS_PER_PAGE;
        List<ShopItem> pageItems = items.subList(start, start + Math.min(ITEMS_PER_PAGE, items.size() - start));
        int totalPages = 1 + Math.max(0, items.size() - 1) / ITEMS_PER_PAGE;

        var layout = Container.builder()
            .child(GridView.<ShopItem>builder()
                .startSlot(10)
                .columns(COLUMNS)
                .items(pageItems, this::itemWidget)
                .build())
            .child(TextButton.builder()
                .text(Text.plain("Page " + (currentPage + 1) + "/" + totalPages))
                .color("GRAY").slot(49).build())
            .child(TextButton.builder()
                .text(Text.plain("Close"))
                .color("RED").slot(53)
                .onClick(click -> click.session().close())
                .build());

        for (int slot = 0; slot < 9; slot++) {
            layout.child(ItemDisplay.builder(BORDER).slot(slot).build());
        }
        for (int row = 1; row <= 4; row++) {
            layout.child(ItemDisplay.builder(BORDER).slot(row * 9).build());
            layout.child(ItemDisplay.builder(BORDER).slot(row * 9 + 8).build());
        }
        if (currentPage > 0) {
            layout.child(TextButton.builder()
                .text(Text.plain("Previous"))
                .color("GREEN").slot(45)
                .onClick(click -> changePage(-1, totalPages))
                .build());
        }
        if (currentPage + 1 < totalPages) {
            layout.child(TextButton.builder()
                .text(Text.plain("Next"))
                .color("GREEN").slot(46)
                .onClick(click -> changePage(1, totalPages))
                .build());
        }
        ShopItem selected = selectedItem;
        if (selected != null) {
            layout.child(TextButton.builder()
                .text(Text.plain("Buy: " + selected.name()))
                .lore(List.of(priceLine(selected)))
                .color("LIME").slot(51)
                .onClick(click -> buy(selected))
                .build());
        }
        return layout.build();
    }

    private Widget itemWidget(ShopItem item) {
        ItemSpec display = item.display().toBuilder()
            .name(Text.plain(item.name()))
            .addLore(priceLine(item))
            .addLore(Text.plain(item == selectedItem ? "Selected" : "Click to select"))
            .build();
        return ItemDisplay.builder(display)
            .key(item.id())
            .onClick(click -> setState(() -> selectedItem = item))
            .build();
    }

    private static Text priceLine(ShopItem item) {
        return Text.plain("Price: " + item.price() + " coins");
    }

    private void changePage(int delta, int totalPages) {
        int nextPage = currentPage + delta;
        if (nextPage >= 0 && nextPage < totalPages) {
            setState(() -> {
                currentPage = nextPage;
                selectedItem = null;
            });
        }
    }

    private void buy(ShopItem item) {
        if (selectedItem != item) {
            return;
        }
        // Demonstrates the action only; it neither charges nor grants an item.
        viewer().sendMessage("Selected for purchase: " + item.name());
        setState(() -> selectedItem = null);
    }
}
