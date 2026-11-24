# Items and Item Storage

As of v7.0.0, a module describes an item with `ItemSpec` and turns it into an `ItemStack` with the framework's `ItemRenderer`, in the viewer's language. Both are in the package `com.ultikits.ultitools.item` and build on Paper's data components. `ItemStackUtils` still stores item arrays as strings; it writes a new format and keeps reading strings saved by 6.x.

::: warning Unreleased v7.0.0 behaviour
This page describes the unreleased 7.0.0 framework. 6.x has no `ItemSpec` or `ItemRenderer` and builds items with `ItemStackBuilder`, which 7.0 removes.
:::

## Describing an item

`ItemSpec` describes an item without creating a stack and without fixing a language. Start a builder from a `Material` or an item key, set what you need and call `build()`:

```java
ItemSpec spec = ItemSpec.builder(Material.DIAMOND)
        .amount(3)
        .name(messages.key("shop.diamond.name"))
        .addLore(messages.key("shop.diamond.price"), Arg.string("price", "100"))
        .glint(true)
        .build();
```

`messages` is the module's injected `Messages` service; see [Messages and Languages](/guide/essentials/messages).

The builder offers these attributes:

| Builder method | Effect |
|---|---|
| `amount(int)` | Stack size, 1 to 99; the default is 1 |
| `name(MessageKey, Arg...)`, `name(Text)` | The item name; `null` clears it |
| `addLore(MessageKey, Arg...)`, `addLore(Text)` | Appends one lore line |
| `lore(List<? extends Text>)` | Replaces all lore lines |
| `model(Key)` | The `ITEM_MODEL` component; `null` clears it |
| `glint(Boolean)` | Forces the enchantment glint on or off without adding an enchantment; `null` keeps the item's default |
| `tooltipHidden(boolean)` | Hides the whole tooltip, name and lore included |
| `hiddenInTooltip(Set<? extends DataComponentType>)` | Hides the tooltip lines of these components, for example `DataComponentTypes.ATTRIBUTE_MODIFIERS` |
| `data(type, value)`, `data(type)` | Sets any other data component, valued or flag |
| `remove(type)` | Removes a component the item type has by default |
| `marker(NamespacedKey, PersistentDataType, value)` | Writes a value into the item's persistent data container; a second marker with the same key replaces the first in its original position |

`data` and `remove` reject the five components that have their own methods (`item_name`, `lore`, `item_model`, `enchantment_glint_override` and `tooltip_display`) with `IllegalArgumentException`. Values passed to `data` are applied unchanged and are not translated; pass immutable values, as Paper's own component values are.

A built `ItemSpec` is immutable and safe to share between threads, and two descriptions with the same attributes are equal. `toBuilder()` returns a builder with every attribute copied. The builder itself is not thread-safe.

`ItemSpec.builder(Key)` with the amount, text, model, glint, `tooltipHidden` and marker attributes needs no running server. `ItemSpec.builder(Material)` and any `DataComponentType` argument need Paper's registries.

## Names and lore

Names and lore are `Text` values: a key from the module's language files with its arguments, or fixed text such as `Text.literal(component)`. Write the language-file values in MiniMessage, as for any other message; `&` colour codes are not interpreted.

The renderer writes the name to the `ITEM_NAME` component, not to the italic custom-name component, and adds no style of its own. A lore line that does not set italic is shown upright, unlike vanilla's italic lore. Explicit styling is kept as written, including `<i>` on a whole line or on part of it, and colours are never changed. Give colours in the text; the framework does not pick one.

## Rendering

Inject the renderer like any other bean:

```java
@Service
public class ShopItems {
    @Autowired
    private ItemRenderer itemRenderer;

    public void give(Player player, ItemSpec spec) {
        player.getInventory().addItem(itemRenderer.render(spec, player));
    }
}
```

`ItemRenderer` is a framework singleton that every module's container resolves to the same instance. It has two methods:

