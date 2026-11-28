---
footer: false
---

# Introduction

This guide describes UltiTools-API 7.0. See the [7.0.0 release notes](/guide/release-notes/7.0.0) for changes.

## What is UltiTools?

UltiTools is a Paper plugin that loads modules and provides the APIs they use. An UltiTools module has its own JAR and lifecycle, but UltiTools loads it rather than Paper loading it as a standalone plugin. This guide covers modules. If you already maintain a standalone Paper plugin, see the [External Plugin API](/guide/advanced/external-plugin-api) instead.

## Runtime Requirements

As of v7.0.0, the framework targets Paper 26.3 (build 258) with Java 25. Older Paper versions and plain Spigot are not supported targets. To build a 7.0 module, use JDK 25 and Maven; the module template compiles with `--release 25`.

As of v7.0.0, rebuild existing modules against UltiTools-API 7.0 and the target Paper. The module JAR's root `plugin.yml` must declare an integer `api-version` from `700` through the running framework's API level, inclusive. Editing that field alone does not make an old JAR compatible. See the [upgrade guide](/guide/advanced/upgrading-to-7) if you are migrating a module.

## Module APIs

UltiTools provides [dependency injection](/guide/advanced/ioc-container), [configuration](/guide/essentials/config-file) and [data storage](/guide/essentials/data-storage). As of v7.0.0, annotation-based [commands](/guide/essentials/cmd-executor) register through Paper as Brigadier command trees, and modules send translated text using [`Messages`](/guide/essentials/messages) with `messages/<locale>.yml` catalogues.

Start with [Quick Start](/guide/quick-start) to build a module, install it on a server and run its first command.

## 6.x Documentation

If you are working with 6.x, see the [archived v6.5.0 introduction](/v6.5.0/guide/introduction.html) and the [older-server archive note](/guide/advanced/older-servers). That compatibility guidance does not apply to 7.0.

## The Team

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
