::: tip 🐌 本页更新速度较慢
文章内容不一定是最新的，你可以前往 [Javadoc 文档](https://doc.dev.ultikits.com/javadoc) 来查看最新的内容
:::

::: danger Removed in v6.3.0
`VersionWrapper`, `DefaultVersionWrapper`, and `UltiTools#getVersionWrapper()` were deleted outright in v6.3.0.
None of them exist in the jar; this page is kept only as a historical record.
Use `XVersionUtils`'s static methods instead — every method below already delegated to one.
:::

# 接口 `VersionWrapper`

包 `com.ultikits.ultitools.interfaces`

这个接口提供了一些列跨版本支持的 Bukkit API 调用，如果你需要调用它，请通过 `UltiTools#getVersionWrapper` 获取实例。

> 作者: wisdomme, qianmo
> 
> 自 5.0.0 可用

public interface **VersionWrapper**

## 方法概要
:::tip 提示
**点击方法转跳至相应的详细信息**
:::
:::tabs
== 所有方法
| 方法 | 修饰符 | 类型 | 说明 |
|------|--------|------|------|
| [`getColoredPlaneGlass(Colors plane)`](#getColoredPlaneGlass) | - | `ItemStack` | 获取不同颜色的玻璃板 |
| [`getSign()`](#getSign) | - | `ItemStack` | 获取告示牌 |
| [`getEndEye()`](#getEndEye) | - | `ItemStack` | 获取末影之眼 |
| [`getEmailMaterial(boolean isRead)`](#getEmailMaterial) | - | `ItemStack` | 获取邮件材质 |
| [`getHead(OfflinePlayer player)`](#getHead) | - | `ItemStack` | 获取玩家头颅 |
| [`getGrassBlock()`](#getGrassBlock) | - | `ItemStack` | 获取草方块 |
| [`registerNewObjective(Scoreboard scoreboard, String name, String criteria, String displayName)`](#registerNewObjective) | - | `Objective` | 注册计分板对象 |
| [`getSound(Sounds sound)`](#getSound) | - | `Sound` | 获取声音 |
| [`getBed(Colors bedColor)`](#getBed) | - | `ItemStack` | 获取床 |
| [`getItemDurability(ItemStack itemStack)`](#getItemDurability) | - | `int` | 获取物品耐久度 |
| [`getItemInHand(Player player, boolean isMainHand)`](#getItemInHand) | - | `ItemStack` | 获取玩家手中的物品 |
| [`sendActionBar(Player player, String message)`](#sendActionBar) | - | `void` | 给玩家发送 Action Bar |
| [`sendPlayerList(Player player, String header, String footer)`](#sendPlayerList) | - | `void` | 设置玩家头部显示 |
| [`getBlockFace(Block placedBlock)`](#getBlockFace) | - | `BlockFace` | 获取方块面向 |
== 实例方法
| 方法 | 修饰符 | 类型 | 说明 |
|------|--------|------|------|
| [`getColoredPlaneGlass(Colors plane)`](#getColoredPlaneGlass) | - | `ItemStack` | 获取不同颜色的玻璃板 |
| [`getSign()`](#getSign) | - | `ItemStack` | 获取告示牌 |
| [`getEndEye()`](#getEndEye) | - | `ItemStack` | 获取末影之眼 |
| [`getEmailMaterial(boolean isRead)`](#getEmailMaterial) | - | `ItemStack` | 获取邮件材质 |
| [`getHead(OfflinePlayer player)`](#getHead) | - | `ItemStack` | 获取玩家头颅 |
| [`getGrassBlock()`](#getGrassBlock) | - | `ItemStack` | 获取草方块 |
| [`registerNewObjective(Scoreboard scoreboard, String name, String criteria, String displayName)`](#registerNewObjective) | - | `Objective` | 注册计分板对象 |
| [`getSound(Sounds sound)`](#getSound) | - | `Sound` | 获取声音 |
| [`getBed(Colors bedColor)`](#getBed) | - | `ItemStack` | 获取床 |
| [`getItemDurability(ItemStack itemStack)`](#getItemDurability) | - | `int` | 获取物品耐久度 |
| [`getItemInHand(Player player, boolean isMainHand)`](#getItemInHand) | - | `ItemStack` | 获取玩家手中的物品 |
| [`sendActionBar(Player player, String message)`](#sendActionBar) | - | `void` | 给玩家发送 Action Bar |
| [`sendPlayerList(Player player, String header, String footer)`](#sendPlayerList) | - | `void` | 设置玩家头部显示 |
| [`getBlockFace(Block placedBlock)`](#getBlockFace) | - | `BlockFace` | 获取方块面向 |
== 抽象方法
| 方法 | 修饰符 | 类型 | 说明 |
|------|--------|------|------|
| [`getColoredPlaneGlass(Colors plane)`](#getColoredPlaneGlass) | - | `ItemStack` | 获取不同颜色的玻璃板 |
| [`getSign()`](#getSign) | - | `ItemStack` | 获取告示牌 |
| [`getEndEye()`](#getEndEye) | - | `ItemStack` | 获取末影之眼 |
| [`getEmailMaterial(boolean isRead)`](#getEmailMaterial) | - | `ItemStack` | 获取邮件材质 |
| [`getHead(OfflinePlayer player)`](#getHead) | - | `ItemStack` | 获取玩家头颅 |
| [`getGrassBlock()`](#getGrassBlock) | - | `ItemStack` | 获取草方块 |
| [`registerNewObjective(Scoreboard scoreboard, String name, String criteria, String displayName)`](#registerNewObjective) | - | `Objective` | 注册计分板对象 |
| [`getSound(Sounds sound)`](#getSound) | - | `Sound` | 获取声音 |
| [`getBed(Colors bedColor)`](#getBed) | - | `ItemStack` | 获取床 |
| [`getItemDurability(ItemStack itemStack)`](#getItemDurability) | - | `int` | 获取物品耐久度 |
| [`getItemInHand(Player player, boolean isMainHand)`](#getItemInHand) | - | `ItemStack` | 获取玩家手中的物品 |
| [`sendActionBar(Player player, String message)`](#sendActionBar) | - | `void` | 给玩家发送 Action Bar |
| [`sendPlayerList(Player player, String header, String footer)`](#sendPlayerList) | - | `void` | 设置玩家头部显示 |
| [`getBlockFace(Block placedBlock)`](#getBlockFace) | - | `BlockFace` | 获取方块面向 |
== 已过时的方法
<center><strong>该接口的所有方法均已过时。请使用 <code>XVersionUtils</code> 的静态方法代替。</strong></center>
:::

## 方法详细信息

:::info <span id="getColoredPlaneGlass">getColoredPlaneGlass</span>
`org.bukkit.inventory.ItemStack getColoredPlaneGlass(Colors plane)`

获取不同颜色的玻璃板

**参数**
- plane - 颜色

**返回**
- 玻璃板
:::

:::info <span id="getSign">getSign</span>
`org.bukkit.inventory.ItemStack getSign()`

获取告示牌

**返回**
- 告示牌
:::

:::info <span id="getEndEye">getEndEye</span>
`org.bukkit.inventory.ItemStack getEndEye()`

获取末影之眼

**返回**
- 末影之眼
:::

:::info <span id="getEmailMaterial">getEmailMaterial</span>
`org.bukkit.inventory.ItemStack getEmailMaterial(boolean isRead)`

获取末影之眼

**参数**
- isRead - 是否已读

**返回**
- 邮件材质
:::

:::info <span id="getHead">getHead</span>
`org.bukkit.inventory.ItemStack getHead(org.bukkit.OfflinePlayer player)`

获取玩家头颅

**参数**
- player - 玩家

**返回**
- 玩家头颅
:::

:::info <span id="getGrassBlock">getGrassBlock</span>
`org.bukkit.inventory.ItemStack getGrassBlock()`

获取草方块

**返回**
- 草方块
:::

:::info <span id="registerNewObjective">registerNewObjective</span>
`org.bukkit.scoreboard.Objective registerNewObjective(
org.bukkit.scoreboard.Scoreboard scoreboard,
java.lang.String name,
java.lang.String criteria,
java.lang.String displayName
)`

注册计分板对象

**参数**
- scoreboard - 计分板
- name - 名称
- criteria - 种类
- displayName - 名称

**返回**
- 计分板对象
:::

:::info <span id="getBed">getBed</span>
`org.bukkit.inventory.ItemStack getBed(Colors bedColor)`

获取床

**参数**
- bedColor - 颜色

**返回**
- 床
:::

:::info <span id="getSound">getSound</span>
`org.bukkit.Sound getSound(Sounds sound)`

获取声音

**参数**
- sound - 声音

**返回**
- 声音
:::

:::info <span id="getItemDurability">getItemDurability</span>
`int getItemDurability(org.bukkit.inventory.ItemStack itemStack)`

获取物品耐久度

**参数**
- itemStack - 物品

**返回**
- 耐久度
:::

:::info <span id="getItemInHand">getItemInHand</span>
`org.bukkit.inventory.ItemStack getItemInHand(org.bukkit.entity.Player player, boolean isMainHand)`

获取玩家手中的物品

**参数**
- player - 玩家
- isMainHand - 主手还是副手

**返回**
- 物品
:::

:::info <span id="sendActionBar">sendActionBar</span>
`void sendActionBar(org.bukkit.entity.Player player, java.lang.String message)`

给玩家发送 Action Bar 消息

**参数**
- player - 玩家
- message - 消息
:::

:::info <span id="sendPlayerList">sendPlayerList</span>
`void sendPlayerList(org.bukkit.entity.Player player, java.lang.String header, java.lang.String footer)`

设置玩家头部显示

**参数**
- player - 玩家
- header - 标头
- footer - 标尾
:::

:::info <span id="getBlockFace">getBlockFace</span>
`org.bukkit.block.BlockFace getBlockFace(org.bukkit.block.Block placedBlock)`

获取方块面向

**参数**
- placedBlock - 方块

**返回**
- 方块面向
:::