- `render(spec, viewer)` takes an Adventure `Audience` and chooses the language as `Messages` does: a player gets the forced `language` from `config.yml` if one is set, otherwise their client locale; the console and other non-player audiences get the fallback language. See [Language selection](/guide/essentials/messages#language-selection).
- `render(spec, locale)` uses the given `Locale`.

Each text is then looked up in the usual [lookup order](/guide/essentials/messages#lookup-order). The rendered stack holds the text in that one language, because Paper does not translate item text per client. Render the description again for a viewer with another language.

Each call creates a new, independent `ItemStack`. The renderer sets the typed attributes first, then the `data` and `remove` changes in the order they were added, then the markers. `TOOLTIP_DISPLAY` is written only when the whole tooltip is hidden or at least one component is hidden in it. To change a stack after rendering, call Paper's `setData`, `unsetData` or `editMeta` on it.

The amount is passed to Paper as given and is not reduced to the item type's maximum stack size, so an amount of 99 of an item that stacks to 16 stays 99.

The renderer is thread-safe and needs a running Paper server.

## Rendering failures

| Situation | Result |
|---|---|
| `ItemSpec.builder` with air, or with a `Material` that is not an item | `IllegalArgumentException` when the builder is created |
| `amount` outside 1 to 99 | `IllegalArgumentException` from `amount` |
| A key that is not in the running server's item registry, such as an unknown or block-only key | `IllegalArgumentException` from `render` |
| Component values that Paper rejects, such as more lore lines than Paper allows | Paper's `IllegalArgumentException` from `render`; the framework keeps no copy of Paper's limits |
| A text key missing from every language file | The key itself is shown and a warning is logged, as for any message |

## Storing items

`com.ultikits.ultitools.utils.ItemStackUtils` keeps its five static methods. They return `null` when the input is absent or the conversion fails, and log each failure at `SEVERE`.

| Method | Returns |
|---|---|
| `serializeItems(ItemStack[])` | A Base64 string, or `null` for a `null` array or a failure |
| `deserializeItems(String)` | The item array, or `null` for a `null` or empty string or a failure |
| `serializeItem(ItemStack)` | The item stored as a one-element array, or `null` for a `null` item or a failure |
| `deserializeItem(String)` | The first slot of the array; `null` for a failure, an empty array or an empty first slot |
| `isValidSerialized(String)` | Whether `deserializeItems` can read the string |

As of v7.0.0, writing uses Paper's item byte format (`ItemStack.serializeItemsAsBytes`) encoded with Base64. Reading accepts line-wrapped Base64. Arrays may contain `null` slots; on reading, an empty item comes back as a `null` slot, so the array keeps its length and its empty positions. 6.x returned empty items as they were stored, for example as an air item.

Reading also accepts strings saved by 6.x `ItemStackUtils`: when the decoded bytes start with `0xAC 0xED`, they are read as the old Bukkit object stream. 7.0 never writes that format. Item formats that a module defined itself are not read.

A module that stores items through `ItemStackUtils` needs no migration step. Old strings stay readable, and each value is written in the new format the next time the module saves it.

::: warning New strings are not readable by 6.x
Strings written by 7.0 cannot be read by a 6.x framework. Back up stored inventories and item strings before upgrading.
:::

## Stored-item limitations

- `deserializeItem` returns `null` both for an empty item that was read correctly and for a failure. Check the log, or use the array from `deserializeItems`, when the difference matters.
- An older game version cannot read item data written by a newer one. If a module then saves its current or empty inventory as usual, it can overwrite the unreadable original. When rolling back, restore a matching backup, and do not save automatically over item data that failed to load.
- `ItemStackUtils` is for trusted data your own server saved earlier. Do not pass player uploads, chat input or Java object streams from outside to it. Its readers are not a security boundary: corrupt or hostile input can exhaust memory, and the reader for the 6.x format has no class allowlist.
