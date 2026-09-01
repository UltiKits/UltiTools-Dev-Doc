# 弃用清单

<script setup>
import { data } from '../../../deprecations.data.mts'
</script>

本页列出 UltiTools-API 已弃用的每一个成员，数据来自框架自身的弃用登记表。每一行记录该成员被标记弃用的版本、计划移除的目标版本，以及移除已经落地后，它实际离开 API 的版本。

::: tip 本页更新速度较慢
本表反映的是本页最近一次同步时冻结的登记表快照。要看权威、实时的状态，请查阅 [Javadoc 文档](https://doc.dev.ultikits.com/javadoc)。
:::

<table>
  <thead>
    <tr>
      <th>符号</th>
      <th>状态</th>
      <th>起始版本</th>
      <th>目标移除版本</th>
      <th>实际移除版本</th>
      <th>替代方案</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="entry in data" :key="entry.key">
      <td><code>{{ entry.className }}{{ entry.memberName ? '#' + entry.memberName + '(...)' : '' }}</code></td>
      <td>{{ entry.status }}</td>
      <td>{{ entry.since }}</td>
      <td>{{ entry.removeIn || '—' }}</td>
      <td>{{ entry.removedIn || '—' }}</td>
      <td>{{ entry.replacement }}</td>
    </tr>
  </tbody>
</table>

## 如何读这张表

`状态` 只有三种取值。`DEPRECATED` 表示该成员带 `@Deprecated`，但没有计划移除，签名会为兼容性保留，替代方案说明了原因。`ANNOUNCED` 表示该成员带 `@Deprecated(forRemoval = true)` 且仍然存在，`目标移除版本` 记录它将在哪个版本消失。`REMOVED` 表示该成员已经从当前 API 中消失，`实际移除版本` 记录它是在哪个版本被移除的，过了那个版本这个类型或方法就不再存在。

`目标移除版本` 与 `实际移除版本` 可能与 `起始版本`相差不止一个发布周期。一个成员可能在某个版本被标记弃用，之后又保留了好几个发布周期，直到目标版本真正发布了那次移除。
