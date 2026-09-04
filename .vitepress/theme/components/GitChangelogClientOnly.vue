<script setup lang="ts">
// 覆盖 @nolebase/vitepress-plugin-git-changelog 注册的全局同名组件，把它整块
// 移出服务端渲染。
//
// 为什么：那个组件的「最后编辑于 N 前」是相对时间——Changelog.vue 用
// formatDistanceToNowFromValue(lastChangeDate) 渲染，且该行没有任何开关
// （包内的 commitsRelativeTime 选项只管提交列表里的日期，不管这一行）。
// 服务端在**构建时**算一次写进 HTML，客户端在**浏览时**又算一次；两个时刻一
// 跨过人类可读单位的边界，文本节点就不同，Vue 报
// Hydration completed but contains mismatches.
//
// 实测（生产站，同一页两次加载，一次禁 JS 取服务端原样文本、一次允许 JS 取
// hydration 之后的文本）：
//   /guide/introduction        SSR "Last edited 6 minutes ago" → 客户端 "about 1 hour ago"，命中 1
//   /v6.2.1/guide/introduction SSR "Last edited 3 minutes ago" → 客户端 "4 minutes ago"，命中 1
//   /v6.3.0-SNAPSHOT/...       无 changelog 块（注入页无 git 历史）→ 命中 0
// 最后一行是对照组：唯一没有这个块的页面，也是唯一零命中的页面。
//
// 本地 npm run preview 测不出来，不是因为本地没有这个缺陷，而是因为本地产物那句
// 是「10 days ago」——构建到查看之间的几分钟里它不会变。部署站是构建后几分钟到
// 几小时被访问，「N 分钟前」已经走动了。
//
// 用 ClientOnly 而不是改成绝对日期：绝对日期走 toLocaleDateString()，服务端
// （构建容器，UTC）与客户端（读者本地时区）同样可能不同，只是换一个不确定来源。
// 不渲染就没有可对不上的东西。代价是页脚这一块在 hydration 之后才出现。
//
// 别名 import 是必须的：本组件会以 NolebaseGitChangelog 这个名字全局注册，
// 模板里若直接写原名会解析到全局注册的自己，变成无限递归。<script setup> 里的
// 局部绑定优先于全局组件，所以取别名即可。
import { NolebaseGitChangelog as NolebaseGitChangelogInner } from '@nolebase/vitepress-plugin-git-changelog/client'
</script>

<template>
  <ClientOnly>
    <NolebaseGitChangelogInner />
  </ClientOnly>
</template>
