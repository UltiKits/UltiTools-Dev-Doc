# UI: Intents and Sessions

As of v7.0.0, modules show screens to players through the framework's `UiService` (package `com.ultikits.ultitools.ui`). A module describes what it wants to show or ask as an intent. The service picks a backend that can display it, a Paper dialog or a chest inventory, and returns a `UiSession` whose result says how the screen ended. The [declarative GUI](/guide/advanced/declarative-gui) builds its pages on the same service.

::: warning Unreleased v7.0.0 behaviour
This page describes the unreleased 7.0.0 framework. 6.x has no `UiService`; its screens are the classes described in [GUI Interface](/guide/advanced/gui).
:::

## Obtaining the service

Inject the service by its interface type:

```java
@Service
public class ArenaScreens {
    @Autowired
    private Messages messages;
    @Autowired
    private UiService ui;
    @Autowired
    private Scheduler scheduler;
}
```

The framework registers the service in the module's container before the component scan, so it is injected before any `@PostConstruct` method runs. The module's main class and its scanned beans receive the same instance.

Each loaded copy of a module has its own service. The framework keys it by the module instance, not by the module name: a replacement copy with the same name receives a new service, and unloading one copy ends only that copy's screens. `owner()` returns the module name for diagnostics only. Every method of `UiService` may be called from any thread, except `container(...)`, which must be called on the server thread.

## Intents

An intent is an immutable description of one screen. `UiIntent<R>` is sealed and permits five types:

| Intent | Screen | Result type `R` | Value of `Completed` |
| --- | --- | --- | --- |
| `Notice` | Dialog | `Ack` | `Ack.ACK` when the player presses the button |
| `Confirm` | Dialog | `Boolean` | `true` for yes, `false` for no |
| `Choice<T>` | Dialog | `T` | The value of the option the player picked |
| `Form` | Dialog | `FormResponse` | The submitted values |
| `Grid` | Chest inventory | `Ack` | None: a grid always ends with `Closed` |

More intent types may be added in a 7.x minor release. Do not switch over `UiIntent` exhaustively without a `default` branch.

`show(player, intent)` returns a `UiSession<R>`; for a `Grid` it returns a `GridSession`. Every builder takes a `Text` title from the [text engine](/guide/essentials/messages), and every title, body line, label and button is rendered in the viewer's language.

### Notice and Confirm

```java
Notice rules = Notice.builder(Text.of(messages.key("arena.rules.title")))
        .addBody(Text.of(messages.key("arena.rules.line1")))
        .build();
ui.show(player, rules);

Confirm leave = Confirm.builder(Text.of(messages.key("arena.leave.title")))
        .addBody(Text.of(messages.key("arena.leave.body")))
        .build();
ui.show(player, leave).result().thenAcceptAsync(result -> {
    if (result.isCompleted() && result.value()) {
        leaveArena(player);
    }
}, scheduler.entity(player));
```

Treat every result other than `Completed(true)` as "not confirmed". `UiResult.value()` throws `IllegalStateException` on a `Closed` result, so check `isCompleted()` first.

### Choice

A `Choice<T>` shows one button per option. Options have text labels and an optional tooltip, no item icons; use a `Grid` for icons. At least one option is required, option values must be unique, and they should be immutable.

```java
Choice<String> kit = Choice.<String>builder(Text.of(messages.key("kit.title")))
        .option("warrior", Text.of(messages.key("kit.warrior")))
        .option(new ChoiceOption<>("archer", Text.of(messages.key("kit.archer")),
                Text.of(messages.key("kit.archer.tooltip"))))
        .build();
```

### Form

A `Form` collects several inputs and submits them at once. It needs at least one input. Each input has a key of at most 32 characters matching `[a-z0-9_]+`, unique within the form.

| Input | Value | Created with |
| --- | --- | --- |
| `TextInput` | `String`, possibly empty | `TextInput.builder(key, label)`; `maxLength` 1 to 256 (default 32), `maxLines` (default 1), `initial` |
| `ToggleInput` | `Boolean` | `ToggleInput.of(key, label, initial)` |
| `ChoiceInput<T>` | The picked option's value | `ChoiceInput.of(key, label, options)` or `ChoiceInput.of(key, label, options, initial)` |
| `SliderInput` | `Double` | `SliderInput.builder(key, label, min, max)`; `step` (default 1), `initial` (default `min`) |

