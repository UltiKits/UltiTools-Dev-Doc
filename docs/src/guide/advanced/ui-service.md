# UI: Intents and Sessions

As of v7.0.0, modules show screens to players through the framework's `UiService` (package `com.ultikits.ultitools.ui`). A module describes what it wants to show or ask as an intent. The service picks a backend that can display it, a Paper dialog or a chest inventory, and returns a `UiSession` whose result says how the screen ended. The [declarative GUI](/guide/advanced/declarative-gui) builds its pages on the same service.

::: info As of v7.0.0
6.x has no `UiService`. For the 6.x screen classes, see the [archived v6.5.0 guide](/v6.5.0/guide/advanced/gui.html).
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

### Chat confirmation {#chat-confirmation}

The `Confirm` above is the only confirmation the framework offers as of v7.0.0. The 6.x chat confirmation (`Confirm.chat(...)`, `ChatConfirm`) and the chest confirmation (`BaseConfirmationPage`, `Confirm.gui(...)`) are removed. A module that wants a "click in chat" prompt writes it itself with Adventure's `ClickEvent.callback`. Import `java.util.UUID`, `org.bukkit.entity.Player`, `net.kyori.adventure.text.Component`, `net.kyori.adventure.text.format.NamedTextColor` and `net.kyori.adventure.text.event.ClickCallback` / `ClickEvent`. Given a target `Player player` and `Runnable onConfirm` / `onCancel`:

```java
UUID target = player.getUniqueId();
ClickCallback.Options once = ClickCallback.Options.builder().uses(1).build();
Component yes = Component.text("[Confirm]", NamedTextColor.GREEN).clickEvent(ClickEvent.callback(audience -> {
    if (audience instanceof Player clicker && clicker.getUniqueId().equals(target)) {
        onConfirm.run();
    }
}, once));
Component no = Component.text("[Cancel]", NamedTextColor.RED).clickEvent(ClickEvent.callback(audience -> {
    if (audience instanceof Player clicker && clicker.getUniqueId().equals(target)) {
        onCancel.run();
    }
}, once));
player.sendMessage(Component.text("Delete this home?").appendNewline().append(yes).append(Component.space()).append(no));
```

Properties to plan for:

- Prompts expire on the server after Paper's default callback lifetime (about 12 hours); clicking an expired button does nothing.
- Clicks do not pass through the command pipeline, so command blockers of other plugins never see them.
- Paper logs an exception thrown by a button's action and does not disconnect the player.
- The two buttons are independent: confirm and then cancel runs both actions once each. A module that needs mutually exclusive actions enforces that itself.
- Unloading the module does not revoke pending callbacks; until one expires, clicking an old button can still run code of the unloaded module.

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

Supply a `CreateHome` callback to handle a submission; it is not called if the form closes without a submission. The example uses `Text.plain`, so it does not need a message catalogue.

