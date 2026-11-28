# GUI Interface

UltiTools-API 7.0 removes the 6.x imperative chest pages without a compatibility bridge and no longer bundles obliviate-invs. Use the replacements below and rebuild your module against 7.0. For 6.x classes and examples, see the [archived v6.5.0 guide](/v6.5.0/guide/advanced/gui.html).

## Replacements in 7.0 <Badge type="tip" text="v7.0.0+" />

| Removed in 7.0 | Use instead | Documented in |
|---|---|---|
| `BaseInventoryPage` | `DeclarativeGui`: return a tree of `Container`, `TextButton` and `ItemDisplay` from `build(BuildContext)` | [Declarative GUI](/guide/advanced/declarative-gui) |
| `BasePaginationPage` | Keep the page number in a `State`, build the visible slice with `GridView`, and turn pages with `setState` | [Declarative GUI](/guide/advanced/declarative-gui) |
| `BaseConfirmationPage`, `Confirm.gui(...)` | `Confirm` of the UI service (`com.ultikits.ultitools.ui.Confirm`), shown with `UiService#show` | [UI: Intents and Sessions](/guide/advanced/ui-service#notice-and-confirm) |
| `Confirm.chat(...)` (`ChatConfirm`) | None in the framework; the module sends its own clickable chat prompt | [UI: Intents and Sessions](/guide/advanced/ui-service#chat-confirmation) |
| `Buttons`, `ViewType` | No replacement type; use a `TextButton` label or the framework label keys | [Dialog buttons](/guide/advanced/ui-service#dialog-buttons) |
| obliviate-invs, UniversalScheduler | No longer bundled; see [Legacy chest pages and confirmation widgets](/guide/advanced/upgrading-to-7#chest-and-confirmation) | |

## Colors

The `com.ultikits.ultitools.entities.Colors` enum still selects glass pane colors for buttons and decorations. The framework's built-in GUI glass colors and button materials are unchanged.

::: warning v7.0.0 color API change
`Colors#getCode()` and `XVersionUtils` are removed. Use `Colors#getGlassPaneMaterial()` to get a Bukkit `Material`, or use `Material.CYAN_STAINED_GLASS_PANE` directly.
:::

```java
ItemStack glass = new ItemStack(Colors.CYAN.getGlassPaneMaterial());
```

See [Native item and sound APIs in 7.0](/guide/advanced/upgrading-to-7#items-and-sounds) for the full migration.
