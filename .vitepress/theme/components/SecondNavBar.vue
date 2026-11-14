<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
// @ts-ignore
import VPNavBarMenuLink from 'vitepress/dist/client/theme-default/components/VPNavMenuLink.vue'
// @ts-ignore
import VPNavBarMenuGroup from 'vitepress/dist/client/theme-default/components/VPNavMenuGroup.vue'
// @ts-ignore — 构建期生成，与 Layout.vue 的版本切换器读的是同一份清单
import { CURRENT_VERSION } from '../../config/version-pages.generated.mjs'

const { theme, lang } = useData()
const route = useRoute()

const indicatorStyle = ref({
  width: '0px',
  left: '0px',
  opacity: 0
})

// The current release comes from config/version-pages.generated.mjs, the same
// build-time manifest Layout.vue's version switcher reads. It used to come off
// the nav entry's props.versioningPlugin, which @viteplus/versions populated
// only for `component` nav entries; the switcher is no longer a nav entry, so
// that path no longer exists.
const currentVersion = computed(() => CURRENT_VERSION.replace(/^v/, ''))

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

onUnmounted(() => {
  window.removeEventListener('resize', updateIndicator)
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
        <span class="text">{{ lang.startsWith('zh') ? `UltiTools ${currentVersion} 已发布！更加现代化的开发体验！→` : `UltiTools ${currentVersion} Released! A more modern dev experience! →` }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.SecondNavBar {
  position: fixed;
  /* One expression replaces the two hardcoded tops this rule and the 960px
     block used to carry. The previous fallback read a mobile-specific
     nav-height custom property that is not defined anywhere in vitepress
     (verified: zero hits under node_modules/vitepress/, while the real
     nav-height variable matches normally), so it always fell through to
     65px — one pixel more than the real nav height. */
  top: calc(var(--vp-layout-top-height, 0px) + var(--vp-nav-height));
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
  }
}

.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

/* 页面级对齐：960px 起与导航栏标题、侧栏、正文共享同一条左边界。
   边界算法与 VPNavBar 的 wrapper/container 一致——max-width 取
   --vp-layout-max-width（1440），居中，左右各 32px。改动前 tab 行跟的是
   正文卡片（1440 视口下 292/1420），比页面边界右移 260px。
   实测（1440/1600/1920）：首个 tab 的左边距与 .VPNavBarTitle 的标题文字、
   #VPSidebarNav 三者相同，依次是 32/112/272。 */
@media (min-width: 960px) {
  .SecondNavBar .container {
    box-sizing: border-box;
    max-width: var(--vp-layout-max-width);
    margin: 0 auto;
    padding-left: 32px;
    padding-right: 32px;
  }
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
