---
layout: home

hero:
  name: "UltiTools API"
  text: "<span id=\"typing\">Base on Module</span><br>Spigot Development Framework"
  tagline: Enjoy developing Spigot plugins with UltiTools API
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/quick-start
    - theme: alt
      text: Javadoc
      link: https://dev.ultikits.com/javadoc
    - theme: alt
      text: GitHub Repo
      link: https://github.com/UltiKits/UltiTools-Reborn
  image:
    src: /nnneon.svg
    alt: UltiTools

features:
  - title: All-In-One
    icon: 📦
    details: The UltiTools-API packages a multitude of commonly used libraries, allowing you to directly utilize these libraries in your development without worrying about the size of the plugins.
  - title: Powered by Annotation
    icon: 🚀
    details: The UltiTools-API offers an advanced annotation system, enabling you to develop Spigot plugins in a manner similar to developing Spring Boot applications.
  - title: Complementary Maven Plugin
    icon: 🧩
    details: UltiTools also offers a Maven plugin that can automatically place compiled plugins into a folder and upload modules to UltiCloud, enhancing the quality of life in your plugin development.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);

  --vp-home-hero-image-background-image: linear-gradient(180deg, rgba(189,52,254,0.4) 50%, rgba(71,202,255,0.4) 50%);
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
    .typeString('Module Based')
    .pauseFor(2000)
    .deleteChars(12)
    .typeString('Annotation Driven')
    .pauseFor(2000)
    .deleteChars(17)
    .typeString('Cloud Supported')
    .pauseFor(2000)
    .deleteChars(15)
    .typeString('Developer-friendly')
    .pauseFor(2000)
    .start();
})
</script>
