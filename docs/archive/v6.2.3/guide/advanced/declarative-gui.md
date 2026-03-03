# Declarative GUI

::: warning Experimental feature
This framework is currently experimental and may contain unknown issues. Please report bugs via GitHub Issues.
:::

## 1. Introduction

Traditional Bukkit GUI development is usually imperative: you manually create an `Inventory`, set each `ItemStack`, and listen for `InventoryClickEvent` to handle interactions. As UI complexity grows this becomes hard to maintain and state management gets painful.

The UltiTools declarative GUI framework adopts the **UI = f(State)** idea:

- **Declarative**: describe what the UI should look like for a given state; the framework figures out how to update the view.
- **Component-Based**: the UI is composed of reusable, independent `Widget`s.
- **Reactive**: when state changes, the framework updates the UI automatically.

### Key benefits

- **Automatic diff updates**: the framework diffs the widget tree and only updates changed slots — reducing packets and improving client performance.
- **State management**: built-in state handling (similar to React/Flutter) makes pagination, selection and dynamic refresh easy to implement.
- **No manual listeners**: click handlers attach to widgets directly — no global slot-based listener logic required.

## 2. Core concepts

### 2.1 Widget

A `Widget` is an immutable description of UI. Widgets are lightweight configuration objects.

- `StatelessWidget`: no internal state — its appearance is fixed unless its parent rebuilds it. Use for static display elements like titles or background tiles.
- `StatefulWidget`: holds a `State` object. When the state changes it can trigger a rebuild. Use for counters, paginated lists, toggles, etc.

### 2.2 State

A `State` object contains mutable data for a `StatefulWidget`.

- `setState(() -> { ... })`: when you need to change data and refresh the UI you must do it inside `setState`. This marks the widget dirty and schedules a rebuild on the next frame.

### 2.3 BuildContext

`BuildContext` is the handle to a widget's position in the widget tree. It provides access to parent data, navigation, and other tree-level services.

## 3. Getting started

### 3.1 Create a simple GUI

All declarative GUIs extend `DeclarativeGui`.

```java
import com.ultikits.ultitools.abstracts.gui.declarative.engine.DeclarativeGui;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.*;

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

// Open the GUI
new MyFirstGui(player).open();
```

## 4. Widget reference

### 4.1 Container

The basic container widget that holds other widgets and optionally provides a background.

```java
Container.builder()
    .background(IconWrapper.of(Material.GRAY_STAINED_GLASS_PANE)) // set background
    .child(widget1) // add a single child
    .children(listWidgets) // add multiple children
    .build();
```

### 4.2 TextButton

A button with a colored pane and text — the primary interactive building block.

```java
TextButton.builder()
    .text("Confirm")
    .color("LIME") // color name from UltiTools Colors
    .slot(22)
    .lore("Click to confirm", "Action cannot be undone")
    .onClick(() -> {
        // click handler
    })
    .build();
```

### 4.3 ItemDisplay

Displays an `ItemStack` and supports click handlers.

```java
ItemDisplay.builder(itemStack)
    .slot(10)
    .name("My Sword") // override item name
    .lore("Damage: 100") // override item lore
    .onClick(event -> {
        // event is InventoryClickEvent
    })
    .build();
```

### 4.4 GridView

Ideal for rendering lists (shop items, inventories). GridView calculates row/column positions automatically.

```java
GridView.<ShopItem>builder()
    .startSlot(10) // starting slot
    .columns(7)    // columns per row
    .rows(4)       // max rows
    .items(itemList, item -> {
        // map data object to Widget
        return ItemDisplay.builder(item.getStack())
            .name(item.getName())
            .onClick(() -> buy(item))
            .build();
    })
    .build();
```

## 5. State management & interaction

When a UI needs to change in response to user actions (pagination, selection), use `StatefulWidget`.

### Example: simple counter

```java
// 1. Define the Widget
public class CounterWidget extends StatefulWidget {
    @Override
    public State createState() {
        return new CounterState();
    }
}

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
```

How it works:

1. user clicks the button
2. `setState` updates `count`
3. framework marks `CounterWidget` dirty
4. framework calls `build()` again
5. the `TextButton` is recreated with `Count: 1`
6. the diff algorithm detects the name change at slot 13 and updates only that slot (no full refresh)

## 6. Advanced topics

### 6.1 Importance of SlotKey

When rendering dynamic lists (e.g. `GridView`) assign a unique key to each item so the diff algorithm can detect moves instead of delete+create.

```java
ItemDisplay.builder(item)
    .key(SlotKey.of("item-" + item.getId())) // unique id
    .build();
```

### 6.2 Navigation & routing

A `Navigator` lets you switch “pages” inside the same GUI window by swapping widget trees.

```java
// in root build method
return new Navigator("home", Map.of(
    "home", (context) -> new HomePageWidget(),
    "settings", (context) -> new SettingsPageWidget()
));

// push from child
Navigator.of(context).push("settings");
```

### 6.3 Performance tips

- **Avoid heavy work in build**: `build()` may run frequently — don’t perform DB calls or expensive computations there.
- **Extract constant widgets**: reuse `static final` widgets for parts that never change (e.g. background tiles).
- **Localize refresh**: push state down to leaf nodes so only small parts of the tree rebuild (make a single button stateful rather than the whole page).

---

## 7. Full example: shop page

- Layout: `Container` + `GridView`
- Pagination: `currentPage` controls data slicing
- Single-select: `selectedSlot` highlights selection
- Interaction: buy button shows/hides based on selection

```java
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
```