There is no password (masked) input, because Paper's dialog text input has no such option.

```java
TextInput name = TextInput.builder("name", Text.of(messages.key("home.form.name"))).maxLength(24).build();
ToggleInput shared = ToggleInput.of("shared", Text.of(messages.key("home.form.shared")), false);
SliderInput radius = SliderInput.builder("radius", Text.of(messages.key("home.form.radius")), 1, 10)
        .initial(3)
        .build();

Form form = Form.builder(Text.of(messages.key("home.form.title")))
        .input(name)
        .input(shared)
        .input(radius)
        .build();

ui.show(player, form).result().thenAcceptAsync(result -> {
    if (!result.isCompleted()) {
        return;
    }
    FormResponse response = result.value();
    createHome(player, response.get(name), response.get(shared), response.get(radius));
}, scheduler.entity(player));
```

Read values with the input handles of the form you showed. `FormResponse.get` matches handles by identity, so an equal handle from another form throws `IllegalArgumentException`.

### Slider values and precision

A slider value is `min + k * step` for a whole number `k`, computed in `double` arithmetic, or exactly `max` for the largest `k`. `max - min` must be a whole number of steps. A slider from 0 to 10 with step 0.1 therefore returns `7.300000000000001` at step 73, not `7.3`; round the value when you display it.

Paper's dialog carries slider numbers as `float`. The dialog backend accepts a form only if every slider fits that precision: the `float` spacing at the larger absolute endpoint must be at most half a step, and `min`, `max` and `initial` must each be within a quarter step of their `float` value. A slider from 0 to 100,000,000 with step 1 fails this check. Such a form is not shown at all: the session ends with `Closed(UNSUPPORTED)`. It does not fall back to a chest screen, because the chest backend shows only grids.

## How a session ends

`UiSession.result()` completes exactly once with a `UiResult<R>`: `UiResult.Completed` with the answer, or `UiResult.Closed` with a `CloseReason`. The outcome is chosen by the first of these events; from then on `isOpen()` returns `false` and later events are ignored.

| Result | When |
| --- | --- |
| `Completed(value)` | The player answered |
| `Closed(PLAYER)` | The player closed the screen: the cancel button of a form or choice, or closing a chest inventory. Also a dialog answer the framework rejects as invalid; it logs one WARNING with the owner |
| `Closed(DISCONNECTED)` | The player left the server, or was already offline when `show` was called |
| `Closed(REPLACED)` | Another intent was shown to the same player; a player has at most one open session |
| `Closed(TIMED_OUT)` | The timeout elapsed |
| `Closed(CLOSED_BY_CODE)` | The module called `session.close()` |
| `Closed(OWNER_UNLOADED)` | The module that showed it was unloaded |
| `Closed(UNSUPPORTED)` | No backend can show the intent to this player, or opening it failed |

When no backend supports an intent, nothing opens and the player's previous session stays open. More `CloseReason` constants may be added in a 7.x minor release.

`session.close()` may be called from any thread and more than once. The screen closes and the result completes later, never inside the call, so it is safe from a grid action or an event handler.

## Dialog buttons

A dialog cannot be dismissed with Esc. Each dialog has explicit buttons:

| Intent | Buttons | Default label key |
| --- | --- | --- |
| `Notice` | One acknowledge button | `ultitools:ui.ok` |
| `Confirm` | Yes and No | `ultitools:ui.yes`, `ultitools:ui.no` |
| `Form` | Submit and Cancel | `ultitools:ui.submit`, `ultitools:ui.cancel` |
| `Choice` | One button per option, and Cancel | `ultitools:ui.cancel` |

The framework catalogue renders these keys as OK, Yes, No, Submit and Cancel in English and 确定, 是, 否, 提交, 取消 in Chinese. A module can replace the label per intent with `Notice.Builder.button(Text)`, `Confirm.Builder.yes(Text)` and `no(Text)`, and `Form.Builder.submit(Text)`. The Cancel label has no setter.

