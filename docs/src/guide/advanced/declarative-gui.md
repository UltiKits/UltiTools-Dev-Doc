# Declarative GUI

::: warning Experimental feature — render seams closed in v6.3.0
The repaint, click-dispatch and `GridView` positioning seams tracked in [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200) are closed as of v6.3.0: `build(BuildContext)` now runs on every state change, a click outside the GUI's own inventory cannot reach a handler, and any widget type positions correctly inside a `GridView`.
`@ApiStatus.Experimental` stays on the package for at least one more release, pending feedback from real servers running these rewritten mechanisms.
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

::: tip Fill the background with explicit children <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, `Container.Builder` has no `background(...)` method — the field it wrote in v6.2.5 was never read by anything on the render path, so v6.3.0 deletes it rather than leave it silently inert.
Add an `ItemDisplay` child with an explicit `slot` for every cell you want filled, reusing one `ItemStack` such as a grey glass pane.
:::

The basic container widget that holds other widgets.

```java
Container.builder()
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

::: tip Any widget type positions correctly <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, `GridView` writes each child's computed slot as parent data at render time, so any widget type — not only `ItemDisplay` — auto-positions into its row/column slot; `Widget`'s own API is unchanged, so no downstream custom widget needs a change.
An explicit `.slot(...)` on a child inside a `GridView` is overridden and a `WARNING` names the child; a child with no explicit slot, or legitimately declared at slot `0`, produces no warning.
:::

Ideal for rendering lists (shop items, inventories). Any widget type is automatically positioned into row/column slots.

```java
GridView.<ShopItem>builder()
    .startSlot(10) // starting slot
    .columns(7)    // columns per row
    .items(itemList, item -> {
        // map data object to Widget
        return ItemDisplay.builder(item.getStack())
            .name(item.getName())
            .onClick(() -> buy(item))
            .build();
    })
    .build();
```

::: tip GridView.Builder.rows(int) is removed <Badge type="tip" text="v6.3.0+" />
As of v6.3.0, `.rows(int)`/`getMaxRows()` no longer exist — the field they wrote was never read by anything, so v6.3.0 deletes them rather than implement an overflow rule nothing asked for.
Truncate the list to the row count you want, in your own code, before passing it to `.items(...)`.
:::

## 5. State management & interaction

When a UI needs to change in response to user actions (pagination, selection), use `StatefulWidget`.

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

::: tip Now actually preserves state across a reorder <Badge type="tip" text="v6.3.0+" />
Before v6.3.0, `ContainerElement` and `GridViewElement` paired children by list position only, so a `SlotKey` had no effect and reordering a keyed list still discarded every item's `State`.
As of v6.3.0, both classes reconcile children by `SlotKey` first, falling back to position only for children with no key.
:::

```java
ItemDisplay.builder(item)
    .key(SlotKey.of("item-" + item.getId())) // unique id
    .build();
```

### 6.2 Navigation & routing

::: tip Pushing a route now repaints immediately <Badge type="tip" text="v6.3.0+" />
Before v6.3.0, `push(String)` applied its change through `setState`, which marked the element dirty without ever scheduling a build, so the route was pushed onto the history while the open GUI kept showing the previous page.
As of v6.3.0, every `setState`-driven dirty mark reaches a scheduled repaint, so pushing a route updates the visible page immediately.
:::

::: warning Navigator.of(context) can return null
`Navigator.of(context)` is `@Nullable` and returns `null` when no `Navigator` sits above the current element, so a chained call throws `NullPointerException`.
Check the result for `null` before calling `.push(...)`/`.pop()`/`.pushReplacement(...)` on it.
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

- Layout: `Container` + `GridView`
- Pagination: `currentPage` controls data slicing
- Single-select: `selectedSlot` highlights selection
- Interaction: buy button shows/hides based on selection

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/ExampleShopPage.java