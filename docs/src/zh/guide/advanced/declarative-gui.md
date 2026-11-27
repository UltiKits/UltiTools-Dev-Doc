# 声明式 GUI

::: warning 实验性功能——渲染接缝已在 v6.3.0 修复
[issue #200](https://github.com/UltiKits/UltiTools-Reborn/issues/200) 跟踪的重绘、点击派发与 `GridView` 定位三处接缝，已在 v6.3.0 修复：`build(BuildContext)` 现在会在每次状态变化时重新执行，点击 GUI 自己物品栏之外的位置无法触发处理器，任意 widget 类型都能在 `GridView` 内正确定位。
`@ApiStatus.Experimental` 标记至少还会保留一个版本，等待运行这些被重写机制的真实服务器给出反馈。
:::

## 7.0 的变化 <Badge type="tip" text="v7.0.0+" />

::: info 自 v7.0.0 起（尚未发布）
声明式引擎不再继承 obliviate 的 `Gui`，也不再直接写入物品栏。每次构建都会产生整个界面的不可变 `Grid` 快照，并交给模块的 `UiService`，由它负责显示、点击分发和关闭结果。该包仍标记为 `@ApiStatus.Experimental`。
:::

自 v7.0.0 起声明式引擎也是框架唯一的箱子界面 API：`BaseInventoryPage`、`BasePaginationPage` 和 `BaseConfirmationPage` 已删除。分页用保存页码的 `State` 加显示当前切片的 `GridView` 完成；确认改用[界面服务](/zh/guide/advanced/ui-service#notice-and-confirm)的 `Confirm`。旧页面作为 6.x 资料仍见 [GUI 界面系统](/zh/guide/advanced/gui)。

引擎目前只在内存版界面服务上验证过，尚未在真实服务器上验证。下面第 3 至 7 节的代码及其引用的已编译示例展示的是 6.x API；本节列出 7.0 的变化。

**构造。** 传入模块自己注入的 `UiService`、[`Scheduler`](/zh/guide/advanced/scheduled-tasks#调度器-api) 和 `Text` 标题；行数固定为 1 到 6，不再有 `InventoryType` 构造器：

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

**打开。** `open()` 同步构建第一帧，通过 `UiService` 显示，并返回 `GridSession`。它必须在观看者所属线程上调用，否则抛出 `IllegalStateException`；页面已打开时再次调用会返回同一个会话。标题和行数在构造后不能更改，要改标题请打开新的页面实例。不要在同一个动作里关闭页面后立刻对同一页面调用 `open()`：它可能返回已结束的会话而什么也不显示。

**组件。** `ItemDisplay.builder` 接收 `ItemSpec`（见[物品与物品存储](/zh/guide/essentials/items)）；`TextButton` 的名称和说明使用 `Text`。`onClick(GridAction)` 收到 `GridClick`（观看者、槽位、点击类型和会话），`onClick(Runnable)` 仍可用。`IconWrapper`、`RenderNodeDiffer`、`DiffResult` 已删除，`getPlayer()` 改为 `viewer()`。旧的打开、点击和物品栏关闭钩子，改为在 `build` 中描述内容、把动作放在组件上，以及 `onGuiClose(UiResult<Ack>)`。新增的 `ItemSlotArea` 把已有容器的下标绑定到网格：默认只读（`VIEW`），允许移动物品必须显式 `.mode(BindingMode.EDITABLE)`。

**重新渲染。** `setState(Runnable)` 先在调用线程上立即执行你的动作，然后请求重建。重建总是在之后的某个 tick、在观看者的实体上下文中执行；重建执行前到达的多个请求合并为一帧，构建过程中发出的请求在构建结束后补发，不会重入。一帧中排入的工作在下一帧执行。构建成功后，引擎把完整网格发给会话，由后端决定改写哪些槽位。来自后台线程的结果，请先用 `scheduler.entity(player).run(...)` 切回观看者线程，再修改状态。

**错误处理。** 构建抛出异常时不会到达会话，观看者仍看到上一幅画面。延迟帧中的异常以 WARNING 记录（`Error executing GUI frame task`）；JVM `Error` 以 SEVERE 记录并重新抛出。组件树嵌套超过 64 层会抛出 `RenderDepthExceededException`，并同时上报给错误收集器。槽位在网格之外的节点会被跳过，重复占用同一容器下标的节点会被跳过；第二个占用同一槽位的节点会替换第一个；每种情况每个槽位只记录一次警告。`initState` 不断请求重建又抛出异常的页面，只要还开着就每 tick 重试一次；请在组件内捕获失败并构建错误状态。会话结束时，引擎先释放组件树再调用 `onGuiClose`；两者中的异常都会以 WARNING 记录，并写明界面和模块名。

## 1. 简介 (Introduction)

传统的 Bukkit GUI 开发通常是命令式的：你需要手动创建 `Inventory`，手动设置每一个 `ItemStack`，并监听 `InventoryClickEvent` 来处理交互。随着界面复杂度的增加，这种方式会导致代码难以维护，状态管理变得异常痛苦。

UltiTools 的声明式 GUI 框架引入了 **UI = f(State)** 的理念：
*   **声明式 (Declarative)**: 你只需要描述“当前状态下界面应该长什么样”，框架会自动处理如何从旧界面过渡到新界面。
*   **组件化 (Component-Based)**: 界面由一个个独立的 **Widget** 组合而成，易于复用和维护。
*   **响应式 (Reactive)**: 当数据（状态）发生变化时，界面会自动更新。

### 核心优势
*   **自动更新**: 你不需要自己写格子。6.x 及以前，框架对组件树做 Diff，只更新发生变化的 Slot。自 v7.0.0 起，引擎发送完整的网格快照，由界面后端决定重写哪些 Slot。
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
::: tip 用显式子组件填充背景 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，`Container.Builder` 不再有 `background(...)` 方法——它在 v6.2.5 中写入的字段从未被渲染路径读取过，v6.3.0 因此直接删除它，而不是让它继续静默失效。
为每个需要填充的槽位加一个指定 `slot` 的 `ItemDisplay` 子组件，复用同一个 `ItemStack`（例如灰色玻璃板）。
:::

最基础的容器组件，用于包裹其他组件。

```java
Container.builder()
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
::: tip 任意 widget 类型都能正确定位 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，`GridView` 会在渲染时把每个子组件计算出的槽位作为父数据写入，因此任意 widget 类型——不只是 `ItemDisplay`——都能自动定位到自己的行列槽位；`Widget` 自身的 API 未变，下游自定义 widget 不需要任何改动。
子组件在 `GridView` 内显式声明的 `.slot(...)` 会被覆盖，并发出一条 `WARNING`，写明该子组件的序号和前后两个槽位；没有显式槽位、或合法声明在槽位 `0` 的子组件，不会产生警告。
:::

非常适合用于展示列表数据（如商店商品、背包内容）。任意 widget 类型都会被自动计算行列位置并写入槽位。

```java
GridView.<ShopItem>builder()
    .startSlot(10) // 起始位置
    .columns(7)    // 每行几列
    .items(itemList, item -> {
        // 将数据对象映射为 Widget
        return ItemDisplay.builder(item.getStack())
            .name(item.getName())
            .onClick(() -> buy(item))
            .build();
    })
    .build();
```

::: tip GridView.Builder.rows(int) 已删除 <Badge type="tip" text="v6.3.0+" />
自 v6.3.0 起，`.rows(int)`/`getMaxRows()` 不再存在——它们写入的字段从未被任何代码读取过，v6.3.0 因此直接删除，而不是去实现一条没人要求的溢出规则。
需要限制行数时，在传给 `.items(...)` 之前，用你自己的代码把列表截断到想要的行数。
:::

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
6.  框架输出新的网格，其中只有 Slot 13 与上一幅不同（自 v7.0.0 起由界面后端而不是引擎比较网格）。

## 6. 进阶技巧 (Advanced Topics)

### 6.1 SlotKey 的重要性
在渲染动态列表（如 `GridView`）时，给每个 Item 设置一个唯一的 Key 是至关重要的。这有助于 Diff 算法正确识别“移动”操作，而不是“删除再创建”。

::: tip 现在真正能在重排序后保留状态 <Badge type="tip" text="v6.3.0+" />
v6.3.0 之前，`ContainerElement` 与 `GridViewElement` 只按列表位置配对子组件，`SlotKey` 因此不起作用，重排序一个带 key 的列表仍然会丢失每一项的 `State`。
自 v6.3.0 起，两个类都会优先按 `SlotKey` 做协调，只有没有 key 的子组件才回退到按位置配对。
:::

```java
ItemDisplay.builder(item)
    .key(SlotKey.of("item-" + item.getId())) // 唯一标识
    .build();
```

### 6.2 导航与路由 (Navigation)
::: tip 压入路由现在会立即重绘 <Badge type="tip" text="v6.3.0+" />
v6.3.0 之前，`push(String)` 通过 `setState` 生效，只会标脏而从不调度构建，因此路由被压进了 history，已打开的界面却仍停在原页面。
自 v6.3.0 起，每一次由 `setState` 触发的标脏都会到达一次已调度的重绘，压入路由会立即更新可见页面。
:::

::: warning Navigator.of(context) 可能返回 null
`Navigator.of(context)` 带有 `@Nullable`，当前 Element 上方没有 `Navigator` 时会返回 `null`，链式调用因此会抛出 `NullPointerException`。
调用 `.push(...)`/`.pop()`/`.pushReplacement(...)` 之前，先判断结果是否为 `null`。
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
*   **避免在 build 中做耗时操作**: `build` 方法可能会被频繁调用，不要在里面读写数据库或进行复杂计算。
*   **提取常量 Widget**: 如果一个组件（如背景板）永远不会变，可以将其定义为 `static final` 字段，直接复用。
*   **局部刷新**: 尽量将状态下沉到叶子节点。例如，只有一个按钮需要变色，就只把那个按钮做成 `StatefulWidget`，而不是刷新整个页面。

### 6.4 树深度上限

从 v6.3.0 起，如果一个 widget 树嵌套超过 64 层（`Container`/`GridView`/组合 widget 一起计数），框架会抛出 `RenderDepthExceededException`——这是针对失控递归构建助手的一个安全上限，不是任何手写 GUI 预期会触及的边界：本页的所有示例最多只嵌套 3–4 层。如果遇到这个异常，应该去检查一个没有终止条件的递归助手，而不是尝试把页面写得更深。

---

## 7. 完整示例：商店页面

1.  **布局**: 嵌套 `Container`，商品槽位用 `SlotUtils.toSlotIndex` 计算。
2.  **分页**: 使用 `currentPage` 状态控制数据切片。
3.  **单选**: 使用 `selectedSlot` 状态控制高亮显示。
4.  **交互**: 购买按钮根据选中状态动态显示/隐藏。

下列可编译示例面向已发布的 6.x API，其中的 `XVersionUtils.getColoredPlaneGlass(Colors.GRAY)` 调用仅适用于 6.x。自 v7.0.0 起，请改为 `new ItemStack(Material.GRAY_STAINED_GLASS_PANE)`；`Colors` 本身仍保留。详见 [7.0 原生物品与音效 API](/zh/guide/advanced/upgrading-to-7#items-and-sounds)。

<<< @/../examples/src/main/java/com/ultikits/docs/declarative/ExampleShopPage.java