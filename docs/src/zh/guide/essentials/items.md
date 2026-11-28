# 物品与物品存储

自 v7.0.0 起，模块用 `ItemSpec` 描述物品，再由框架的 `ItemRenderer` 按观看者的语言生成 `ItemStack`。两者都在 `com.ultikits.ultitools.item` 包中，基于 Paper 的数据组件（data component）。`ItemStackUtils` 仍把物品数组存成字符串；它改用新格式写入，并继续读取 6.x 保存的字符串。

::: warning 自 v7.0.0 起
本页描述自 v7.0.0 起的框架行为。6.x 没有 `ItemSpec` 和 `ItemRenderer`，用 `ItemStackBuilder` 构建物品，而 7.0 删除了它。
:::

## 描述物品

`ItemSpec` 只描述物品，不创建物品栈，也不固定语言。从 `Material` 或物品键开始构建，设置需要的属性后调用 `build()`：

```java
ItemSpec spec = ItemSpec.builder(Material.DIAMOND)
        .amount(3)
        .name(messages.key("shop.diamond.name"))
        .addLore(messages.key("shop.diamond.price"), Arg.string("price", "100"))
        .glint(true)
        .build();
```

`messages` 是模块注入的 `Messages` 服务，见[消息与语言](/zh/guide/essentials/messages)。

构建器提供以下属性：

| 构建器方法 | 作用 |
|---|---|
| `amount(int)` | 数量，1 到 99；默认为 1 |
| `name(MessageKey, Arg...)`、`name(Text)` | 物品名字；传 `null` 清除 |
| `addLore(MessageKey, Arg...)`、`addLore(Text)` | 追加一行说明 |
| `lore(List<? extends Text>)` | 替换全部说明行 |
| `model(Key)` | `ITEM_MODEL` 组件；传 `null` 清除 |
| `glint(Boolean)` | 强制打开或关闭附魔光效，不添加附魔；传 `null` 保持物品默认 |
| `tooltipHidden(boolean)` | 隐藏整个提示框，名字和说明也一起隐藏 |
| `hiddenInTooltip(Set<? extends DataComponentType>)` | 隐藏这些组件在提示框中的行，例如 `DataComponentTypes.ATTRIBUTE_MODIFIERS` |
| `data(type, value)`、`data(type)` | 设置其他任意数据组件，带值或标志型均可 |
| `remove(type)` | 移除物品类型默认带有的组件 |
| `marker(NamespacedKey, PersistentDataType, value)` | 向物品的持久数据容器写入一个值；同键的第二个标记在原位置替换第一个 |

`data` 和 `remove` 拒绝五个有专门方法的组件（`item_name`、`lore`、`item_model`、`enchantment_glint_override` 和 `tooltip_display`），抛出 `IllegalArgumentException`。传给 `data` 的值原样应用，不翻译；请传不可变的值，Paper 自带的组件值都是不可变的。

构建出的 `ItemSpec` 不可变，可在线程间共享；属性相同的两个描述相等。`toBuilder()` 返回复制了全部属性的构建器。构建器本身不是线程安全的。

`ItemSpec.builder(Key)` 配合数量、文本、模型、光效、`tooltipHidden` 和标记属性时，不需要运行中的服务器。`ItemSpec.builder(Material)` 和任何 `DataComponentType` 参数需要 Paper 的注册表。

## 名字与说明行

名字和说明行都是 `Text`：模块语言文件中的键加参数，或者固定文本，例如 `Text.literal(component)`。语言文件中的值和其他消息一样用 MiniMessage 编写，不解释 `&` 颜色码。

渲染器把名字写入 `ITEM_NAME` 组件，而不是会显示为斜体的自定义名字组件，也不追加任何样式。说明行未设置斜体时显示为正体，这与原版默认斜体的说明行不同。明确写出的样式保持原样，包括整行或一行中部分文字的 `<i>`，颜色也不会被改动。颜色请在文本中给出，框架不替你选择。

## 渲染

像其他 Bean 一样注入渲染器：

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

`ItemRenderer` 是框架单例，每个模块的容器取到的都是同一个实例。它有两个方法：

