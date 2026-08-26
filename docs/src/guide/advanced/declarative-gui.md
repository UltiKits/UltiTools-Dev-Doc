# Declarative GUI

::: warning Experimental feature with known gaps in v6.2.5
An open GUI keeps the widget tree that was built when it opened: `DeclarativeGui.setState` schedules a build but marks no element dirty, `State.setState` marks the element dirty but schedules no build, and several builder methods listed in section 4 store their value with no consumer on the render path.
Keep the state in fields of your `DeclarativeGui` subclass, change them directly, and reopen the same instance on the next tick: `onClose` disposes the renderer and resets `initialized`, so the next `onOpen` runs `build(BuildContext)` again with the new values.
The three rendering seams are tracked in [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200); please keep reporting anything else through GitHub Issues.
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

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/MyFirstGui.java

```java
// Open the GUI
new MyFirstGui(player).open();
```

## 4. Widget reference

### 4.1 Container

::: warning The background icon is stored but never rendered
`.background(...)` keeps the `IconWrapper` in a field that only `getBackground()` reads, and nothing on the render path calls that getter, so the slots the container covers stay empty.
Add an `ItemDisplay` child with an explicit `slot` for every cell you want filled, reusing one `ItemStack` such as a grey glass pane: that is the background expanded into real children.
Implementing or removing the builder methods that currently store without rendering is tracked in [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200).
:::

The basic container widget that holds other widgets and optionally provides a background.

```java
Container.builder()
    .background(IconWrapper.builder(new ItemStack(Material.GRAY_STAINED_GLASS_PANE)).name(" ").build()) // set background
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

::: warning Slot positions are computed from startSlot and columns only
`.rows(...)` writes `maxRows`, whose only reader is `getMaxRows()` and which nothing calls, while `Builder.calculateSlot(int)` derives every position from `startSlot` and `columns` alone, so a longer item list keeps flowing past the row count you set.
Truncate the list to `rows * columns` entries before passing it to `.items(...)`: the row cap then holds because your own code applies it.
Implementing or removing the builder methods that currently store without rendering is tracked in [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200).
:::

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

The rebuild sequence in this example is subject to the state limitation described at the top of this page.

### Example: simple counter

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/CounterWidget.java

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/CounterState.java

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

::: warning Routing changes the history without changing the screen
`push(String)` applies its change through `setState`, which marks the element dirty without scheduling a build, so the route is pushed onto the history while the open GUI keeps showing the previous page; `Navigator.of(context)` is also `@Nullable` and returns null when no `Navigator` sits above the current element, which makes the chained call throw `NullPointerException`.
Hold the current route in a field of your `DeclarativeGui` subclass, switch on it inside `build(BuildContext)`, and reopen the GUI as described at the top of this page; if you keep `Navigator.of(context)`, check the result for null first.
The navigation seam is tracked in [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200).
:::

A `Navigator` lets you switch “pages” inside the same GUI window by swapping widget trees.

```java
// in root build method
Map<String, RouteBuilder> routes = new HashMap<>();
routes.put("home", (context) -> new HomePageWidget());
routes.put("settings", (context) -> new SettingsPageWidget());
return new Navigator("home", routes);

// push from child
Navigator.of(context).push("settings");
```

### 6.3 Performance tips

- **Avoid heavy work in build**: `build()` may run frequently — don’t perform DB calls or expensive computations there.
- **Extract constant widgets**: reuse `static final` widgets for parts that never change (e.g. background tiles).
- **Localize refresh**: push state down to leaf nodes so only small parts of the tree rebuild (make a single button stateful rather than the whole page).

---

## 7. Full example: shop page

The pagination, single-select and buy-button behaviour in this example is subject to the state limitation described at the top of this page.

- Layout: `Container` + `GridView`
- Pagination: `currentPage` controls data slicing
- Single-select: `selectedSlot` highlights selection
- Interaction: buy button shows/hides based on selection

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/ExampleShopPage.java