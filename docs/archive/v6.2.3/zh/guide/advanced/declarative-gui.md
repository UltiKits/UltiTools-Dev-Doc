# 声明式 GUI

::: warning 实验性功能
该框架目前处于实验性状态，可能存在未知的问题，欢迎通过 GitHub Issue 提交问题反馈。
:::

## 1. 简介 (Introduction)

传统的 Bukkit GUI 开发通常是命令式的：你需要手动创建 `Inventory`，手动设置每一个 `ItemStack`，并监听 `InventoryClickEvent` 来处理交互。随着界面复杂度的增加，这种方式会导致代码难以维护，状态管理变得异常痛苦。

UltiTools 的声明式 GUI 框架引入了 **UI = f(State)** 的理念：
*   **声明式 (Declarative)**: 你只需要描述“当前状态下界面应该长什么样”，框架会自动处理如何从旧界面过渡到新界面。
*   **组件化 (Component-Based)**: 界面由一个个独立的 **Widget** 组合而成，易于复用和维护。
*   **响应式 (Reactive)**: 当数据（状态）发生变化时，界面会自动更新。

### 核心优势
*   **自动 Diff 更新**: 框架内部使用 Diff 算法，只更新发生变化的 Slot，极大降低网络包发送量，提升客户端性能。
*   **状态管理**: 内置类似 React/Flutter 的状态管理机制，轻松处理分页、多选、动态刷新等逻辑。
*   **无需手动监听**: 点击事件直接绑定在组件上，无需在全局 Listener 中通过 Slot 判断逻辑。

## 2. 核心概念 (Core Concepts)

### 2.1 Widget (组件)
Widget 是用户界面的不可变描述。它们是轻量级的配置对象。
*   **StatelessWidget**: 无状态组件。一旦创建，其表现形式就固定了（除非父组件重建它）。适用于纯展示内容，如标题、背景板。
*   **StatefulWidget**: 有状态组件。它持有状态（State），当状态改变时，可以触发界面刷新。适用于计数器、分页列表、开关等。

### 2.2 State (状态)
`State` 对象包含了 `StatefulWidget` 在生命周期中可变的数据。
*   **setState(() -> { ... })**: 当你需要修改数据并刷新界面时，**必须**在 `setState` 中进行。这会标记当前组件为“脏”，并在下一帧触发 `build` 重建。

### 2.3 BuildContext (构建上下文)
`BuildContext` 是组件在 Widget 树中的句柄。它提供了访问树中其他部分（如父级数据、导航器）的能力。

## 3. 快速开始 (Getting Started)

### 3.1 创建一个简单的 GUI
所有的声明式 GUI 都继承自 `DeclarativeGui` 类。

```java
import com.ultikits.ultitools.abstracts.gui.declarative.engine.DeclarativeGui;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.*;

public class MyFirstGui extends DeclarativeGui {

    public MyFirstGui(Player player) {
        // 参数：玩家，GUI ID，标题，行数
        super(player, "my_first_gui", "Hello GUI", 6);
    }

    @Override
    public Widget build(BuildContext context) {
        // 返回根组件
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

// 打开 GUI
new MyFirstGui(player).open();
```

## 4. 常用组件详解 (Widget Reference)

### 4.1 Container (容器)
最基础的容器组件，用于包裹其他组件，并可以设置背景。

```java
Container.builder()
    .background(IconWrapper.of(Material.GRAY_STAINED_GLASS_PANE)) // 设置背景
    .child(widget1) // 添加单个子组件
    .children(listWidgets) // 添加多个子组件
    .build();
```

### 4.2 TextButton (文本按钮)
一个带有背景颜色（玻璃板）和文字的按钮，是交互的基础。

```java
TextButton.builder()
    .text("Confirm")
    .color("LIME") // 使用 UltiTools Colors 定义的颜色名
    .slot(22)
    .lore("Click to confirm", "Action cannot be undone")
    .onClick(() -> {
        // 处理点击
    })
    .build();
```

### 4.3 ItemDisplay (物品展示)
用于展示一个具体的 `ItemStack`，支持点击事件。

```java
ItemDisplay.builder(itemStack)
    .slot(10)
    .name("My Sword") // 覆盖物品原名
    .lore("Damage: 100") // 覆盖物品 Lore
    .onClick(event -> {
        // event 是 InventoryClickEvent
    })
    .build();
```

### 4.4 GridView (网格布局)
非常适合用于展示列表数据（如商店商品、背包内容）。它可以自动计算行列位置。

