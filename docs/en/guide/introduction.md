---
footer: false
---

# Introduction

## What is UltiTools?

UltiTools is a basic plugin for Minecraft servers, which was released in June 2020. It has many basic and special functions, and cares about the feedback of each user.

It is committed to making more server owners build servers easily, reducing the troubles caused by incompatible plugins.

## Features

* High Compatibility: Compatible with Spigot / Catserver / Mohist versions 1.8.8 - 1.20.4.

* Advanced GUI: Most features have a graphical user interface, making it easy for players to operate.

* Highly Customizable: UltiTools expands its functionality through modules. You can use any modules based on your needs.

* Comprehensive Configuration: The default configuration can be used directly as a base, meeting the needs of beginners starting a server. Of course, everything can be customized.

* Continuous Maintenance: Any questions or suggestions can be submitted to via Github Issues. The author will promptly fix bugs and update new features based on player feedback and suggestions.

* Feature-Rich: UltiTools covers almost all the basic features needed for a server, including special features like GUI login and a mail system.

* Performance Optimization: Every aspect of the plugin has been optimized to ensure a smooth experience while offering a range of features.

## Why Choose UltiTools API for Plugin Development?

UltiTools API is the core of UltiTools, providing a comprehensive set of APIs that enable easy development of feature-rich plugins.

UltiTools API packages many commonly used libraries, including but not limited to Spring core, FastJson, Hutool, Adventure, obliviate-invs, etc. You can directly use these libraries in your development without worrying about the size of the plugins.

UltiTools API offers a complete GUI API, allowing you to easily develop GUI plugins without worrying about the intricacies of GUI implementation.

UltiTools API provides an advanced annotation system, enabling you to develop UltiTools plugins in the same way as you would develop Spring Boot applications (with the IOC framework provided by Spring Core).

UltiTools also offers a Maven plugin that can automatically place compiled plugins into a folder and upload modules to UltiCloud, enhancing the quality of life in your plugin development.

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