A `Choice` shows each option's tooltip on its button. Inside a form, the options of a `ChoiceInput` are not shown with tooltips, because Paper's option entries have no tooltip field.

## Timeouts

Notice, Confirm, Form and Choice time out after 10 minutes by default; a grid has no timeout. Pass `ShowOptions` to change it:

```java
ui.show(player, form, ShowOptions.builder().timeout(Duration.ofMinutes(2)).build());
```

`timeout(Duration)` accepts a positive duration of at most 12 hours. `noTimeout()` is honoured only for a grid; other intents keep their default.

## Threads

| What | Thread |
| --- | --- |
| `result()` completes | In a task of the viewer's entity context, or of the global context if the viewer has quit |
| `result()` at owner unload | On the unloading thread before the unload returns (on Paper the main thread) |
| `GridAction` | In a later task of the viewer's entity context, never inside the inventory event |
| `SlotContainer` methods | The server thread only, except `owner()`, `size()` and `kind()` |

A non-async dependent attached before the result completes runs on the completing thread. A non-async dependent attached after completion runs at once on the attaching thread, which may be an async thread. To touch the player whatever thread attaches the dependent, use an async variant with the module's [scheduler](/guide/advanced/scheduled-tasks#scheduler-api):

```java
session.result().thenAcceptAsync(result -> handle(player, result), scheduler.entity(player));
```

If the player has quit by then, that executor rejects the task and the dependent stage completes exceptionally with `RejectedExecutionException`. Use `scheduler.global()` for work that must run even then.

## Chest screens

A `Grid` is a snapshot of a chest screen: 1 to 6 rows of 9 columns (`Grid.COLUMNS`), addressed by zero-based `GridSlot(row, column)`. Each slot is empty, an icon, or a binding to a container index.

### Icons and clicks

An icon is a `GridItem`: an `ItemSpec` and an optional `GridAction`. The player can never take an icon.

```java
Grid menu = Grid.builder(Text.of(messages.key("arena.menu.title")), 1)
        .set(0, 4, ItemSpec.builder(Material.DIAMOND_SWORD).name(messages.key("arena.menu.join")).build(),
                click -> {
                    joinArena(click.viewer());
                    click.session().close();
                })
        .build();
GridSession session = ui.show(player, menu);
```

A `GridClick` carries `viewer()`, `slot()`, `kind()` (a `ClickKind`) and `session()`. The action runs only if the session is still open when its task runs. It may call `update`, `close()` or show another intent. An exception from the action is logged with the owner and swallowed.

A double click runs the action once: the chest backend ignores the double-click event on an icon and drops a second left click on the same icon within 250 ms.

