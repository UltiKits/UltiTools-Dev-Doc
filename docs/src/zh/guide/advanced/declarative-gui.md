# 声明式 GUI

::: warning 实验性功能，v6.2.5 存在已知缺口
已打开的界面会保持打开时构建出的组件树：`DeclarativeGui.setState` 会调度一次构建但不标记任何 Element 为脏，`State.setState` 标脏但不调度构建，第 4 节列出的若干 builder 方法只把值存进字段，渲染路径上没有读取方。
把状态放在 `DeclarativeGui` 子类自己的字段里直接修改，并在下一 tick 关闭后重新打开同一个实例：`onClose` 会释放渲染器并把 `initialized` 置回 false，下一次 `onOpen` 会重新执行 `build(BuildContext)`。
三处渲染接缝跟踪于 [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200)，其它问题仍然欢迎通过 GitHub Issue 反馈。
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

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/MyFirstGui.java

```java
// 打开 GUI
new MyFirstGui(player).open();
```

## 4. 常用组件详解 (Widget Reference)

### 4.1 Container (容器)
::: warning 背景图标被保存但不参与渲染
`.background(...)` 把 `IconWrapper` 存进一个只有 `getBackground()` 读取的字段，而渲染路径上没有任何代码调用这个 getter，容器覆盖的槽位保持为空。
为每个需要填充的槽位加一个指定 `slot` 的 `ItemDisplay` 子组件，复用同一个 `ItemStack`（例如灰色玻璃板）：这相当于把背景展开成显式子节点。
把这些只存不渲染的 builder 方法补上实现或删除的工作跟踪于 [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200)。
:::

最基础的容器组件，用于包裹其他组件，并可以设置背景。

```java
Container.builder()
    .background(IconWrapper.builder(new ItemStack(Material.GRAY_STAINED_GLASS_PANE)).name(" ").build()) // 设置背景
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
::: warning 槽位只由 startSlot 与 columns 计算
`.rows(...)` 写入的是 `maxRows`，它唯一的读取方 `getMaxRows()` 无人调用，而 `Builder.calculateSlot(int)` 只用 `startSlot` 与 `columns` 推算每个位置，因此更长的列表会继续往下排，不在你设定的行数处截断。
在传给 `.items(...)` 之前先把列表截断到 `rows * columns` 条：行数上限由你自己的代码执行。
把这些只存不渲染的 builder 方法补上实现或删除的工作跟踪于 [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200)。
:::

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

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/CounterWidget.java

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/CounterState.java

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
::: warning 路由改变的是 history，不是界面
`push(String)` 通过 `setState` 生效，只标脏而不调度构建，因此路由被压进了 history，界面仍停在原页面；`Navigator.of(context)` 另外带有 `@Nullable`，当前 Element 上方没有 `Navigator` 时返回 null，链式调用会当场抛出 `NullPointerException`。
把当前路由放在 `DeclarativeGui` 子类的字段里，在 `build(BuildContext)` 中按它切换子树，并按页首那条说明重开界面；若坚持使用 `Navigator.of(context)`，先判空再调用。
导航接缝跟踪于 [issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200)。
:::

框架提供了 `Navigator` 组件用于在同一个 GUI 窗口内切换“页面”（实际上是切换 Widget 树）。

```java
// 在根 build 方法中
Map<String, RouteBuilder> routes = new HashMap<>();
routes.put("home", (context) -> new HomePageWidget());
routes.put("settings", (context) -> new SettingsPageWidget());
return new Navigator("home", routes);

// 在子组件中跳转
Navigator.of(context).push("settings");
```

### 6.3 性能优化
*   **避免在 build 中做耗时操作**: `build` 方法可能会被频繁调用（每秒多次），不要在里面读写数据库或进行复杂计算。
*   **提取常量 Widget**: 如果一个组件（如背景板）永远不会变，可以将其定义为 `static final` 字段，直接复用。
*   **局部刷新**: 尽量将状态下沉到叶子节点。例如，只有一个按钮需要变色，就只把那个按钮做成 `StatefulWidget`，而不是刷新整个页面。

---

## 7. 完整示例：商店页面

本示例中的分页、单选与购买按钮行为，受本页开头那条状态限制的影响。

1.  **布局**: 使用 `Container` + `GridView`。
2.  **分页**: 使用 `currentPage` 状态控制数据切片。
3.  **单选**: 使用 `selectedSlot` 状态控制高亮显示。
4.  **交互**: 购买按钮根据选中状态动态显示/隐藏。

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/ExampleShopPage.java