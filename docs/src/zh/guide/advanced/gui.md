# GUI 界面系统

<Badge type="tip" text="v6.2.0+" />

::: info 现代 GUI 系统
GUI 系统已使用 `BaseInventoryPage`、`BasePaginationPage` 和 `BaseConfirmationPage` 重建。这些类取代了早期版本中不推荐使用的 `PagingPage` 和 `OkCancelPage`。
:::

UltiTools 提供了基于 [obliviate-invs](https://github.com/hamza-cskn/obliviate-invs) 库的全面 GUI 系统。这个集成使您无需担心低级 Bukkit 背包管理，就能创建丰富、交互式的背包界面。

## 架构概述

GUI 系统建立在三个核心抽象类上：

| 类 | 用途 | 使用场景 |
|-----|------|---------|
| `BaseInventoryPage` | 所有 GUI 的基础 | 静态内容、信息显示 |
| `BasePaginationPage` | 自动分页列表 | 玩家列表、传送点、商店（带导航） |
| `BaseConfirmationPage` | 确定/取消对话框 | 删除操作、确认动作 |

所有类都扩展自 obliviate-invs 的 `Gui`，并使用**模板方法模式** — 通过重写特定方法来自定义行为，同时受益于内置的工具栏、槽位计算和导航功能。

## BaseInventoryPage

所有背包 GUI 的基础类。提供结构化的生命周期、工具栏管理和常见 UI 任务的辅助方法。

### 类结构

```java
public abstract class BaseInventoryPage extends Gui {
    // 接受 Player、ID、标题（字符串或 Component）的构造函数
    // 以及行数（int）或 InventoryType

    protected abstract void setupContent(InventoryOpenEvent event);
    protected void afterSetup(InventoryOpenEvent event) { }
    protected void setupBottomToolbar() { }
    protected Icon createBackgroundIcon() { }
    protected Icon createActionButton(Colors color, String name, Consumer<InventoryClickEvent> onClick) { }
    // ... 以及更多工具方法
}
```

### 生命周期

当玩家打开 GUI 时，会发生以下序列：

1. 调用 `onOpen(InventoryOpenEvent)`（final 方法）
2. 如果启用了 `showBottomToolbar`，`setupBottomToolbar()` 会用灰色玻璃填充最后一行
3. 调用 `setupContent(InventoryOpenEvent)`（抽象方法 — 您的实现）
4. 调用 `afterSetup(InventoryOpenEvent)`（后期设置钩子，可选）
5. GUI 显示给玩家

### 创建简单的信息面板

<<< @/../examples/src/main/java/com/ultikits/docs/gui/InfoGui.java

### 打开 GUI

<<< @/../examples/src/main/java/com/ultikits/docs/gui/InfoCommand.java

### 底部工具栏

默认情况下，最后一行保留给灰色玻璃背景的工具栏：

```java
// 禁用工具栏来使用整个背包
gui.setShowBottomToolbar(false);

// 或使用自定义背景颜色
@Override
protected Icon createBackgroundIcon() {
    ItemStack glass = XVersionUtils.getColoredPlaneGlass(Colors.BLUE);
    Icon icon = new Icon(glass);
    icon.setName(" ");
    return icon;
}
```

### 在工具栏中放置按钮

```java
@Override
protected void setupContent(InventoryOpenEvent event) {
    // 在底行放置按钮（列为 0-8）
    Icon closeButton = createActionButton(Colors.RED, "关闭", e -> {
        player.closeInventory();
    });
    addToBottomRow(0, closeButton);  // 最左边

    Icon refreshButton = createActionButton(Colors.GREEN, "刷新", e -> {
        refresh();
    });
    addToBottomRow(4, refreshButton);  // 中心

    Icon helpButton = createActionButton(Colors.YELLOW, "帮助", e -> {
        player.sendMessage("这是一条帮助消息");
    });
    addToBottomRow(8, helpButton);  // 最右边
}
```

### 辅助方法

```java
// 槽位计算
int lastRowStart = getSize() - 9;          // 最后一行的第一个槽位
int centerSlot = getBottomCenterSlot();    // 最后一行的中心
int slot = getSlotFromEnd(5);              // 从末尾开始的第 5 个槽位

// 内容区域
int[] contentSlots = getContentSlots();    // 排除工具栏的槽位（如果启用）

// 填充区域
fillRow(icon, rowIndex);                   // 填充整行
fillArea(icon, startSlot, endSlot);        // 填充矩形区域
fillBorder(icon);                          // 填充背包边框

// 链式调用
gui.setShowBottomToolbar(false)
   .onClose(e -> System.out.println("已关闭"))
   .open();
```

### 关闭处理器

```java
gui.onClose(event -> {
    player.sendMessage("GUI 已关闭！");
    // 清理、保存数据等
});
```

## BasePaginationPage

用于显示大型列表（玩家、传送点、商店），`BasePaginationPage` 自动处理分页与导航按钮。

### 类结构

```java
public abstract class BasePaginationPage extends BaseInventoryPage {
    protected abstract List<Icon> provideItems();

    protected Icon createPreviousButton() { /* ... */ }
    protected Icon createNextButton() { /* ... */ }

    public int getCurrentPage() { }
    public int getTotalPages() { }
    public boolean hasNextPage() { }
    public boolean hasPreviousPage() { }
    public void goToPage(int pageNumber) { }
}
```

### 自动导航

导航按钮放在底部工具栏的第 3 列（上一页）和第 5 列（下一页）：

```
[空] [空] [空] [< 上一页] [空] [下一页 >] [空] [空] [空]
     列 0  列 1  列 2    列 3   列 4   列 5    列 6  列 7   列 8
```

重写 `setupNavigationButtons()` 来自定义位置。在子类里重新声明 `PREV_BUTTON_COLUMN` / `NEXT_BUTTON_COLUMN` 常量不起作用，因为 Java 按声明类型而非运行时实例解析 `static` 字段，基类自己的 `setupNavigationButtons()` 永远读的是基类的常量：

```java
// 写在你的 BasePaginationPage 子类里
@Override
protected void setupNavigationButtons() {
    addToBottomRow(0, createPreviousButton());  // 最左边
    addToBottomRow(8, createNextButton());       // 最右边
}
```

### 创建分页玩家列表

<<< @/../examples/src/main/java/com/ultikits/docs/gui/PlayerListGui.java

### 分页方法

```java
// 获取当前状态
int currentPage = gui.getCurrentPage();      // 从 1 开始
int totalPages = gui.getTotalPages();
boolean hasNext = gui.hasNextPage();
boolean hasPrev = gui.hasPreviousPage();

// 导航
gui.goToPage(2);                             // 跳转到第 2 页

// 用新数据刷新
gui.refresh();                               // 用更新的项目重新打开 GUI
```

## BaseConfirmationPage

带有确定和取消按钮的确认对话框。

### 类结构

```java
public abstract class BaseConfirmationPage extends BaseInventoryPage {
    protected static final int CANCEL_BUTTON_COLUMN = 3;  // 左按钮
    protected static final int OK_BUTTON_COLUMN = 5;      // 右按钮

    protected abstract void onConfirm(InventoryClickEvent event);
    protected void onCancel(InventoryClickEvent event) { }

    protected void setupDialogContent(InventoryOpenEvent event) { }
    protected String getOkButtonName() { }
    protected String getCancelButtonName() { }

    public static Builder builder(Player player) { }
}
```

### 创建确认对话框（子类方法）

<<< @/../examples/src/main/java/com/ultikits/docs/gui/DeleteConfirmation.java

### 创建确认对话框（构建器模式）

对于简单的确认，使用流畅的 `Builder`：

```java
BaseConfirmationPage.builder(player)
    .id("confirm-warp-delete")
    .title("删除传送点？")
    .rows(3)
    .content(event -> {
        Icon icon = new Icon(Material.COMPASS);
        icon.setName("删除传送点？");
        // 使用 event.getInventory() 添加到背包
    })
    .onConfirm(event -> {
        player.sendMessage("传送点已删除");
        warpService.delete(warpId);
    })
    .onCancel(event -> {
        player.sendMessage("已取消");
    })
    .okButton("删除")
    .cancelButton("保留")
    .open();
```

## 颜色

UltiTools 提供 `Colors` 枚举用于创建彩色玻璃按钮和装饰：

```java
public enum Colors {
    WHITE, ORANGE, MAGENTA, LIGHT_BLUE, YELLOW, LIME, PINK, GRAY,
    LIGHT_GRAY, CYAN, PURPLE, BLUE, BROWN, GREEN, RED, BLACK
}
```

用法：

```java
Icon greenButton = createActionButton(Colors.GREEN, "接受", clickHandler);
Icon redButton = createActionButton(Colors.RED, "拒绝", clickHandler);
Icon blueButton = createActionButton(Colors.BLUE, "信息", clickHandler);

// 直接获取 ItemStack
ItemStack glass = XVersionUtils.getColoredPlaneGlass(Colors.CYAN);
```

## 完整示例：传送点系统 GUI

以下是结合分页和自定义操作的完整示例：

<<< @/../examples/src/main/java/com/ultikits/docs/gui/WarpListGui.java

## 高级：自定义按钮样式

重写按钮创建方法来自定义外观：

<<< @/../examples/src/main/java/com/ultikits/docs/gui/CustomPaginationGui.java

## 弃用的 API

::: warning 弃用的类
`PagingPage` 和 `OkCancelPage` 不再维护。请迁移到新类：

| 旧类 | 新类 |
|------|------|
| `PagingPage` | `BasePaginationPage` |
| `OkCancelPage` | `BaseConfirmationPage` |
| 自定义基类 | `BaseInventoryPage` |

新 API 提供更好的结构、测试支持和与 v6.2.0 框架其他部分的一致性。
:::

## 提示与最佳实践

### 响应式设计

在不同分辨率的服务器上保持背包布局的一致性：

```java
// 始终使用 getBottomCenterSlot() 和 getSlotFromEnd() 来定位
// 而不是硬编码槽位号
Icon button = createActionButton(...);
addToBottomRow(4, button);  // 中心列；适用于任何背包大小
```

### 性能

对于大型列表，通过使用分页来限制每页的项目数：

```java
// 好: 分页（5 行 GUI 每页 36 项）
new PlayerListGui(player).open();

// 避免: 一次加载数千项
List<Icon> allItems = new ArrayList<>();
for (int i = 0; i < 5000; i++) {
    allItems.add(...);
}
```

### 内存

显式关闭 GUI 并清理引用：

```java
gui.onClose(event -> {
    // 清理任何缓存数据
    cache.clear();
    // 如有任何监听器，取消注册
});
```

### 测试

使用 `BaseInventoryPageTest` 中的测试模式：

```java
@Test
void testGuiCreation() {
    TestGui gui = new TestGui(mockPlayer);
    assertEquals(27, gui.getSize());  // 3 行
}
```

## 参考资源

- [obliviate-invs Wiki](https://github.com/hamza-cskn/obliviate-invs/wiki)
- [Bukkit 背包事件](https://hub.spigotmc.org/javadocs/spigot/org/bukkit/event/inventory/package-summary.html)
- [Adventure 文本 API](https://docs.advntr.dev/)
- [UltiTools v6.2.0 框架指南](/zh/guide/introduction)
