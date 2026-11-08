<script setup lang="ts">
import DefaultTheme, { useSidebar } from 'vitepress/theme'
import { inBrowser, useData, useRoute, useRouter } from 'vitepress'
import { nextTick, watch, onMounted, onUnmounted } from 'vue'
// @ts-ignore
import VersionNoticeBar from './components/VersionNoticeBar.vue'
// @ts-ignore
import SecondNavBar from './components/SecondNavBar.vue'
// @ts-ignore
import SidebarTranslations from './components/SidebarTranslations.vue'
// @ts-ignore
import VPNavBarAppearance from 'vitepress/dist/client/theme-default/components/VPNavBarAppearance.vue'
import { NolebaseEnhancedReadabilitiesMenu, NolebaseEnhancedReadabilitiesScreenMenu } from '@nolebase/vitepress-plugin-enhanced-readabilities/client'
import { NolebaseHighlightTargetedHeading } from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import ReloadPrompt from './components/ReloadPrompt.vue'

const { Layout } = DefaultTheme
const { lang } = useData()
const route = useRoute()
const router = useRouter()
// Pages without a sidebar (the home layout) get the language switch and the
// appearance toggle in the nav bar instead, see the template.
const { hasSidebar } = useSidebar()

// At 960px and up the article scrolls inside .VPDoc .container, not the
// window. VitePress's own hash scrolling and scroll restoration target the
// window, so the code below repeats them for that container.
const CONTAINER = '.VPDoc .container'
// Same value VitePress uses in its own outline code (outline.js activateLink).
const MARKER_OFFSET = 39
const getContainer = () => document.querySelector(CONTAINER) as HTMLElement | null

// Element for a location hash. getElementById rather than querySelector: ids
// with CJK text, dots, colons or a leading digit are not valid CSS selectors.
// A malformed percent sequence (#100%) is not a target, not an error.
const hashTarget = (hash: string): HTMLElement | null => {
    if (!hash || hash.length < 2) return null
    let decoded = hash
    try {
        decoded = decodeURIComponent(hash)
    } catch {
        // keep the raw hash
    }
    return document.getElementById(decoded.slice(1)) ?? document.getElementById(hash.slice(1))
}

const sameHash = (a: string, b: string) => {
    const decode = (h: string) => {
        try {
            return decodeURIComponent(h)
        } catch {
            return h
        }
    }
    return decode(a) === decode(b)
}

const scrollToHash = (hash: string, behavior: ScrollBehavior = 'smooth') => {
    if (!inBrowser) return
    nextTick(() => {
        const target = hashTarget(hash)
        const container = getContainer()
        if (target && container) {
            const targetRect = target.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            // target position = current scroll + (target - container) - 20px gap
            container.scrollTo({
                top: container.scrollTop + targetRect.top - containerRect.top - 20,
                behavior
            })
        }
    })
}

const handleHashChange = () => {
    if (window.location.hash) {
        scrollToHash(window.location.hash)
    }
}

// VitePress only fires hashchange when the clicked hash differs from the
// current one. Because the outline below keeps the URL hash in step with the
// highlighted heading, the highlighted outline entry and its heading's `#`
// anchor were exactly the links that did nothing. Runs in the capture phase,
// before VitePress's own (window, capture) click handler, and leaves that
// handler's work untouched.
const handleSameHashClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return
    const link = (e.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null
    if (!link || !link.closest('.VPDoc')) return
    const href = link.getAttribute('href')
    if (!href || !href.startsWith('#')) return
    if (window.location.hash && sameHash(href, window.location.hash)) {
        scrollToHash(href)
    }
}

// Outline highlighting for the container scroll (VitePress's own listens to
// window scroll).
const updateActiveOutline = () => {
    const container = getContainer()
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const headers = Array.from(container.querySelectorAll('.vp-doc :where(h1,h2,h3,h4,h5,h6)'))
        .filter((el) => el.id && el.hasChildNodes())
        .map((el) => ({
            link: '#' + el.id,
            top: el.getBoundingClientRect().top - containerRect.top + container.scrollTop
        }))

    if (!headers.length) return

    const outline = document.querySelector('.VPDocAsideOutline')
    if (!outline) return
    const marker = outline.querySelector('.outline-marker') as HTMLElement | null
    const links = Array.from(outline.querySelectorAll('.VPDocOutlineItem a')) as HTMLAnchorElement[]

    const scrollTop = container.scrollTop
    // a heading counts as reached once it is within this distance of the top
    const offset = 100
    let active: string | null = null
    for (const { link, top } of headers) {
        if (top > scrollTop + offset) break
        active = link
    }

    let foundActive = false
    links.forEach((link) => {
        if (active && sameHash(link.getAttribute('href') || '', active)) {
            link.classList.add('active')
            if (marker) {
                marker.style.top = link.offsetTop + MARKER_OFFSET + 'px'
                marker.style.opacity = '1'
            }
            foundActive = true
            // keep the URL hash in step without scrolling; history.state is kept
            // because VitePress ignores popstate events whose state is null
            if (!sameHash(window.location.hash, active)) {
                history.replaceState(history.state, '', active)
            }
        } else {
            link.classList.remove('active')
        }
    })

    if (!foundActive && marker) {
        marker.style.opacity = '0'
    }
}

