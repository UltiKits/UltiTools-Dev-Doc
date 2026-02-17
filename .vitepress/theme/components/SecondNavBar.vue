<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import { ref, watch, onMounted, nextTick } from 'vue'
// @ts-ignore
import VPNavBarMenuLink from 'vitepress/dist/client/theme-default/components/VPNavBarMenuLink.vue'
// @ts-ignore
import VPNavBarMenuGroup from 'vitepress/dist/client/theme-default/components/VPNavBarMenuGroup.vue'

const { theme } = useData()
const route = useRoute()

const indicatorStyle = ref({
  width: '0px',
  left: '0px',
  opacity: 0
})

const navContentRef = ref<HTMLElement | null>(null)

const updateIndicator = () => {
  if (!navContentRef.value) return

  // Find the active link
  // VPNavBarMenuLink applies 'active' class to active links
  // We need to wait for DOM update
  nextTick(() => {
    // 查找 active 状态的链接或组
    // 注意：VitePress 的 VPNavBarMenuLink 和 VPNavBarMenuGroup 会根据路由自动添加 .active 类
    const activeLink = navContentRef.value?.querySelector('.VPNavBarMenuLink.active, .VPNavBarMenuGroup.active') as HTMLElement

    if (activeLink) {
      const parentRect = navContentRef.value!.getBoundingClientRect()
      const activeRect = activeLink.getBoundingClientRect()

      // 计算相对位置，减去父容器的 padding-left (如果有) 或直接计算差值
      // 这里 .content 是 flex 容器，activeLink 是子元素
      // left 值应该是 activeLink 距离 content 左边缘的距离
      const left = activeRect.left - parentRect.left

      indicatorStyle.value = {
        width: `${activeRect.width}px`,
        left: `${left}px`,
        opacity: 1
      }
    } else {
      indicatorStyle.value = {
        ...indicatorStyle.value,
        opacity: 0
      }
    }
  })
}

watch(() => route.path, () => {
  updateIndicator()
}, { immediate: true })

onMounted(() => {
  updateIndicator()
  window.addEventListener('resize', updateIndicator)
})
</script>

<template>
  <div v-if="theme.nav" class="SecondNavBar">
    <div class="container">
      <div class="content" ref="navContentRef">
        <template v-for="item in theme.nav" :key="JSON.stringify(item)">
          <VPNavBarMenuLink v-if="'link' in item" :item="item" />
          <component v-else-if="'component' in item" :is="item.component" v-bind="item.props" />
          <VPNavBarMenuGroup v-else :item="item" />
        </template>
        <div class="active-indicator" :style="indicatorStyle"></div>
      </div>

      <a class="announcement" href="https://github.com/UltiKits/UltiTools-Reborn" target="_blank">
        <span class="badge">NEW</span>
        <span class="text">UltiTools 6.2.0 已发布！更加现代化的开发体验！→</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.SecondNavBar {
  position: fixed;
  top: var(--vp-nav-height-mobile, 65px);
  left: 0;
  z-index: 30;
  /* 确保在内容之上 */
  width: 100%;
  height: 48px;
  /* 第二行的高度 */
  background-color: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
  display: none;
  /* 默认隐藏，桌面端显示 */
  transition: background-color 0.5s;
}

@media (min-width: 960px) {
  .SecondNavBar {
    display: block;
    top: 64px;
    /* 这里固定为原来的高度 */
  }
}

.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  margin: 0 16px;
  max-width: calc(var(--vp-layout-max-width) - 64px);
}

.content {
  display: flex;
  align-items: center;
  gap: 20px;
  position: relative;
  /* For absolute positioning of indicator */
  height: 100%;
}

.announcement {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.25s;
  margin-left: 20px;
}

.announcement:hover {
  color: var(--vp-c-brand);
}

.announcement .badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background-color: var(--vp-c-brand);
  padding: 0 6px;
  border-radius: 4px;
  margin-right: 8px;
  line-height: 18px;
}

.active-indicator {
  position: absolute;
  bottom: 0;
  /* Align to bottom of nav bar */
  height: 2px;
  background-color: var(--vp-c-brand);
  transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
  /* expoOut curve */
  pointer-events: none;
}

/* 覆盖默认样式，使其横向排列 */
:deep(.VPNavBarMenuLink),
:deep(.VPNavBarMenuGroup) {
  display: flex;
  align-items: center;
  height: 100%;
  /* Fill height to make bottom border alignment easier if needed */
}

:deep(.VPMenuGroup .items) {
  /* 修复下拉菜单 */
  min-width: 120px;
}
</style>