Icons are rendered for each viewer through the [item renderer](/guide/essentials/items#rendering), so names and lore appear in the viewer's language; the title is rendered for the viewer as well.

### Redrawing

`session.update(next)` replaces the snapshot. `current()` returns `next` as soon as the call returns; the backend is told in a later task of the viewer's entity context, and several updates made before that task may reach it as one. The row count cannot change (`IllegalArgumentException`). The title may change: the backend then reopens the inventory, which does not end the session, and it does not reopen while the player holds an item on the cursor.

A click is applied to the snapshot the backend had when the click was reported. A click made on an older picture that arrives after a redraw runs the action of the redrawn slot, so keep each action safe for whatever the slot shows now. Slots bound to a container are redrawn automatically when the container changes.

### Cursor on close

Opening a grid never reads or writes the player's cursor. When the screen closes, the framework closes the inventory through Paper and does not move the cursor item itself; Paper handles it as for any closed inventory. The items in the chest inventory are display copies, never real items.

### Bound containers and storage

Real items live in a `SlotContainer`, created with `ui.container(ContainerSpec)` on the server thread. A grid binds slots to container indexes with `bind(slot, container, index, mode)` or `bindRange(...)`. `BindingMode.EDITABLE` lets the player move items in and out, subject to the container's `TransferPolicy` and state; `BindingMode.VIEW` refuses every gesture. A container outlives its screens and can be shown by several screens at once.

| Spec | Use |
| --- | --- |
| `ContainerSpec.storage(size)` | Real items. Requires a `Disposition` and an `UndeliveredHandler` |
| `ContainerSpec.template(size)` | Copies for editing definitions, such as a kit; no disposition, store or handler |

A storage container ends with its disposition: `COMMIT` writes the contents through a `ContainerStore` (required for `COMMIT`), and `RETURN_TO_CONTRIBUTORS` gives every item back to the player who put it in. By default a container ends when no screen shows it any more (`endWhenUnviewed(true)`).

```java
SlotContainer bag = ui.container(ContainerSpec.storage(27)
        .baseline(loadBag(player.getUniqueId()))
        .disposition(Disposition.COMMIT)
        .store(snapshot -> saveBag(player.getUniqueId(), snapshot)) // returns CompletionStage<StoreAnswer>
        .undelivered((playerId, items) -> keepForLater(playerId, items))
        .build());

ui.show(player, Grid.builder(Text.of(messages.key("bag.title")), 3)
        .bindRange(0, 0, 27, bag, 0, BindingMode.EDITABLE)
        .build());
```

The store answers `StoreAnswer.written()`, `refused(current)` or `unknown(cause)`. An answer later than the spec's commit timeout (default 30 seconds, at most 10 minutes) counts as unknown; the container then becomes `FAILED`, refunds nothing and the store is responsible for the items. `ui.deliver(player, items)` gives items to a player's inventory and drops the rest at their feet. The full rules are in the Javadoc of `SlotContainer`, `ContainerSpec` and `ContainerStore`.

## Unload and server stop

A module unloads when an operator runs `/upm uninstall <module>`, when the server stops, and when its load fails after the service was issued. When a module copy unloads, the framework ends its UI before it cancels the module's `@Scheduled` tasks and before `onUnregister()` runs. On the unloading thread it runs pending deliveries, starts the write of every `COMMIT` container with changes, ends every open session with `Closed(OWNER_UNLOADED)` (or the outcome already chosen), and then waits for the store answers. `show` during or after the unload returns a session that is already `Closed(OWNER_UNLOADED)` and opens nothing.

The store wait is bounded:

| Situation | Wait |
| --- | --- |
| Unloading one module | Each write waits at most its remaining commit timeout or the remaining unload wait of about 10 seconds, whichever comes first |
| Server stop | All modules share one budget of about 10 seconds, started before the first module unloads. Only the time spent unloading UI storage is charged, not the time other modules spend in their shutdown hooks; the budget is never refilled |

Once storage waits have used up the server-stop budget, later modules get no wait at all: their writes are treated as timed out at once. Unanswered writes count as unknown and those containers end with `UNKNOWN_KEPT_BY_STORE`: no items are returned and the store is responsible for them.

::: warning Keep storage alive until onUnregister
Keep the connections and thread pools your `ContainerStore` uses open until your `onUnregister()` hook runs. Complete the store's stage without the server thread: during an unload the server thread is the one waiting, and tasks scheduled for it no longer run.
:::

## Known limitations

- The server stop shares one storage-wait budget of about 10 seconds across all modules, as described above; a module unloaded after the budget is used up gets no wait.
- Chest inventories contain display copies. The backend cancels clicks and drags before it applies its own transfers. Another plugin must not clear that cancellation with `setCancelled(false)` or `setResult(ALLOW)`, or vanilla can move the display copies and duplicate items.
- Number-key swaps and Shift moves depend on the `InventoryAction` Paper computes from the displayed copy. While a redraw is pending the input may be ignored; wait for the redraw and retry.
- Paper gives no signal when another plugin replaces a dialog. If another plugin shows its own dialog after yours, the timeout dismissal of yours also closes that dialog.
- The declarative engine now hands `Grid` snapshots to the `UiService` instead of inheriting obliviate's `Gui`. Modules with 6.x screens must be migrated and rebuilt against 7.0; see [Declarative GUI](/guide/advanced/declarative-gui).
