# GUI Interface

<Badge type="tip" text="v6.2.0+" />

::: info Modern GUI System
The GUI system has been rebuilt with `BaseInventoryPage`, `BasePaginationPage`, and `BaseConfirmationPage` base classes. These replace the deprecated `PagingPage` and `OkCancelPage` from earlier versions.
:::

UltiTools provides a comprehensive GUI system built on top of the [obliviate-invs](https://github.com/hamza-cskn/obliviate-invs) library. This integration allows you to create rich, interactive inventory-based interfaces without worrying about low-level Bukkit inventory management.

## Architecture Overview

The GUI system is built on three core abstraction classes:

| Class | Purpose | Use Case |
|-------|---------|----------|
| `BaseInventoryPage` | Foundation for all GUIs | Static content, information displays |
| `BasePaginationPage` | Auto-paginated lists | Players, warps, shops with navigation |
| `BaseConfirmationPage` | OK/Cancel dialogs | Delete actions, confirmations |

All classes extend `Gui` from obliviate-invs and use the **Template Method pattern** — override specific methods to customize behavior while benefiting from built-in functionality like toolbars, slot calculations, and navigation.

## BaseInventoryPage

The foundation class for all inventory GUIs. It provides a structured lifecycle, toolbar management, and helper methods for common UI tasks.

### Class Structure

```java
public abstract class BaseInventoryPage extends Gui {
    // Constructors accepting Player, ID, title (String or Component),
    // and rows (int) or InventoryType

    protected abstract void setupContent(InventoryOpenEvent event);
    protected void afterSetup(InventoryOpenEvent event) { }
    protected void setupBottomToolbar() { }
    protected Icon createBackgroundIcon() { }
    protected Icon createActionButton(Colors color, String name, Consumer<InventoryClickEvent> onClick) { }
    // ... and more utility methods
}
```

### Lifecycle

When a player opens a GUI, the following sequence occurs:

1. `onOpen(InventoryOpenEvent)` is called (final method)
2. If `showBottomToolbar` is enabled, `setupBottomToolbar()` fills the last row with gray glass
3. `setupContent(InventoryOpenEvent)` is invoked (abstract — your implementation)
4. `afterSetup(InventoryOpenEvent)` is called (hook for post-setup customization, optional)
5. GUI is displayed to the player

### Creating a Simple Information Panel

```java
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryOpenEvent;
import com.ultikits.ultitools.abstracts.gui.BaseInventoryPage;
import com.ultikits.ultitools.entities.Colors;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;

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

        // Create an information icon
        Icon infoIcon = new Icon(Material.BOOK);
        infoIcon.setName(Component.text("Server Info"));
        infoIcon.setLore(
            "Players online: 5",
            "TPS: 20.0",
            "Memory: 2GB/4GB"
        );

        // Place it in the center
        addItem(getBottomCenterSlot(), infoIcon);
    }

    @Override
    protected void afterSetup(InventoryOpenEvent event) {
        // Called after content is setup (optional)
        // Useful for animations or deferred processing
    }
}
```

### Opening a GUI

```java
@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(alias = {"info"}, permission = "ultikits.info")
public class InfoCommand extends AbstractCommandExecutor {

    @CmdMapping(format = "")
    public void showInfo(@CmdSender Player player) {
        InfoGui gui = new InfoGui(player);
        gui.open();  // Display to player
    }
}
```

### Bottom Toolbar

By default, the last row is reserved for a toolbar with a gray glass background:

```java
// Disable toolbar if you want to use the entire inventory
gui.setShowBottomToolbar(false);

// Or use a custom background color
@Override
protected Icon createBackgroundIcon() {
    ItemStack glass = XVersionUtils.getColoredPlaneGlass(Colors.BLUE);
    Icon icon = new Icon(glass);
    icon.setName(" ");
    return icon;
}
```

### Placing Items in the Toolbar

```java
@Override
protected void setupContent(InventoryOpenEvent event) {
    // Place buttons in the bottom row (columns are 0-8)
    Icon closeButton = createActionButton(Colors.RED, "Close", e -> {
        player.closeInventory();
    });
    addToBottomRow(0, closeButton);  // Far left

    Icon refreshButton = createActionButton(Colors.GREEN, "Refresh", e -> {
        refresh();
    });
    addToBottomRow(getBottomCenterSlot(), refreshButton);  // Center

    Icon helpButton = createActionButton(Colors.YELLOW, "Help", e -> {
        player.sendMessage("This is a help message");
    });
    addToBottomRow(8, helpButton);  // Far right
}
```

### Helper Methods

```java
// Slot calculations
int lastRowStart = getSize() - 9;          // First slot of last row
int centerSlot = getBottomCenterSlot();    // Center of last row
int slot = getSlotFromEnd(5);              // 5th slot from end

// Content area
int[] contentSlots = getContentSlots();    // Slots excluding toolbar (if enabled)

// Filling areas
fillRow(icon, rowIndex);                   // Fill entire row
fillArea(icon, startSlot, endSlot);        // Fill rectangular area
fillBorder(icon);                          // Fill inventory border

// Chaining methods
gui.setShowBottomToolbar(false)
   .onClose(e -> System.out.println("Closed"))
   .open();
```

### Close Handlers

```java
gui.onClose(event -> {
    player.sendMessage("GUI closed!");
    // Cleanup, save data, etc.
});
```

## BasePaginationPage

For displaying large lists (players, warps, shops), `BasePaginationPage` automatically handles pagination with next/previous buttons.

### Class Structure

```java
public abstract class BasePaginationPage extends BaseInventoryPage {
    protected abstract List<Icon> provideItems();

    protected Icon createPreviousButton() { /* ... */ }
    protected Icon createNextButton() { /* ... */ }

    public int getCurrentPage() { }
    public int getTotalPages() { }
    public boolean hasNextPage() { }
    public boolean hasPreviousPage() { }
    public void goToPage(int pageNumber) { }
}
```

### Automatic Navigation

Navigation buttons are placed at columns 3 (previous) and 5 (next) in the bottom toolbar:

```
[empty] [empty] [empty] [< PREV] [empty] [NEXT >] [empty] [empty] [empty]
        col 0   col 1   col 2   col 3   col 4   col 5   col 6   col 7   col 8
```

Override `PREV_BUTTON_COLUMN` and `NEXT_BUTTON_COLUMN` to customize positions:

```java
public class CustomPaginationGui extends BasePaginationPage {
    protected static final int PREV_BUTTON_COLUMN = 0;  // Far left
    protected static final int NEXT_BUTTON_COLUMN = 8;  // Far right
}
```

### Creating a Paginated Player List

```java
import java.util.ArrayList;
import java.util.List;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryOpenEvent;
import com.ultikits.ultitools.abstracts.gui.BasePaginationPage;
import com.ultikits.ultitools.entities.Colors;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;

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
            playerIcon.setName(Component.text(onlinePlayer.getName()).color(TextColor.color(0x00FF00)));

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
```

### Pagination Methods

```java
// Get current state
int currentPage = gui.getCurrentPage();      // 1-based
int totalPages = gui.getTotalPages();
boolean hasNext = gui.hasNextPage();
boolean hasPrev = gui.hasPreviousPage();

// Navigation
gui.goToPage(2);                             // Jump to page 2

// Refresh with new data
gui.refresh();                               // Re-opens GUI with updated items
```

## BaseConfirmationPage

For confirmation dialogs with OK and Cancel buttons.

### Class Structure

```java
public abstract class BaseConfirmationPage extends BaseInventoryPage {
    protected static final int CANCEL_BUTTON_COLUMN = 3;  // Left button
    protected static final int OK_BUTTON_COLUMN = 5;      // Right button

    protected abstract void onConfirm(InventoryClickEvent event);
    protected void onCancel(InventoryClickEvent event) { }

    protected void setupDialogContent(InventoryOpenEvent event) { }
    protected String getOkButtonName() { }
    protected String getCancelButtonName() { }

    public static Builder builder(Player player) { }
}
```

### Creating a Confirmation Dialog (Subclass Approach)

```java
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import com.ultikits.ultitools.abstracts.gui.BaseConfirmationPage;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;

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
        warningIcon.setName(Component.text("Delete " + itemName + "?"));
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
```

### Creating a Confirmation Dialog (Builder Pattern)

For simple confirmations, use the fluent `Builder`:

```java
BaseConfirmationPage.builder(player)
    .id("confirm-warp-delete")
    .title("Delete Warp?")
    .rows(3)
    .content(event -> {
        Icon icon = new Icon(Material.COMPASS);
        icon.setName("Delete Warp?");
        // Add to inventory using event.getInventory()
    })
    .onConfirm(event -> {
        player.sendMessage("Warp deleted");
        warpService.delete(warpId);
    })
    .onCancel(event -> {
        player.sendMessage("Cancelled");
    })
    .okButton("Delete")
    .cancelButton("Keep")
    .open();
```

## Colors

UltiTools provides a `Colors` enum for creating colored glass buttons and decorations:

```java
public enum Colors {
    WHITE, ORANGE, MAGENTA, LIGHT_BLUE, YELLOW, LIME, PINK, GRAY,
    LIGHT_GRAY, CYAN, PURPLE, BLUE, BROWN, GREEN, RED, BLACK
}
```

Usage:

```java
Icon greenButton = createActionButton(Colors.GREEN, "Accept", clickHandler);
Icon redButton = createActionButton(Colors.RED, "Reject", clickHandler);
Icon blueButton = createActionButton(Colors.BLUE, "Info", clickHandler);

// Get ItemStack directly
ItemStack glass = XVersionUtils.getColoredPlaneGlass(Colors.CYAN);
```

## Complete Example: Warp System GUI

Here's a full example combining pagination with custom actions:

```java
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import com.ultikits.ultitools.abstracts.gui.BasePaginationPage;
import com.ultikits.ultitools.entities.Colors;
import mc.obliviate.inventory.Icon;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;

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
            warpIcon.setName(Component.text(warp.getName()).color(TextColor.color(0xFF00A6)));

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
        new DeleteConfirmation(player, warp.getName(), warp).open();
    }

    private class DeleteConfirmation extends BaseConfirmationPage {
        private final WarpData warp;

        public DeleteConfirmation(Player player, String name, WarpData warp) {
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
            icon.setName(Component.text("Delete warp?"));
            addItem(getBottomCenterSlot(), icon);
        }

        @Override
        protected void onConfirm(InventoryClickEvent event) {
            warpService.delete(warp.getId());
            player.sendMessage("Warp deleted");
            refresh();  // Refresh parent GUI
        }
    }
}
```

## Advanced: Custom Button Styles

Override button creation methods to customize appearance:

```java
public class CustomPaginationGui extends BasePaginationPage {

    @Override
    protected Icon createPreviousButton() {
        return createActionButton(
            Colors.BLUE,
            Component.text("← Back"),
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
            Component.text("Next →"),
            e -> {
                if (!getPaginationManager().isLastPage()) {
                    getPaginationManager().goNextPage();
                    refresh();
                }
            }
        );
    }
}
```

## Deprecated API

::: warning Deprecated Classes
`PagingPage` and `OkCancelPage` are no longer maintained. Migrate to the modern classes:

| Old | New |
|-----|-----|
| `PagingPage` | `BasePaginationPage` |
| `OkCancelPage` | `BaseConfirmationPage` |
| Custom base classes | `BaseInventoryPage` |

The new API provides better structure, testing support, and consistency with the rest of the v6.2.0 framework.
:::

## Tips & Best Practices

### Responsive Design

Keep inventory layouts consistent across servers with different resolutions:

```java
// Always use getBottomCenterSlot() and getSlotFromEnd() for positioning
// instead of hardcoded slot numbers
Icon button = createActionButton(...);
addToBottomRow(getBottomCenterSlot(), button);  // Works for any inventory size
```

### Performance

For large lists, limit items per page by using pagination:

```java
// Good: Paginated (36 items per page for 5-row GUI)
new PlayerListGui(player).open();

// Avoid: Loading thousands of items at once
List<Icon> allItems = new ArrayList<>();
for (int i = 0; i < 5000; i++) {
    allItems.add(...);
}
```

### Memory

Close GUIs explicitly and clean up references:

```java
gui.onClose(event -> {
    // Clean up any cached data
    cache.clear();
    // Unregister listeners if any
});
```

### Testing

Use the test patterns from `BaseInventoryPageTest`:

```java
@Test
void testGuiCreation() {
    TestGui gui = new TestGui(mockPlayer);
    assertEquals(27, gui.getSize());  // 3 rows
}
```

## References

- [obliviate-invs Wiki](https://github.com/hamza-cskn/obliviate-invs/wiki)
- [Bukkit Inventory Events](https://hub.spigotmc.org/javadocs/spigot/org/bukkit/event/inventory/package-summary.html)
- [Adventure Text API](https://docs.advntr.dev/)
- [UltiTools v6.2.0 Framework Guide](/en/guide/introduction)