```java
GridView.<ShopItem>builder()
    .startSlot(10) // 起始位置
    .columns(7)    // 每行几列
    .rows(4)       // 最多几行
    .items(itemList, item -> {
        // 将数据对象映射为 Widget
        return ItemDisplay.builder(item.getStack())
            .name(item.getName())
            .onClick(() -> buy(item))
            .build();
    })
    .build();
```

## 5. 状态管理与交互 (State Management)

当界面需要根据用户操作发生变化（如翻页、选中物品）时，需要使用 **StatefulWidget**。

### 示例：简单的计数器

```java
// 1. 定义 Widget
public class CounterWidget extends StatefulWidget {
    @Override
    public State createState() {
        return new CounterState();
    }
}

// 2. 定义 State
public class CounterState extends State<CounterWidget> {
    private int count = 0; // 这里的变量是持久的

    @Override
    public Widget build(BuildContext context) {
        return TextButton.builder()
            .slot(13)
            .text("Count: " + count)
            .color("BLUE")
            .onClick(() -> {
                // 3. 使用 setState 更新状态
                setState(() -> {
                    count++;
                });
            })
            .build();
    }
}
```

**原理解析**:
1.  用户点击按钮。
2.  `setState` 更新 `count` 变量。
3.  框架标记 `CounterWidget` 需要更新。
4.  框架重新调用 `build()` 方法。
5.  `TextButton` 被重新创建，文本变为 "Count: 1"。
6.  Diff 算法检测到 Slot 13 的物品名称变了，于是发送包更新该位置的物品（而不会刷新整个界面）。

## 6. 进阶技巧 (Advanced Topics)

### 6.1 SlotKey 的重要性
在渲染动态列表（如 `GridView`）时，给每个 Item 设置一个唯一的 Key 是至关重要的。这有助于 Diff 算法正确识别“移动”操作，而不是“删除再创建”。

```java
ItemDisplay.builder(item)
    .key(SlotKey.of("item-" + item.getId())) // 唯一标识
    .build();
```

### 6.2 导航与路由 (Navigation)
框架提供了 `Navigator` 组件用于在同一个 GUI 窗口内切换“页面”（实际上是切换 Widget 树）。

```java
// 在根 build 方法中
return new Navigator("home", Map.of(
    "home", (context) -> new HomePageWidget(),
    "settings", (context) -> new SettingsPageWidget()
));

// 在子组件中跳转
Navigator.of(context).push("settings");
```

### 6.3 性能优化
*   **避免在 build 中做耗时操作**: `build` 方法可能会被频繁调用（每秒多次），不要在里面读写数据库或进行复杂计算。
*   **提取常量 Widget**: 如果一个组件（如背景板）永远不会变，可以将其定义为 `static final` 字段，直接复用。
*   **局部刷新**: 尽量将状态下沉到叶子节点。例如，只有一个按钮需要变色，就只把那个按钮做成 `StatefulWidget`，而不是刷新整个页面。

---

## 7. 完整示例：商店页面

1.  **布局**: 使用 `Container` + `GridView`。
2.  **分页**: 使用 `currentPage` 状态控制数据切片。
3.  **单选**: 使用 `selectedSlot` 状态控制高亮显示。
4.  **交互**: 购买按钮根据选中状态动态显示/隐藏。