```java
package com.example.mymodule.ui;

import com.ultikits.ultitools.scheduling.Scheduler;
import com.ultikits.ultitools.text.Text;
import com.ultikits.ultitools.ui.Form;
import com.ultikits.ultitools.ui.FormResponse;
import com.ultikits.ultitools.ui.SliderInput;
import com.ultikits.ultitools.ui.TextInput;
import com.ultikits.ultitools.ui.ToggleInput;
import com.ultikits.ultitools.ui.UiService;
import java.util.concurrent.CompletionStage;
import org.bukkit.entity.Player;

public final class HomeFormExample {
    @FunctionalInterface
    public interface CreateHome {
        void create(Player player, String name, boolean shared, double radius);
    }

    public static CompletionStage<Void> show(UiService ui, Scheduler scheduler, Player player,
                                             CreateHome createHome) {
        TextInput name = TextInput.builder("name", Text.plain("Name")).maxLength(24).build();
        ToggleInput shared = ToggleInput.of("shared", Text.plain("Shared"), false);
        SliderInput radius = SliderInput.builder("radius", Text.plain("Radius"), 1, 10)
                .initial(3)
                .build();
        Form form = Form.builder(Text.plain("Create a home"))
                .input(name)
                .input(shared)
                .input(radius)
                .build();

        return ui.show(player, form).result().thenAcceptAsync(result -> {
            if (!result.isCompleted()) {
                return;
            }
            FormResponse response = result.value();
            createHome.create(player, response.get(name), response.get(shared), response.get(radius));
        }, scheduler.entity(player));
    }
}
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
| `Closed(INTERRUPTED)` | The game or another plugin ended the screen rather than the player, or the framework could not open it. See [When each reason appears](#close-reasons) (as of v7.0.0) |
| `Closed(DISCONNECTED)` | The player left the server, or was already offline when `show` was called |
| `Closed(REPLACED)` | Another intent was shown to the same player; a player has at most one open session |
| `Closed(TIMED_OUT)` | The timeout elapsed |
| `Closed(CLOSED_BY_CODE)` | The module called `session.close()` |
| `Closed(OWNER_UNLOADED)` | The module that showed it was unloaded |
| `Closed(UNSUPPORTED)` | No backend can show the intent to this player, or opening it failed |

When no backend supports an intent, nothing opens and the player's previous session stays open. More `CloseReason` constants may be added in a 7.x minor release.

`session.close()` may be called from any thread and more than once. The screen closes and the result completes later, never inside the call, so it is safe from a grid action or an event handler.

### When each reason appears {#close-reasons}

As of v7.0.0, `INTERRUPTED` covers the cases where the screen ended without the player choosing to close it. The table lists what produces each reason on each backend:

| Reason | Dialog | Chest screen |
| --- | --- | --- |
| `PLAYER` | The player pressed Cancel, or the answer was rejected as invalid | The player closed the inventory |
| `DISCONNECTED` | The player left the server | The player left the server. A close the game reports as "cannot use" followed by a quit in the same tick also counts |
| `INTERRUPTED` | The player died, changed worlds, or another inventory opened for the player (the open event was not cancelled) | The game or another plugin closed the inventory: death, teleport, another inventory opened, a plugin call. Also when the framework could not open the screen, or reopen it after a title change |
| `REPLACED` | The framework showed the player's next screen | The same |
| `CLOSED_BY_CODE` | The module called `session.close()` | The same |
| `OWNER_UNLOADED` | The module was unloaded | The same |
| `TIMED_OUT` | The timeout elapsed | The same, if you set a timeout |

A chest screen also ends at once with `INTERRUPTED` when its first open, or its reopen after a title change, is refused, for example because another plugin cancelled the open event. The storage commit still runs as usual (see below).

The framework closes nothing else for you. When another inventory opens and interrupts a dialog, the new inventory stays open.

### Interrupted dialogs {#interrupted-dialogs}

A shown dialog ends with `Closed(INTERRUPTED)` when its player dies, changes worlds, or another inventory opens for the player. A cancelled death event or inventory-open event does not interrupt it. The result is delivered like every other result, in a task of the viewer's entity context.

Paper sends no signal for other ways a dialog can be displaced, for example another plugin showing its own dialog. The framework cannot tell, so such a session stays open until its timeout. Give a dialog that can sit on screen for a long time a suitable explicit timeout with `ShowOptions` instead of relying on the 10-minute default.

### The close reason does not change storage {#close-reason-and-storage}

For a screen bound to a storage container, the reason only describes how the screen ended. A container with unsaved changes is committed the same way whether the session ended with `PLAYER`, `INTERRUPTED`, `DISCONNECTED` or any other reason, and an unchanged container writes nothing. The reason adds no tick before the commit.

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

### What the client shows {#client-display}

- The native client draws a safety-warning icon next to a dialog's title. It is not a button the framework adds. Do not count it among the action buttons listed above.
- A slider shows its label and the current value, not the two ends of its range. To let players know the range, put it in the label or the body text.

## Timeouts

Notice, Confirm, Form and Choice time out after 10 minutes by default; a grid has no timeout. A timeout is also what ends a dialog that the game displaced in a way the server cannot see (see [Interrupted dialogs](#interrupted-dialogs)). Pass `ShowOptions` to change it:

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

Supply a `joinArena` callback that takes the player who clicked the icon. After the callback returns, the click action closes the session.

```java
package com.example.mymodule.ui;

import com.ultikits.ultitools.item.ItemSpec;
import com.ultikits.ultitools.text.Text;
import com.ultikits.ultitools.ui.Grid;
import com.ultikits.ultitools.ui.GridSession;
import com.ultikits.ultitools.ui.UiService;
import java.util.function.Consumer;
import net.kyori.adventure.key.Key;
import org.bukkit.entity.Player;