function throttle(func: () => void, limit: number) {
    let inThrottle = false
    let pending = false
    return function () {
        if (inThrottle) {
            pending = true
            return
        }
        func()
        inThrottle = true
        setTimeout(() => {
            inThrottle = false
            // run once more so the final scroll position is not missed
            if (pending) {
                pending = false
                func()
            }
        }, limit)
    }
}

const throttledUpdateOutline = throttle(updateActiveOutline, 100)

// Container scroll position per page path, so Back/Forward return to where the
// reader was. VitePress saves only window.scrollY in history.state and its
// go() overwrites that state, so the positions are kept here instead.
const savedScroll = new Map<string, number>()
let currentPath = ''
let poppedPath: string | null = null

const recordScroll = () => {
    const container = getContainer()
    if (container && currentPath) savedScroll.set(currentPath, container.scrollTop)
}

let boundContainer: HTMLElement | null = null
const bindScrollListener = () => {
    const container = getContainer()
    if (container === boundContainer) return
    boundContainer?.removeEventListener('scroll', throttledUpdateOutline)
    boundContainer?.removeEventListener('scroll', recordScroll)
    boundContainer = container
    if (container) {
        container.addEventListener('scroll', throttledUpdateOutline, { passive: true })
        container.addEventListener('scroll', recordScroll, { passive: true })
    }
}

const onPopState = () => {
    poppedPath = window.location.pathname
}

// Restores the container for the page that was just rendered: a hash target
// on a link navigation, the saved position on Back/Forward, otherwise the top.
const placeContainer = () => {
    bindScrollListener()
    const container = getContainer()
    const restore = poppedPath === route.path ? savedScroll.get(route.path) : undefined
    poppedPath = null
    currentPath = route.path
    if (container) {
        if (restore !== undefined) {
            container.scrollTop = restore
        } else if (window.location.hash && hashTarget(window.location.hash)) {
            scrollToHash(window.location.hash, 'auto')
        } else {
            container.scrollTop = 0
        }
    }
    nextTick(updateActiveOutline)
}

if (inBrowser) {
    // a link navigation (go()) is never a Back/Forward restore
    const previousBefore = router.onBeforeRouteChange
    router.onBeforeRouteChange = (to: string) => {
        poppedPath = null
        return previousBefore?.(to)
    }
}

onMounted(() => {
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('click', handleSameHashClick, { capture: true })
    currentPath = route.path
    bindScrollListener()
    if (window.location.hash) scrollToHash(window.location.hash, 'auto')
    nextTick(updateActiveOutline)
})

onUnmounted(() => {
    window.removeEventListener('hashchange', handleHashChange)
    window.removeEventListener('popstate', onPopState)
    window.removeEventListener('click', handleSameHashClick, { capture: true })
    boundContainer?.removeEventListener('scroll', throttledUpdateOutline)
    boundContainer?.removeEventListener('scroll', recordScroll)
    boundContainer = null
})

// Page change: runs after the new page is patched into the DOM ('post'), so the
// reused container is placed before the next paint instead of 200ms later.
watch(() => route.path, () => {
    if (inBrowser) placeContainer()
}, { flush: 'post' })

if (inBrowser) {
    // Storage access throws when site data is blocked; the redirect and the
    // remembered preference are conveniences and must not stop the page.
    try {
        // Auto-detect language on first visit to root path
        if (window.location.pathname === '/') {
            const hasPreference = localStorage.getItem('preferred_lang')
            if (!hasPreference && /^zh\b/i.test(navigator.language)) {
                localStorage.setItem('preferred_lang', 'zh')
                window.location.pathname = '/zh/'
            }
        }
        // Remember language preference when user navigates
        localStorage.setItem('preferred_lang', lang.value.startsWith('zh') ? 'zh' : 'en')
    } catch {
        // storage unavailable
    }
}
</script>