```java
public class ExampleShopPage extends DeclarativeGui {

    private final List<ShopItem> items;
    private int currentPage = 0;
    private int selectedSlot = -1;
    
    private static final int ITEMS_PER_PAGE = 28; // 4行 x 7列
    private static final int START_SLOT = 10;     // 从第2行第2列开始

    /**
     * 商店物品数据类。
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
     * 创建商店页面。
     *
     * @param player 玩家
     * @param items  物品列表
     */
    public ExampleShopPage(@NotNull Player player, @NotNull List<ShopItem> items) {
        super(player, "example_shop", "§6§lItem Shop", 6);
        this.items = new ArrayList<>(items);
    }

    @Override
    @NotNull
    public Widget build(@NotNull BuildContext context) {
        List<Widget> children = new ArrayList<>();

        // 1. 标题
        children.add(createTitle());

        // 2. 背景边框
        children.addAll(createBorders());

        // 3. 物品网格
        children.add(createItemGrid());

        // 4. 分页控制
        children.add(createPaginationControls());

        // 5. 选中项信息（如果有）
        if (selectedSlot >= 0) {
            children.add(createSelectedInfo());
        }

        // 6. 关闭按钮
        children.add(createCloseButton());

        return Container.builder()
                .children(children)
                .build();
    }

    /**
     * 创建标题按钮。
     */
    @NotNull
    private Widget createTitle() {
        return TextButton.builder()
                .text("§6§lItem Shop")
                .color("YELLOW")
                .slot(4)
                .build();
    }

    /**
     * 创建边框装饰。
     */
    @NotNull
    private List<Widget> createBorders() {
        List<Widget> borders = new ArrayList<>();
        ItemStack borderGlass = XVersionUtils.getColoredPlaneGlass(Colors.GRAY);

        // 顶部和底部边框
        for (int col = 0; col < 9; col++) {
            borders.add(ItemDisplay.builder(borderGlass)
                    .slot(col)
                    .build());
            borders.add(ItemDisplay.builder(borderGlass)
                    .slot(45 + col)
                    .build());
        }

        // 左右边框
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

    /**
     * 创建物品网格。
     */
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

    /**
     * 创建单个物品的 Widget。
     */
    @NotNull
    private Widget createItemWidget(@NotNull ShopItem item, int slot, boolean isSelected) {
        ItemStack display = item.getDisplay().clone();
        
        // 如果选中，增加光效或改变材质
        if (isSelected) {
            // 可以在这里添加选中效果
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

    /**
     * 创建分页控制按钮。
     */
    @NotNull
    private Widget createPaginationControls() {
        List<Widget> controls = new ArrayList<>();

        // 上一页按钮
        if (currentPage > 0) {
            controls.add(TextButton.builder()
                    .text("§a← Previous")
                    .color("GREEN")
                    .slot(45)
                    .onClick(this::goToPreviousPage)
                    .build());
        }

        // 页码指示器
        int totalPages = (int) Math.ceil((double) items.size() / ITEMS_PER_PAGE);
        controls.add(TextButton.builder()
                .text("§7Page §f" + (currentPage + 1) + "§7/§f" + totalPages)
                .color("GRAY")
                .slot(49)
                .build());

        // 下一页按钮
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

    /**
     * 创建选中项信息展示。
     */
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

    /**
     * 创建关闭按钮。
     */
    @NotNull
    private Widget createCloseButton() {
        return TextButton.builder()
                .text("§c§lClose")
                .color("RED")
                .slot(51)
                .onClick(() -> player.closeInventory())
                .build();
    }

    // ========== 业务逻辑 ==========

    /**
     * 获取当前页的物品。
     */
    @NotNull
    private List<ShopItem> getPageItems() {
        int start = currentPage * ITEMS_PER_PAGE;
        int end = Math.min(start + ITEMS_PER_PAGE, items.size());
        
        if (start >= items.size()) {
            return new ArrayList<>();
        }
        return items.subList(start, end);
    }

    /**
     * 计算物品槽位。
     */
    private int calculateItemSlot(int index) {
        int row = index / 7;  // 每行7个物品
        int col = index % 7;
        return SlotUtils.toSlotIndex(START_SLOT, row, col);
    }

    /**
     * 选中物品。
     */
    private void selectItem(int slot) {
        setState(() -> {
            selectedSlot = slot;
        });
    }

    /**
     * 获取当前选中的物品。
     */
    private ShopItem getSelectedItem() {
        if (selectedSlot < 0) {
            return null;
        }
        
        // 计算在 items 列表中的索引
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

    /**
     * 购买选中的物品。
     */
    private void buySelectedItem() {
        ShopItem selected = getSelectedItem();
        if (selected == null) {
            return;
        }

        // 这里添加实际的购买逻辑
        // 检查金钱、扣除金钱、给予物品等
        player.sendMessage("§aYou bought §f" + selected.getName() + " §afor §6$" + selected.getPrice());
        
        // 购买后取消选中
        setState(() -> {
            selectedSlot = -1;
        });
    }

    /**
     * 前往上一页。
     */
    private void goToPreviousPage() {
        if (currentPage > 0) {
            setState(() -> {
                currentPage--;
                selectedSlot = -1;  // 切换页面时取消选中
            });
        }
    }

    /**
     * 前往下一页。
     */
    private void goToNextPage() {
        int totalPages = (int) Math.ceil((double) items.size() / ITEMS_PER_PAGE);
        if (currentPage < totalPages - 1) {
            setState(() -> {
                currentPage++;
                selectedSlot = -1;  // 切换页面时取消选中
            });
        }
    }

    // ========== 生命周期钩子 ==========

    @Override
    protected void onGuiOpen(@NotNull InventoryOpenEvent event) {
        player.sendMessage("§aWelcome to the shop!");
    }

    @Override
    protected void onGuiClose(@NotNull InventoryCloseEvent event) {
        // 清理工作
    }

    @Override
    protected boolean onGuiClick(@NotNull InventoryClickEvent event) {
        // 额外的点击处理（如果需要）
        return true;  // 取消默认行为，防止物品被取出
    }
}
```