public final class ArenaMenuExample {
    public static GridSession show(UiService ui, Player player, Consumer<Player> joinArena) {
        ItemSpec icon = ItemSpec.builder(Key.key("minecraft:diamond_sword"))
                .name(Text.plain("Join arena"))
                .build();
        Grid menu = Grid.builder(Text.plain("Arena"), 1)
                .set(0, 4, icon, click -> {
                    joinArena.accept(click.viewer());
                    click.session().close();
                })
                .build();
        return ui.show(player, menu);
    }
}
```

A `GridClick` carries `viewer()`, `slot()`, `kind()` (a `ClickKind`) and `session()`. The action runs only if the session is still open when its task runs. It may call `update`, `close()` or show another intent. An exception from the action is logged with the owner and swallowed.

A double click runs the action once: the chest backend ignores the double-click event on an icon and drops a second left click on the same icon within 250 ms.

Icons are rendered for each viewer through the [item renderer](/guide/essentials/items#rendering), so names and lore appear in the viewer's language; the title is rendered for the viewer as well.

### Redrawing

`session.update(next)` replaces the snapshot. `current()` returns `next` as soon as the call returns; the backend is told in a later task of the viewer's entity context, and several updates made before that task may reach it as one. The row count cannot change (`IllegalArgumentException`). The title may change: the backend then reopens the inventory, which does not end the session, and it does not reopen while the player holds an item on the cursor.

A click is applied to the snapshot the backend had when the click was reported. A click made on an older picture that arrives after a redraw runs the action of the redrawn slot, so keep each action safe for whatever the slot shows now. Slots bound to a container are redrawn automatically when the container changes.

### Cursor before opening and on close {#cursor-on-close}

As of v7.0.0, before it shows a chest screen or a dialog, the framework checks the menu the player has open. If it is the player's own backpack (survival or creative) and the cursor or the 2x2 crafting grid holds items, the framework closes that menu the way vanilla does: the items go back into the backpack, and what does not fit drops at the player's feet. Those items are not carried into the new screen. An empty backpack gets no extra close, and a container the player already has open is left to Paper's normal opening rules.

When a chest screen closes, the framework closes the inventory through Paper and does not move the cursor item itself; Paper handles it as for any closed inventory. The items in the chest inventory are display copies, never real items.

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

As of v7.0.0, `/upm uninstall <module>` queues removal for the next restart; it does not unload the running module or close its UI. See [module changes on a server](/guide/advanced/module-versioning#updating-and-uninstalling-on-a-server). When a module actually unloads, for example at server stop or after a load failure once the service was issued, the framework ends its UI before it cancels the module's `@Scheduled` tasks and before `onUnregister()` runs. On the unloading thread it runs pending deliveries, starts the write of every `COMMIT` container with changes, ends every open session with `Closed(OWNER_UNLOADED)` (or the outcome already chosen), and then waits for the store answers. `show` during or after the unload returns a session that is already `Closed(OWNER_UNLOADED)` and opens nothing.

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
- Do not open two screens for the same storage key at once. If a screen for a key is still open with unsaved changes and you open another for the same key, the new screen reads the old data; the framework does not merge the two copies. End the old screen, wait for its commit, then read the key and show it again.
- When the framework rejects a click, the client first draws its own prediction and the server then corrects it, so the picture can flicker. This is part of the game protocol. Other viewers of the same container see a change one tick later than the player who made it.
- During an actual unload or reload on a running server, the framework waits on the server thread for unsaved storage screens for up to about 10 seconds. That equals Paper's default `watchdog.early-warning-delay` (10000 milliseconds), so a full wait can make Paper print `The server has not responded for 10 seconds! Creating thread dump` and a thread dump. The server is not crashing; look at the store that did not answer. Paper prints no such warning while the server is stopping.
- The declarative engine now hands `Grid` snapshots to the `UiService` instead of inheriting obliviate's `Gui`. Modules with 6.x screens must be migrated and rebuilt against 7.0; see [Declarative GUI](/guide/advanced/declarative-gui). The legacy chest pages and both old confirmation widgets (chest and chat) are removed too; see [Chat confirmation](#chat-confirmation) and [Legacy chest pages and confirmation widgets in 7.0](/guide/advanced/upgrading-to-7#chest-and-confirmation).