<template>
    <Layout>
        <template #nav-bar-content-after>
            <a class="developer-btn" href="https://panel.ultikits.com/developer" target="_blank">
                {{ lang.startsWith('zh') ? '开发者平台' : 'Dev Portal' }}
            </a>
            <NolebaseEnhancedReadabilitiesMenu />
            <div v-if="!hasSidebar" class="nav-bar-toolbar">
                <SidebarTranslations placement="bottom" />
                <VPNavBarAppearance />
            </div>
        </template>
        <template #nav-screen-content-after>
            <NolebaseEnhancedReadabilitiesScreenMenu />
        </template>
        <template #sidebar-nav-after>
            <div class="sidebar-bottom-toolbar">
                <SidebarTranslations class="sidebar-translations" />
                <VPNavBarAppearance class="sidebar-appearance" />
            </div>
        </template>
        <template #layout-top>
            <VersionNoticeBar />
            <SecondNavBar />
            <NolebaseHighlightTargetedHeading />
        </template>
        <template #layout-bottom>
            <ReloadPrompt />
        </template>
    </Layout>
</template>

<style>
/* 隐藏默认菜单 */
.VPNavBar .content-body>.VPNavBarMenu.menu {
    display: none !important;
}

/* 768px 起把汉堡按钮与手机菜单留下（960px 起由下一条交还给 tab 行）。
   这一带此前没有任何导航承载体：VitePress 的汉堡从 768px 起隐藏
   （VPNavBarHamburger.vue:10-14），手机菜单同样（VPNavScreen.vue:38-42），
   上面那条规则无条件藏掉默认菜单，而 SecondNavBar 要到 960px 才显示
   （SecondNavBar.vue 的 @media (min-width: 960px)）。三者叠加使深度指南、
   API 接口、用户文档、版本切换器、语言切换与深色模式在该带全部够不着。
   不改用默认菜单，是因为本站往导航栏里多放了开发者平台按钮与阅读增强
   菜单：实测放出默认菜单后 .content 的 min-content 宽度达 974px（英文），
   撑破 .container 造成页面横向滚动。手机菜单是覆盖层，不参与该行的排布。
   上游两条规则都带 scoped 属性选择器（0,2,0），故用 !important 覆盖，
   与本文件既有的两处覆盖写法一致。 */
@media (min-width: 768px) {
    .VPNavBarHamburger {
        display: flex !important;
    }

    .VPNavScreen {
        display: block !important;
    }
}

/* 960px 起交还给 SecondNavBar。
   只用 min-width、靠后写的规则覆盖前面的，而不是给上一条配一个
   max-width: 959px——那样 959 与 960 之间的小数宽度会两条都不命中，
   落回同一个导航真空。边界由 960 这一个数字定义，结构上不存在缝。 */
@media (min-width: 960px) {
    .VPNavBarHamburger {
        display: none !important;
    }

    .VPNavScreen {
        display: none !important;
    }
}

/* 开发者平台按钮样式 */
.developer-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    height: 36px;
    border-radius: 18px;
    /* 圆角 */
    background-color: var(--vp-c-brand);
    color: white !important;
    font-size: 14px;
    font-weight: 500;
    margin-right: 12px;
    transition: background-color 0.25s, transform 0.1s;
    text-decoration: none !important;
    white-space: nowrap;
}

.developer-btn:hover {
    background-color: var(--vp-c-brand-dark);
    transform: translateY(-1px);
}

.developer-btn:active {
    transform: translateY(1px);
}

/* 移动端隐藏开发者平台按钮（可选，视空间而定） */
@media (max-width: 768px) {
    .developer-btn {
        display: none;
    }
}

/* 隐藏 Navbar 上的语言和外观切换。有侧边栏的页面由侧边栏底部的工具栏提供；
   没有侧边栏的页面（首页布局）由 #nav-bar-content-after 里的 .nav-bar-toolbar
   提供，它与 VitePress 自己的开关一样只在 1280px 起显示，更窄时由“…”菜单提供。 */
.VPNavBar .content-body>.VPNavBarTranslations,
.VPNavBar .content-body>.VPNavBarAppearance {
    display: none !important;
}

.nav-bar-toolbar {
    display: none;
}

@media (min-width: 1280px) {
    .nav-bar-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
    }
}

/* 移动端处理 */
@media (max-width: 959px) {

    /* 确保 SecondNavBar 不显示 */
    .SecondNavBar {
        display: none !important;
    }
}

/* 圆角矩形容器包裹 VPDoc 下的 container */
.VPDoc {
    height: calc(100vh - var(--vp-nav-height) - var(--vp-layout-top-height, 0px));
    overflow: hidden;
    padding: 20px !important;
    /* Was a literal 64px: the tab row's own height (48px) plus a 16px gap
       below it. At and above 960px the variable is 48px and this yields the
       same 64px the literal produced, now named instead of repeated.

       Below 960px the variable is 0px, so the expression would yield 16px —
       but it never applies there. The mobile block near the end of this
       stylesheet sets `.VPDoc { padding: 0 !important }`, same specificity
       and later in source order, so it wins under `@media (max-width:
       959px)` and the computed padding-top below 960px is 0px, both before
       and after this change. Measured in headless Chromium over CDP: 0px at
       375 and 768, 64px at 1024, 1280 and 1440 — identical to master at all
       five. */
    padding-top: calc(var(--ut-tabbar-height) + 16px) !important;
    box-sizing: border-box;
}

