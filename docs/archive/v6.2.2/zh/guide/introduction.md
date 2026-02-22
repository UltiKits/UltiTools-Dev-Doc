---
footer: false
---

# 简介

## 什么是UltiTools?

UltiTools是一款发布于2020年6月的MC服务器基础插件，拥有诸多基础及特色功能，并且注重每个用户的反馈。

致力于让更多服主轻松上手服务器的搭建，减少语言不通、插件不兼容等问题带来的烦恼。

## 特点

* 高兼容：兼容 Paper 1.21+（需要 Java 21）

* 高度GUI：大部分功能都有图形化用户界面，便于玩家操作

* 高度自定义：UltiTools通过模块来拓展自身的功能，可以根据自身情况搭配任意模块，并且可以自定义消息文本

* 配置完善：默认配置可直接作为基础配置使用，满足新手的开服需求，当然，一切均可自定义

* 持续维护：您的任何问题和建议都可以通过Github的Issues或者QQ群提交和反馈，作者会及时根据玩家的反馈和意见进行bug修复和新功能的更新

* 功能丰富：UltiTools几乎涵盖了服务器所需的所有基础功能，同时包含了GUI登录，邮件系统等特色功能

* 性能优化：插件的各方面都进行了优化，在实现丰富功能的同时保障了流畅的体验

## 为什么选择使用UltiTools API进行插件开发?

UltiTools API是UltiTools的核心，UltiTools API提供了一套完整的API，可以让您轻松开发出功能丰富的插件。

UltiTools API打包了常用的库，包括Adventure、obliviate-invs、CGLIB、HikariCP等，并提供了类 Spring 的 IoC 容器（`SimpleContainer`），支持注解驱动的依赖注入。您可以在开发中直接使用这些库而无需担心插件的体量。

UltiTools API提供了一套完整的GUI API，您可以轻松地开发出GUI插件，而无需担心GUI的实现细节。

UltiTools API提供了高级的注解系统，您可以像开发Spring Boot应用一样开发UltiTools插件。（使用 UltiTools 自带的类 Spring IoC 容器）

UltiTools 还提供了一个maven插件，可以自动将编译后的插件放入文件夹和上传模块至UltiCloud，提升您开发插件的生活质量。

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
