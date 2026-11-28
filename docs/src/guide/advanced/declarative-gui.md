# Declarative GUI

::: warning Experimental feature — render seams closed in v6.3.0
The repaint, click-dispatch and `GridView` positioning seams tracked in [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200) are closed as of v6.3.0: `build(BuildContext)` now runs on every state change, a click outside the GUI's own inventory cannot reach a handler, and any widget type positions correctly inside a `GridView`.
`@ApiStatus.Experimental` stays on the package for at least one more release, pending feedback from real servers running these rewritten mechanisms.
:::

## What changes in 7.0 <Badge type="tip" text="v7.0.0+" />

::: info As of v7.0.0
The declarative engine no longer inherits obliviate's `Gui` or writes to an inventory. Each build produces an immutable `Grid` snapshot of the whole screen and hands it to the module's `UiService`, which owns display, click dispatch and the close result. The package is still `@ApiStatus.Experimental`.
:::

As of v7.0.0 the framework supplies only one chest page base class, `DeclarativeGui`: `BaseInventoryPage`, `BasePaginationPage` and `BaseConfirmationPage` are removed. Paging is done with a `State` that holds the page number and a `GridView` that shows the current slice; confirmations use `Confirm` of the [UI service](/guide/advanced/ui-service#notice-and-confirm). For those pages, see the [archived v6.5.0 guide](/v6.5.0/guide/advanced/gui.html).

The engine has so far been verified only against an in-memory UI service, not a real server.

**Construction.** Pass the module's own injected `UiService` and [`Scheduler`](/guide/advanced/scheduled-tasks#scheduler-api) and a `Text` title; the row count is fixed at 1 to 6, and `InventoryType` constructors are gone:

```java
public class ShopPage extends DeclarativeGui {
    public ShopPage(UiService ui, Scheduler scheduler, Player player) {
        super(ui, scheduler, player, "shop", Text.plain("Item Shop"), 6);
    }

    @Override
    public Widget build(BuildContext context) {
        return Container.builder()
            .child(TextButton.builder()
                .text(Text.plain("Close"))
                .color("RED")
                .slot(49)
                .onClick(click -> click.session().close())
                .build())
            .build();
    }
}
```

**Opening.** `open()` builds the first frame synchronously, shows it through the `UiService` and returns a `GridSession`. It must run on the viewer's owning thread, otherwise it throws `IllegalStateException`. Calling it while the page is open returns the same session. The title and row count cannot change after construction; open a new page instance to change the title. Do not call `open()` right after closing the same page in the same action: it can return the already ended session and show nothing.

**Widgets.** `ItemDisplay.builder` takes an `ItemSpec` (see [Items and Item Storage](/guide/essentials/items)); `TextButton` names and lore take `Text`. `onClick(GridAction)` receives a `GridClick` (viewer, slot, click kind and session), and `onClick(Runnable)` remains. `IconWrapper`, `RenderNodeDiffer` and `DiffResult` are removed, and `getPlayer()` becomes `viewer()`. The old open, click and inventory-close hooks are replaced by describing content in `build`, putting actions on widgets, and `onGuiClose(UiResult<Ack>)`. The new `ItemSlotArea` binds indexes of an existing container into the grid: read-only (`VIEW`) by default, and moving items needs an explicit `.mode(BindingMode.EDITABLE)`.

**Re-rendering.** `setState(Runnable)` runs your action immediately on the calling thread and then requests a rebuild. The rebuild always runs on a later tick, in the viewer's entity context; requests that arrive before it runs are coalesced into one frame, and a request made during a build is replayed after it, never re-entrantly. Work queued during a frame runs on the next frame. When the build succeeds the engine sends the full grid to the session, and the backend decides which slots to rewrite. Hand results from background threads to the viewer with `scheduler.entity(player).run(...)` before you change state.

**Errors.** A build that throws never reaches the session, so the viewer keeps the previous picture. An exception in a deferred frame is logged as a WARNING (`Error executing GUI frame task`); a JVM `Error` is logged as SEVERE and rethrown. A widget tree nested deeper than 64 levels raises `RenderDepthExceededException`, which is also reported to the error collector. A node whose slot lies outside the grid is skipped, and a node that duplicates a container index is skipped; a second node claiming a slot replaces the first; each case logs one warning per slot. A page whose `initState` keeps requesting rebuilds and throwing is retried once per tick while it is open; catch the failure in the widget and build an error state. When the session ends, the engine disposes the widget tree first and then calls `onGuiClose`; an exception in either is logged as a WARNING naming the screen and the module.

## 1. Introduction

Traditional Bukkit GUI development is usually imperative: you manually create an `Inventory`, set each `ItemStack`, and listen for `InventoryClickEvent` to handle interactions. As UI complexity grows this becomes hard to maintain and state management gets painful.

The UltiTools declarative GUI framework adopts the UI = f(State) idea:

- Declarative: describe what the UI should look like for a given state; the framework figures out how to update the view.
- Component-Based: the UI is composed of reusable, independent `Widget`s.
- Reactive: when state changes, the framework updates the UI automatically.

### Key benefits

- Automatic updates: you never write slots yourself. Up to 6.x the framework diffs the widget tree and updates only the changed slots. As of v7.0.0 the engine sends a complete grid snapshot and the UI backend decides which slots to rewrite.
- State management: built-in state handling (similar to React/Flutter) makes pagination, selection and dynamic refresh easy to implement.
- No manual listeners: click handlers attach to widgets directly — no global slot-based listener logic required.

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

Extend `DeclarativeGui` and pass your module’s injected `UiService` and `Scheduler` to the page constructor.

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/MyFirstGui.java

```java
// Call on the viewer's owning thread
GridSession session = new MyFirstGui(ui, scheduler, player).open();
```

## 4. Widget reference

### 4.1 Container

::: tip Background slots
`Container.Builder` has no background method. Add an `ItemDisplay` with an explicit `slot` for each empty cell you want to fill, reusing an `ItemSpec` such as a gray glass pane.
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
    .text(Text.plain("Confirm"))
    .color("LIME") // color name from UltiTools Colors
    .slot(22)
    .lore(List.of(Text.plain("Click to confirm"), Text.plain("Action cannot be undone")))
    .onClick(() -> {
        // click handler
    })
    .build();
```

### 4.3 ItemDisplay

Displays an item described by an `ItemSpec`. Set the name and lore on the item description, and the slot and click action on the widget.

```java
ItemSpec sword = ItemSpec.builder(Material.IRON_SWORD)
    .name(Text.plain("My Sword"))
    .addLore(Text.plain("A sample display item"))
    .build();
ItemDisplay.builder(sword)
    .slot(10)
    .onClick(click -> click.viewer().sendMessage("Sword selected"))
    .build();
```

### 4.4 GridView

::: tip Any widget type positions correctly <Badge type="tip" text="v6.3.0+" />
`GridView` positions children of any widget type at render time.
An explicit `.slot(...)` on a child inside a `GridView` is overridden and a `WARNING` names the child's index and both slots; a child with no explicit slot, or legitimately declared at slot `0`, produces no warning.
:::

Pass the current page as a `List<ItemSpec> pageItems`. The grid assigns each item widget a slot, so the widget does not need its own `.slot(...)`.

```java
GridView.<ItemSpec>builder()
    .startSlot(10)
    .columns(7)
    .items(pageItems, item -> ItemDisplay.builder(item).build())
    .build();
```

::: tip Row count
`GridView` does not enforce a row limit. To limit rows, slice the list to the current page before passing it to `.items(...)`.
:::

## 5. State management & interaction

Use a `StatefulWidget` when a widget needs its own state and can rebuild independently.

### Example: simple counter

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/CounterWidget.java

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/CounterState.java

How it works:

1. user clicks the button
2. `setState` updates `count`
3. framework marks `CounterWidget` dirty
4. framework calls `build()` again
5. the `TextButton` is recreated with `Count: 1`
6. the engine emits a complete grid. Only the item displayed in slot 13 changes; the UI backend compares the snapshots.

## 6. Advanced topics

### 6.1 Importance of SlotKey

Assign each item in a dynamic list a unique, stable `SlotKey`. The framework matches children by key across a reorder, preserving their `State`.

::: tip Now actually preserves state across a reorder <Badge type="tip" text="v6.3.0+" />
Before v6.3.0, `ContainerElement` and `GridViewElement` paired children by list position only, so a `SlotKey` had no effect and reordering a keyed list still discarded every item's `State`.
As of v6.3.0, both classes reconcile children by `SlotKey` first, falling back to position only for children with no key.
:::

```java
ItemDisplay.builder(shopItem.display())
    .key(SlotKey.of(shopItem.id()))
    .build();
```

### 6.2 Navigation & routing

::: tip Pushing a route schedules a repaint <Badge type="tip" text="v6.3.0+" />
Before v6.3.0, `push(String)` applied its change through `setState`, which marked the element dirty without ever scheduling a build, so the route was pushed onto the history while the open GUI kept showing the previous page.
Pushing a route uses `setState` to schedule a repaint. The visible page changes after the build, not inside `push`.
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
NavigatorState navigator = Navigator.of(context);
if (navigator != null) {
    navigator.push("settings");
}
```

### 6.3 Performance tips

- Avoid heavy work in build: `build()` may run frequently — don’t perform DB calls or expensive computations there.
- Extract constant widgets: reuse `static final` widgets for parts that never change (e.g. background tiles).
- Localize refresh: push state down to leaf nodes so only small parts of the tree rebuild (make a single button stateful rather than the whole page).

### 6.4 Maximum tree depth

The framework throws `RenderDepthExceededException` if a widget tree nests deeper than 64 levels. If this happens, check recursive builders for a missing base case.

---

## 7. Full example: shop page

- Layout: a `Container` holds decorations, controls and a `GridView`. Each page displays up to four rows of seven items.
- Pagination and single selection: the current page and selected item are page state. Update them with `setState` and clear the selection when changing pages.
- Actions: the buy button appears when an item is selected. The close button ends the `GridSession`.

Give each `ShopItem` a unique ID for its widget key. The buy button sends a demonstration message only; it does not charge the viewer or grant an item.

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/ExampleShopPage.java
