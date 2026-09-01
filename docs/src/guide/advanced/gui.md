# GUI Interface

<Badge type="tip" text="v6.2.0+" />

::: info Modern GUI System
The GUI system has been rebuilt with `BaseInventoryPage`, `BasePaginationPage`, and `BaseConfirmationPage` base classes. These replace `PagingPage` and `OkCancelPage`, both removed in v6.3.0.
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

<<< @/../examples/src/main/java/com/ultikits/docs/gui/InfoGui.java

### Opening a GUI

<<< @/../examples/src/main/java/com/ultikits/docs/gui/InfoCommand.java

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
    addToBottomRow(4, refreshButton);  // Center

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

Override `setupNavigationButtons()` to customize positions. Redeclaring the `PREV_BUTTON_COLUMN` / `NEXT_BUTTON_COLUMN` constants in a subclass does not work, because Java resolves `static` fields by declared type, not by the runtime instance. The base class's own `setupNavigationButtons()` always reads its own constants:

```java
// Inside your BasePaginationPage subclass
@Override
protected void setupNavigationButtons() {
    addToBottomRow(0, createPreviousButton());  // Far left
    addToBottomRow(8, createNextButton());       // Far right
}
```

### Creating a Paginated Player List

<<< @/../examples/src/main/java/com/ultikits/docs/gui/PlayerListGui.java

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

<<< @/../examples/src/main/java/com/ultikits/docs/gui/DeleteConfirmation.java

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

<<< @/../examples/src/main/java/com/ultikits/docs/gui/WarpListGui.java

## Advanced: Custom Button Styles

Override button creation methods to customize appearance:

<<< @/../examples/src/main/java/com/ultikits/docs/gui/CustomPaginationGui.java

## Tips & Best Practices

### Responsive Design

Keep inventory layouts consistent across servers with different resolutions:

```java
// Always use getBottomCenterSlot() and getSlotFromEnd() for positioning
// instead of hardcoded slot numbers
Icon button = createActionButton(...);
addToBottomRow(4, button);  // Center column; works for any inventory size
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
- [UltiTools v6.2.0 Framework Guide](/guide/introduction)