.VPDoc .container {
    position: relative;
    height: 100%;
    overflow-y: auto;
    border-radius: 16px;
    border: 1px solid var(--vp-c-divider);
    background-color: var(--vp-c-bg);
    box-shadow: var(--vp-shadow-2);
    padding: 32px;
    /* 隐藏默认滚动条但允许滚动 */
    scrollbar-width: thin;

    /* 强制 Flex 布局，确保 Aside 高度被拉伸 */
    display: flex !important;
    align-items: stretch !important;
}

/* 修改 Aside 定位，使其包含在容器内 */
.VPDoc .aside-container {
    /* Was the notice-bar variable plus a literal 128. The main nav height
       plus the tab row height plus a 16px gap: 64 + 48 + 16 = 128, the same
       value the literal produced. */
    top: calc(var(--vp-layout-top-height, 0px) + var(--vp-nav-height) + var(--ut-tabbar-height) + 16px) !important;
    padding-top: 0 !important;
    /* Was a literal 84 subtrahend, with no traceable origin. It decomposes
       into the tab row height, the same 16px gap used in the sibling top
       offset above, and this repository's own 20px .VPDoc padding:
       48 + 16 + 20 = 84, the same value the literal produced. */
    max-height: calc(100vh - var(--vp-nav-height) - var(--vp-layout-top-height, 0px) - var(--ut-tabbar-height) - 16px - 20px) !important;
    overflow-y: auto !important;
}

.VPDocAsideOutline.has-outline .content {
    padding-top: 32px !important;
}

.VPDocAsideOutline.has-outline .content .outline-marker {
    /* 32px, not 38px: with this margin VitePress's own marker position
       (link offsetTop + 39, outline.js) centres the marker on the link, and
       Layout.vue uses the same 39 so the two writers agree. */
    margin-top: 32px !important;
}

.VPDoc .aside {
    /* 确保 sticky 生效 */
    overflow: visible !important;
    /* 确保 Aside 不会被压缩 */
    flex-shrink: 0 !important;
    /* 默认主题可能有 margin，这里重置一下 */
    margin-top: 0 !important;
}

.VPDoc .content {
    /* 确保内容占据剩余空间 */
    flex-grow: 1 !important;
    /* 防止内容溢出 */
    min-width: 0 !important;
}

.VPDoc .aside-curtain {
    display: none;
}

/* 隐藏 Aside 滚动条但允许滚动 */
.VPDoc .aside-container::-webkit-scrollbar {
    display: none;
}

/* 适配移动端 */
@media (max-width: 959px) {
    .VPDoc {
        height: auto;
        padding: 0 !important;
        overflow: visible;
    }

    .VPDoc .container {
        height: auto;
        overflow: visible;
        padding: 16px;
        border-radius: 0;
        border: none;
        box-shadow: none;
    }
}

/* 强制显示（本 <style> 不是 scoped，:deep() 在这里不会被转换，写了会让整条规则失效） */
.sidebar-bottom-toolbar .sidebar-translations,
.sidebar-bottom-toolbar .VPNavBarAppearance {
    display: flex !important;
}

/* 修复侧边栏工具栏贴底问题 */
.VPSidebar {
    padding-bottom: 0 !important;
}

.VPSidebar>.nav {
    /* 确保 nav 至少占满可视高度，减去 top padding */
    min-height: calc(100vh - var(--vp-nav-height) - var(--vp-layout-top-height, 0px) - 32px);
    display: flex;
    flex-direction: column;
}

.sidebar-bottom-toolbar {
    margin-top: auto;
    /* 在内容较少时推到底部 */
    position: sticky;
    bottom: 0;
    left: 0;
    width: calc(100% + 64px);
    margin-left: -32px;
    display: flex;
    justify-content: space-between;
    /* 语言在左，外观在右 */
    gap: 16px;
    align-items: center;
    padding: 16px 32px;
    background-color: var(--vp-sidebar-bg-color);
    border-top: 1px solid var(--vp-c-divider);
    z-index: 10;
}

/* 侧边栏激活项样式优化 */
.VPSidebarItem.is-link>.item {
    padding: 2px 10px !important;
    border-radius: 6px;
    transition: background-color 0.2s;
    margin: 2px 0;
}

.VPSidebarItem.is-link>.item:hover {
    background-color: var(--vp-c-default-soft);
}

.VPSidebarItem.is-link.is-active>.item {
    background-color: var(--vp-c-brand-soft) !important;
}

.VPSidebarItem.is-link.is-active>.item .text {
    color: var(--vp-c-brand) !important;
}

/* 隐藏激活时的左侧指示条（indicator），因为有了背景 */
.VPSidebarItem.is-active>.item>.indicator {
    display: none !important;
}
</style>
