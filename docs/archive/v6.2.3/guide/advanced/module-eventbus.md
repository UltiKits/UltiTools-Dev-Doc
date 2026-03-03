# Module EventBus

::: info Since v6.2.2
The Module EventBus is available starting from UltiTools-API v6.2.2.
:::

UltiTools provides a decoupled publish/subscribe event system for inter-module communication. Modules can publish events and subscribe to events from other modules without any direct dependency between them.

## Defining Events

Create a custom event by extending `ModuleEvent`:

```java
import com.ultikits.ultitools.events.ModuleEvent;
import lombok.Getter;

public class BalanceChangeEvent extends ModuleEvent {
    @Getter private final UUID player;
    @Getter private final double amount;

    public BalanceChangeEvent(UUID player, double amount) {
        this.player = player;
        this.amount = amount;
    }
}
```

Every `ModuleEvent` automatically carries:
- `sourceModule` — the name of the module that published the event (set via `setSourceModule()`)
- `timestamp` — the time the event was created (`System.currentTimeMillis()`)

## Annotation-Based Handlers

Mark a method with `@ModuleEventHandler` in any managed bean. The framework discovers and registers it automatically:

```java
@Service
public class AuditService {

    @ModuleEventHandler
    public void onBalanceChange(BalanceChangeEvent event) {
        Bukkit.getLogger().info(
            event.getSourceModule() + " changed balance for "
            + event.getPlayer() + " by " + event.getAmount()
        );
    }
}
```

The method must have **exactly one parameter** that extends `ModuleEvent`.

### Annotation Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `priority` | `EventPriority` | `NORMAL` | Execution order — `LOWEST` runs first, `MONITOR` runs last |
| `ignoreCancelled` | `boolean` | `false` | If `true`, skip this handler when the event has been cancelled |

```java
@ModuleEventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
public void onHighPriority(BalanceChangeEvent event) {
    // Runs after NORMAL handlers, skips if event was cancelled
}
```

## Priority Order

Handlers execute in priority order from lowest to highest:

`LOWEST` → `LOW` → `NORMAL` → `HIGH` → `HIGHEST` → `MONITOR`

::: tip MONITOR Priority
Use `MONITOR` for read-only observation (logging, analytics). Avoid modifying event state at this priority.
:::

## Programmatic Subscriptions

For dynamic subscriptions (e.g., temporary listeners), use the EventBus API directly:

```java
EventBus eventBus = UltiTools.getInstance().getEventBus();

// Simple subscription
Subscription sub = eventBus.subscribe(BalanceChangeEvent.class, event -> {
    player.sendMessage("Balance changed by " + event.getAmount());
});

// Later, unsubscribe when no longer needed
sub.unsubscribe();
```

Full options are also available:

```java
Subscription sub = eventBus.subscribe(
    BalanceChangeEvent.class,
    EventPriority.HIGH,
    true,       // ignoreCancelled
    "MyModule", // owner module name
    event -> { /* handler */ }
);
```

The returned `Subscription` provides:
- `unsubscribe()` — stop receiving events (safe to call multiple times)
- `isActive()` — check if the subscription is still active

## Publishing Events

### Synchronous

Handlers run on the calling thread in priority order:

```java
EventBus eventBus = UltiTools.getInstance().getEventBus();

BalanceChangeEvent event = new BalanceChangeEvent(player, 100.0);
event.setSourceModule("UltiEconomy");
eventBus.publish(event);
```

### Asynchronous

Handlers run on a background thread pool:

```java
eventBus.publishAsync(event);
```

::: warning Async Restrictions
- Cancellable events **cannot** be published asynchronously — the framework throws `IllegalArgumentException`
- Async handlers must not call most Bukkit API methods (use `Bukkit.getScheduler().runTask()` to dispatch back)
:::

## Cancellable Events

Implement `Cancellable` to allow handlers to prevent further processing:

```java
import com.ultikits.ultitools.events.Cancellable;

public class PlayerTradeEvent extends ModuleEvent implements Cancellable {
    private boolean cancelled;

    @Override
    public boolean isCancelled() { return cancelled; }

    @Override
    public void setCancelled(boolean cancelled) { this.cancelled = cancelled; }

    // ... your event data
}
```

A handler can cancel the event:

```java
@ModuleEventHandler(priority = EventPriority.LOW)
public void onTrade(PlayerTradeEvent event) {
    if (isBanned(event.getTrader())) {
        event.setCancelled(true); // Stops subsequent handlers with ignoreCancelled=true
    }
}
```

Handlers with `ignoreCancelled = true` will be skipped once the event is cancelled.

## Superclass Matching

Handlers registered for a parent event type also receive child events:

```java
// Catches ALL ModuleEvents
@ModuleEventHandler
public void onAnyEvent(ModuleEvent event) {
    Bukkit.getLogger().info("Event from " + event.getSourceModule());
}
```

A handler for `BalanceChangeEvent` will **not** receive other `ModuleEvent` subtypes.

## Error Isolation

If a handler throws an exception, it is logged and other handlers continue to execute normally. One buggy handler cannot break the entire event chain.

## Automatic Lifecycle

- **Registration**: `@ModuleEventHandler` methods in `@Service` beans are discovered and registered when the plugin module loads
- **Cleanup**: All handlers owned by a module are automatically unregistered when the module is unloaded

You do not need to manage handler lifecycle manually for annotation-based handlers.

## Complete Example

**Economy module** publishes an event when balance changes:

```java
// In UltiEconomy module
public class BalanceChangeEvent extends ModuleEvent {
    @Getter private final UUID player;
    @Getter private final double oldBalance;
    @Getter private final double newBalance;

    public BalanceChangeEvent(UUID player, double oldBalance, double newBalance) {
        this.player = player;
        this.oldBalance = oldBalance;
        this.newBalance = newBalance;
    }
}

@Service
public class EconomyService {
    @Autowired
    private UltiToolsPlugin plugin;

    public void setBalance(UUID player, double amount) {
        double old = getBalance(player);
        // ... update database ...

        BalanceChangeEvent event = new BalanceChangeEvent(player, old, amount);
        event.setSourceModule(plugin.getPluginName());
        UltiTools.getInstance().getEventBus().publish(event);
    }
}
```

**Separate audit module** receives it without depending on the economy module:

```java
// In a separate audit module
@Service
public class AuditLogService {

    @ModuleEventHandler
    public void onBalanceChange(BalanceChangeEvent event) {
        double delta = event.getNewBalance() - event.getOldBalance();
        Bukkit.getLogger().info(String.format(
            "[Audit] %s balance: %.2f -> %.2f (delta: %+.2f) from %s",
            event.getPlayer(), event.getOldBalance(),
            event.getNewBalance(), delta, event.getSourceModule()
        ));
    }
}
```

::: tip Cross-Module Communication
The EventBus is ideal for scenarios where modules need to react to each other's actions without tight coupling. Examples:
- Economy changes triggering audit logs or notifications
- Player teleport events triggering region checks
- Custom game events coordinating between multiple modules
:::
