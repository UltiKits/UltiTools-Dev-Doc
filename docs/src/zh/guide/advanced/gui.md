# GUI 界面系统

UltiTools-API 7.0 移除了 6.x 的命令式箱子页面，不提供兼容桥，也不再捆绑 obliviate-invs。请按下表迁移，并针对 7.0 重新构建模块。6.x 的类结构和用法见 [v6.5.0 归档指南](/zh/v6.5.0/guide/advanced/gui.html)。

## 7.0 中的替代方案 <Badge type="tip" text="v7.0.0+" />

| 7.0 中已删除 | 改用 | 文档 |
|---|---|---|
| `BaseInventoryPage` | `DeclarativeGui`：在 `build(BuildContext)` 中返回由 `Container`、`TextButton`、`ItemDisplay` 组成的组件树 | [声明式 GUI](/zh/guide/advanced/declarative-gui) |
| `BasePaginationPage` | 在 `State` 中保存页码，用 `GridView` 构建当前页切片，用 `setState` 翻页 | [声明式 GUI](/zh/guide/advanced/declarative-gui) |
| `BaseConfirmationPage`、`Confirm.gui(...)` | 界面服务的 `Confirm`（`com.ultikits.ultitools.ui.Confirm`），通过 `UiService#show` 显示 | [UI：意图与会话](/zh/guide/advanced/ui-service#notice-and-confirm) |
| `Confirm.chat(...)`（`ChatConfirm`） | 框架不再提供；由模块自行发送可点击的聊天提示 | [UI：意图与会话](/zh/guide/advanced/ui-service#chat-confirmation) |
| `Buttons`、`ViewType` | 没有替代类型；使用 `TextButton` 的标签或框架标签键 | [对话框按钮](/zh/guide/advanced/ui-service#dialog-buttons) |
| obliviate-invs、UniversalScheduler | 不再随框架打包；见[旧箱子页面与确认组件](/zh/guide/advanced/upgrading-to-7#chest-and-confirmation) | |

## 颜色

`com.ultikits.ultitools.entities.Colors` 枚举仍可用于选择按钮或装饰的玻璃板颜色。框架内置 GUI 的玻璃颜色和按钮材质保持不变。

::: warning v7.0.0 颜色 API 变更
`Colors#getCode()` 和 `XVersionUtils` 已移除。使用 `Colors#getGlassPaneMaterial()` 取得 Bukkit `Material`，或直接使用 `Material.CYAN_STAINED_GLASS_PANE`。
:::

```java
ItemStack glass = new ItemStack(Colors.CYAN.getGlassPaneMaterial());
```

完整迁移说明见 [7.0 原生物品与音效 API](/zh/guide/advanced/upgrading-to-7#items-and-sounds)。
