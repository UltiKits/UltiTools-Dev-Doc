<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import { useSidebar } from 'vitepress/theme'
import { ref, watch, onMounted, nextTick } from 'vue'
// @ts-ignore
import VPNavBarMenuLink from 'vitepress/dist/client/theme-default/components/VPNavBarMenuLink.vue'
// @ts-ignore
import VPNavBarMenuGroup from 'vitepress/dist/client/theme-default/components/VPNavBarMenuGroup.vue'

const { theme, lang } = useData()
const route = useRoute()

// hasSidebar is a pure computed over frontmatter/sidebar-config/relative-path
// (vitepress's own composables/sidebar.js). Bound straight into the template
// below so server and client render the identical class on the same pass.
// The sibling flag this same composable also exports additionally multiplies
// in a media-query read that is always false during SSR, so it is not used
// here. VPNavBar's own equivalent class is written via a post-render effect
// instead of a direct computed, which lets its class differ between server
// render and hydration; binding a computed straight into the template
// removes that divergence rather than relying on tolerance for it.
const { hasSidebar } = useSidebar()

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
  <div v-if="theme.nav" class="SecondNavBar" :class="{ 'has-sidebar': hasSidebar }">
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
        <span class="text">{{ lang.startsWith('zh') ? 'UltiTools 6.2.0 已发布！更加现代化的开发体验！→' : 'UltiTools 6.2.0 Released! A more modern dev experience! →' }}</span>
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
  margin: 0 16px;
  max-width: calc(var(--vp-layout-max-width) - 64px);
}

/* Sidebar-present branch, >=960px. Mirrors VPNavBar.vue:135-138's own
   has-sidebar rule: the container's cap and margin are removed so the
   boundary can track the sidebar's real width instead. The padding is
   applied here on .container rather than on .content — unlike VPNavBar,
   this component has no title/content split; .content (the nav links) and
   .announcement (the out-of-scope promo link, deferred per 04-CONTEXT.md)
   are siblings distributed by this rule's own justify-content:
   space-between, so the inset boundary has to live where that distribution
   happens for both of them to land on it, not only the nav links.
   var(--vp-sidebar-width) is 272px with no breakpoint variant. The extra
   20px on both sides is this repository's own `.VPDoc { padding: 20px }`
   override (Layout.vue) — upstream's article boundary gets it from VPDoc
   nesting inside VPContent's own sidebar padding; SecondNavBar is a
   sibling fixed element with no such nesting, so both terms are added
   directly. Together these reproduce the measured article-card edges of
   292 and 1420 at a 1440px viewport exactly. */
@media (min-width: 960px) {
  .SecondNavBar.has-sidebar .container {
    max-width: 100%;
    margin: 0;
    padding-left: calc(var(--vp-sidebar-width) + 20px);
    padding-right: 20px;
  }
}

/* At 1440px and above, add the same viewport-centring term VPNavBar.vue's
   own has-sidebar rule applies at this breakpoint (VPNavBar.vue:180-184) —
   zero at exactly 1440px, so the 292/1420 edges above still hold there and
   only move outward past it, tracking VPContent.vue's has-sidebar rule at
   the same breakpoint. */
@media (min-width: 1440px) {
  .SecondNavBar.has-sidebar .container {
    padding-left: calc((100vw - var(--vp-layout-max-width)) / 2 + var(--vp-sidebar-width) + 20px);
    padding-right: calc((100vw - var(--vp-layout-max-width)) / 2 + 20px);
  }
}

/* No-sidebar branch, >=960px — the live state of roughly half the archived
   pages today, not a defensive hypothetical: Chinese archived pages render
   zero sidebar items, measured on production, on the local build artifact
   and in the live preview DOM (04-CONTEXT.md correction 5). Centres the
   container at the same 1104px cap VPDoc.vue applies to the article's own
   no-sidebar .container at this breakpoint. SecondNavBar carries no padding
   of its own (unlike .VPDoc, which insets 20px before centring that cap in
   the remaining space) — centring 1104px directly within the full-width
   .SecondNavBar reproduces the identical 168/1272 edges at 1440px, because
   inset-then-centre and centre-in-full cancel out algebraically for a
   symmetric cap. */
@media (min-width: 960px) {
  .SecondNavBar:not(.has-sidebar) .container {
    max-width: 1104px;
    margin: 0 auto;
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