- `render(spec, viewer)` 接收 Adventure 的 `Audience`，按与 `Messages` 相同的方式选择语言：对玩家，`config.yml` 设置了强制的 `language` 时用它，否则用玩家客户端语言；控制台和其他非玩家对象使用后备语言。见[语言选择](/zh/guide/essentials/messages#language-selection)。
- `render(spec, locale)` 使用给定的 `Locale`。

每段文本随后按通常的[查找顺序](/zh/guide/essentials/messages#查找顺序)查找。渲染出的物品栈只包含这一种语言的文本，因为 Paper 不会按客户端翻译物品文本。观看者语言不同时，请为其重新渲染描述。

每次调用都创建一个新的、独立的 `ItemStack`。渲染器先写入有专门方法的属性，再按添加顺序应用 `data` 和 `remove` 的修改，最后写入标记。只有隐藏整个提示框，或至少隐藏一个组件时，才写入 `TOOLTIP_DISPLAY`。渲染后要修改物品栈，直接调用 Paper 的 `setData`、`unsetData` 或 `editMeta`。

数量原样交给 Paper，不会被降到该物品类型的最大堆叠数，所以最多堆叠 16 个的物品设为 99 时仍是 99。

渲染器是线程安全的，需要运行中的 Paper 服务器。

## 渲染失败

| 情况 | 结果 |
|---|---|
| 用空气或不是物品的 `Material` 调用 `ItemSpec.builder` | 创建构建器时抛出 `IllegalArgumentException` |
| `amount` 超出 1 到 99 | `amount` 抛出 `IllegalArgumentException` |
| 键不在运行中服务器的物品注册表里，例如未知键或纯方块键 | `render` 抛出 `IllegalArgumentException` |
| Paper 拒绝的组件值，例如说明行数超过 Paper 的上限 | `render` 抛出 Paper 的 `IllegalArgumentException`；框架不另存一份 Paper 的上限 |
| 文本键在所有语言文件中都不存在 | 与其他消息一样，显示键本身并记录一条警告 |

## 存储物品

`com.ultikits.ultitools.utils.ItemStackUtils` 保留五个静态方法。输入缺失或转换失败时返回 `null`，每次失败都以 `SEVERE` 级别记录日志。

| 方法 | 返回 |
|---|---|
| `serializeItems(ItemStack[])` | Base64 字符串；数组为 `null` 或失败时返回 `null` |
| `deserializeItems(String)` | 物品数组；字符串为 `null`、为空或失败时返回 `null` |
| `serializeItem(ItemStack)` | 把该物品存成单元素数组；物品为 `null` 或失败时返回 `null` |
| `deserializeItem(String)` | 数组的第一个槽位；失败、空数组或第一个槽位为空时返回 `null` |
| `isValidSerialized(String)` | `deserializeItems` 能否读出该字符串 |

自 v7.0.0 起，写入使用 Paper 的物品字节格式（`ItemStack.serializeItemsAsBytes`），再以 Base64 编码。读取接受带换行的 Base64。数组可以包含 `null` 槽位；读取时空物品还原为 `null` 槽位，数组长度和空位位置不变。6.x 按存储时的样子返回空物品，例如空气物品。

读取同样接受 6.x `ItemStackUtils` 保存的字符串：解码后的字节以 `0xAC 0xED` 开头时，按旧的 Bukkit 对象流读取。7.0 不再写出这种格式。模块自己定义的物品格式不在读取范围内。

通过 `ItemStackUtils` 存储物品的模块不需要迁移步骤。旧字符串仍可读取，每个值在模块下次保存时改为新格式写入。

::: warning 新字符串无法被 6.x 读取
7.0 写入的字符串无法被 6.x 框架读取。升级前请备份存储的背包和物品字符串。
:::

## 物品存储的限制

- 正常读出的空物品和读取失败，`deserializeItem` 都返回 `null`。需要区分时，查看日志，或使用 `deserializeItems` 返回的数组。
- 旧的游戏版本读不了新版本写入的物品数据。模块若随后照常保存当前背包或空背包，可能覆盖读不出的原数据。回退时恢复匹配的备份，不要在读取失败后自动保存覆盖。
- `ItemStackUtils` 只用于服务器自己先前保存的可信数据。不要把玩家上传、聊天输入或外部 Java 对象流交给它。它的读取器不是安全边界：损坏或恶意的输入可能耗尽内存，6.x 格式的读取器没有类白名单。
