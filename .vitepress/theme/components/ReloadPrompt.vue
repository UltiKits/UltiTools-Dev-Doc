<script setup lang="ts">
// Registers /sw.js and renders nothing.
//
// The registration must stay: .vitepress/config/pwa.mts builds the
// self-destroying service worker (selfDestroying: true), and a reader whose
// browser still runs an older caching worker only picks up that rescue worker
// through this registerSW() call (scripts/verify-sw.sh assertion 4 checks the
// compiled registration chunk). The update / offline-ready prompt that used to
// live here was removed: in selfDestroying mode vite-plugin-pwa never fires
// onOfflineReady or onNeedRefresh, so that prompt could not appear.
import { onBeforeMount } from 'vue'

onBeforeMount(async () => {
  // @ts-ignore virtual module provided by vite-plugin-pwa
  const { registerSW } = await import('virtual:pwa-register')
  registerSW({
    immediate: true,
    onRegisterError(e: unknown) {
      console.error('Service Worker registration error!', e)
    },
  })
})
</script>

<template>
  <!-- registration only, no UI -->
</template>
