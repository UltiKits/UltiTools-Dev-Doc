<script setup lang="ts">
import { onBeforeMount, ref } from 'vue'
import {inBrowser, useData} from "vitepress";

const offlineReady = ref(false)
const needRefresh = ref(false)

let updateServiceWorker: (() => Promise<void>) | undefined

function onOfflineReady() {
  offlineReady.value = true
}
function onNeedRefresh() {
  needRefresh.value = true
}
async function close() {
  offlineReady.value = false
  needRefresh.value = false
}

onBeforeMount(async () => {
  // @ts-ignore
  const { registerSW } = await import('virtual:pwa-register')
  updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady,
    onNeedRefresh,
    onRegistered() {
      console.info('Service Worker registered')
    },
    onRegisterError(e) {
      console.error('Service Worker registration error!', e)
    },
  })
})
const {lang} = useData()
let language = lang.value.split('-')[0];
</script>

<template>
  <template v-if="offlineReady || needRefresh">
    <div
      class="pwa-toast"
      role="alertdialog"
      aria-labelledby="pwa-message"
    >
      <div id="pwa-message" class="mb-3">
        {{ offlineReady ? language == 'zh' ? '文档已缓存，可离线使用' : 'Document is cached, offline available' : language == 'zh' ? '新内容可用，刷新页面以应用' : 'New content is available, refresh to load' }}
      </div>
      <button
        v-if="needRefresh"
        type="button"
        class="pwa-refresh"
        @click="updateServiceWorker?.()"
      >
        Reload
      </button>
      <button
        type="button"
        class="pwa-cancel"
        @click="close"
      >
        Close
      </button>
    </div>
  </template>
</template>

<style>
.pwa-toast {
  position: fixed;
  right: 0;
  bottom: 0;
  margin: 16px;
  padding: 12px;
  border: 1px solid #8885;
  border-radius: 4px;
  z-index: 100;
  text-align: left;
  background-color: var(--vp-c-bg-soft);
}
.pwa-toast #pwa-message {
  margin-bottom: 8px;
}
.pwa-toast button {
  border: 1px solid #8885;
  outline: none;
  margin-right: 5px;
  border-radius: 2px;
  padding: 3px 10px;
}
</style>
