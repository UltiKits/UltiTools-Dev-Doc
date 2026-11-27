---
footer: false
---

# 简介

7.0.0 尚未发布。本指南介绍 UltiTools-API 7.0，版本变更见[7.0.0 更新说明](/zh/guide/release-notes/7.0.0)。

## 什么是 UltiTools？

UltiTools 是一个 Paper 插件，负责加载模块，并提供模块使用的 API。UltiTools 模块有自己的 JAR 和生命周期，由 UltiTools 加载，而不是由 Paper 作为独立插件加载。本指南面向模块开发；如果你已有一个独立的 Paper 插件，请参阅[外部插件 API](/zh/guide/advanced/external-plugin-api)。

## 运行环境

自 v7.0.0 起，框架的目标环境为 Paper 26.3（build 258）和 Java 25。不支持更早的 Paper 版本或普通 Spigot。构建 7.0 模块需要 JDK 25 和 Maven，模块模板使用 `--release 25` 编译。

自 v7.0.0 起，已有模块须针对 UltiTools-API 7.0 和目标 Paper 重新构建。模块 JAR 根目录的 `plugin.yml` 必须声明整数 `api-version`，取值范围为 `700` 至运行中的框架 API 级别，含两端。只改这个字段不能让旧 JAR 兼容。迁移模块时，请参阅[升级指南](/zh/guide/advanced/upgrading-to-7)。

## 模块 API

UltiTools 提供[依赖注入](/zh/guide/advanced/ioc-container)、[配置](/zh/guide/essentials/config-file)和[数据存储](/zh/guide/essentials/data-storage)。自 v7.0.0 起，注解式[命令](/zh/guide/essentials/cmd-executor)通过 Paper 注册为 Brigadier 命令树，模块通过 [`Messages`](/zh/guide/essentials/messages) 使用 `messages/<locale>.yml` 语言文件发送译文。

参阅[快速开始](/zh/guide/quick-start)，构建一个模块，将它安装到服务器并运行它的第一个命令。

## 6.x 文档

如果你仍在使用 6.x，请参阅[归档的 v6.4.0 简介](/zh/v6.4.0/guide/introduction.html)和[旧服务器指南](/zh/guide/advanced/older-servers)。这些兼容说明不适用于 7.0。

## 鸣谢列表

<script setup>
import { VPTeamMembers } from 'vitepress/theme';

const members = [
  {
    avatar: 'https://www.github.com/wisdommen.png',
    name: 'wisdommen',
    title: 'Creator',
    links: [
      { icon: 'github', link: 'https://github.com/wisdommen' }
    ]
  },
  {
    avatar: 'https://www.github.com/qianmo2233.png',
    name: 'QianMo SAMA',
    title: 'Main Developer',
    links: [
      { icon: 'github', link: 'https://github.com/qianmo2233' }
    ]
  },
  {
    avatar: 'https://www.github.com/JueChenChen.png',
    name: 'Jue Chen',
    title: 'Main Tester',
    links: [
      { icon: 'github', link: 'https://github.com/JueChenChen' }
    ]
  },
  {
    avatar: 'https://www.github.com/Shpries.png',
    name: 'Shpries',
    title: 'Developer',
    links: [
      { icon: 'github', link: 'https://github.com/Shpries.png' }
    ]
  },
]
</script>

<VPTeamMembers size="small" :members="members" />
