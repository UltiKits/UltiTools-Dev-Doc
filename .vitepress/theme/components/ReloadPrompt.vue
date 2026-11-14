<script setup lang="ts">
// 只注册同名救援 worker，不显示离线或手动更新提示。保持在浏览器生命周期内，
// SSR 不访问 navigator；布局在站内跳转时不重建，无须重复注册或订阅事件。
import { onBeforeMount } from 'vue'

onBeforeMount(async () => {
  if (!('serviceWorker' in navigator)) return
  try {
    const { registerRescueWorker } = await import('../register-rescue-worker.mjs')
    await registerRescueWorker(navigator.serviceWorker)
  } catch (error) {
    console.error('Service Worker registration error!', error)
  }
})
</script>

<template>
  <!-- 只有注册逻辑，没有 UI -->
</template>
