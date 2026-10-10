---
footer: false
---

# Introduction

## What is UltiTools?

UltiTools is a basic plugin for Minecraft servers, which was released in June 2020. It has many basic and special functions, and cares about the feedback of each user.

It is committed to making more server owners build servers easily, reducing the troubles caused by incompatible plugins.

## Features

* High Compatibility: As of v6.3.0, the framework supports Paper 1.19.2 build 163 or later, using the Java version required by the chosen Paper line (Java 17 for 1.19.2 to 1.20.4, Java 21 from 1.20.5). Individual modules may require a newer server; UltiKits, UltiLogin, UltiMail, UltiRemoteBag and UltiTrade require Minecraft 1.21+.

* Advanced GUI: Most features have a graphical user interface, making it easy for players to operate.

* Highly Customizable: UltiTools expands its functionality through modules. You can use any modules based on your needs.

* Comprehensive Configuration: The default configuration can be used directly as a base, meeting the needs of beginners starting a server. Of course, everything can be customized.

* Continuous Maintenance: Any questions or suggestions can be submitted to via Github Issues. The author will promptly fix bugs and update new features based on player feedback and suggestions.

* Feature-Rich: UltiTools covers almost all the basic features needed for a server, including special features like GUI login and a mail system.

* Performance Optimization: Every aspect of the plugin has been optimized to ensure a smooth experience while offering a range of features.

## Why Choose UltiTools API for Plugin Development?

UltiTools API is the core of UltiTools, providing a comprehensive set of APIs that enable easy development of feature-rich plugins.

As of v6.3.0, UltiTools API bundles obliviate-invs and UniversalScheduler into its own JAR. Paper downloads ByteBuddy, HikariCP, XSeries, Java-WebSocket, commons-dbutils and JavaMail from the `libraries:` entries in `plugin.yml`. Gson, MySQL Connector/J, protobuf, slf4j and native Adventure come from the Paper server itself. Modules can declare these libraries with `provided` scope instead of bundling them.

As of v6.3.0, `adventure-platform-bukkit` and `DependenceManagers#getAdventure()` have been removed. Send Adventure components through Paper's `Player#sendMessage(Component)` instead.

UltiTools API provides a Spring-like IoC container (`SimpleContainer`) with annotation-driven dependency injection.

UltiTools API offers a complete GUI API, allowing you to easily develop GUI plugins without worrying about the intricacies of GUI implementation.

UltiTools API provides an advanced annotation system, enabling you to develop UltiTools plugins in the same way as you would develop Spring Boot applications (with UltiTools' own Spring-like IoC container).

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
