---
layout: home

hero:
  name: "UltiTools API"
  text: "<span id=\"typing\">基于模块的</span><br>Paper 插件框架"
  tagline: 简单，易用，快速，高兼容<br>愉悦的开发体验让你专注于创新之中
  actions:
    - theme: brand
      text: 快速上手
      link: /zh/guide/quick-start
    - theme: alt
      text: Javadoc 文档
      link: /api/
      target: _self
    - theme: alt
      text: GitHub 仓库
      link: https://github.com/UltiKits/UltiTools-Reborn
  image:
    src: /nnneon.svg
    alt: UltiTools

features:
  - title: 多包和一
    icon: 📦
    details: UltiTools API 打包了很多常用的库，您可以在开发中直接使用这些库而无需担心插件的体量。
  - title: 注解驱动
    icon: 🚀
    details: UltiTools API 提供了高级的注解系统，您可以像开发 Spring Boot 应用一样开发 Minecraft 插件。
  - title: 配套 Maven 插件
    icon: 🧩
    details: UltiTools 还提供了一个maven插件，可以自动将编译后的插件放入文件夹和上传模块至UltiCloud，提升您开发插件的生活质量。
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);

  --vp-home-hero-image-background-image: linear-gradient(180deg,  rgba(71,202,255,0.4) 50%, rgba(189,52,254,0.4) 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}

.VPContent.is-home {
    padding-top: calc(var(--vp-nav-height) + 64px);
}
</style>

<script setup>
import {onMounted} from 'vue';
import Typewriter from 'typewriter-effect/dist/core';

onMounted(() => {
  let typing = document.getElementById('typing');

  let typewriter = new Typewriter(typing, {
    loop: true,
    delay: 75,
  });

  typewriter
    .typeString('基于模块的')
    .pauseFor(2000)
    .deleteChars(5)
    .typeString('注解驱动的')
    .pauseFor(2000)
    .deleteChars(5)
    .typeString('云端支持的')
    .pauseFor(2000)
    .deleteChars(5)
    .typeString('上手迅速的')
    .pauseFor(2000)
    .start();
})
</script>
