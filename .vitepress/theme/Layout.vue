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
// @ts-ignore
import UtVersionSwitcher from './components/UtVersionSwitcher.vue'
// @ts-ignore — 构建期生成，与 VersionNoticeBar.vue 读的是同一份清单
import { CURRENT_VERSION, KNOWN_VERSIONS } from '../config/version-pages.generated.mjs'
import { NolebaseHighlightTargetedHeading } from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import ReloadPrompt from './components/ReloadPrompt.vue'

const { Layout } = DefaultTheme
const { lang } = useData()
const route = useRoute()
const router = useRouter()
// Pages without a sidebar (the home layout) get the language switch and the
// appearance toggle in the nav bar instead, see the template.
const { hasSidebar } = useSidebar()

// 版本切换器要的两个构建期值。它已不是 theme.nav 的一项，所以没有
// @viteplus/versions 的 populateNav 自动合并可用；这里直接读生成清单
// version-pages.generated.mjs，与通知条同源，避免两处版本数据互相漂移。
const versioningPlugin = {
    versions: KNOWN_VERSIONS,
    currentVersion: CURRENT_VERSION,
}

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

// Article scroll position per history entry, so Back/Forward return to where
// the reader was on that entry. It is stored in history.state under its own
// key next to VitePress's keys (VitePress needs a non-null state for popstate).
// Keyed per entry, not per path: two visits to the same page are two entries.
const SCROLL_KEY = 'utArticleScroll'
let poppedPath: string | null = null
let poppedScroll: number | undefined

const writeScroll = () => {
    const container = getContainer()
    if (!container) return
    history.replaceState({ ...(history.state ?? {}), [SCROLL_KEY]: container.scrollTop }, '')
}

// Debounced: browsers rate-limit replaceState, and only the resting position
// matters.
let scrollTimer: ReturnType<typeof setTimeout> | undefined
const recordScroll = () => {
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(writeScroll, 100)
}

if (inBrowser) {
    // VitePress's go() replaces the leaving entry's state with
    // { scrollPosition } just before pushing the new entry, which would drop the
    // key above. Carry the key over when a replacement for the same entry
    // (no URL argument) does not set it itself.
    const replaceState = history.replaceState.bind(history)
    history.replaceState = (data: any, unused: string, url?: string | URL | null) => {
        const kept = history.state?.[SCROLL_KEY]
        if (url == null && kept !== undefined && data && typeof data === 'object' && !(SCROLL_KEY in data)) {
            data = { ...data, [SCROLL_KEY]: kept }
        }
        return replaceState(data, unused, url)
    }
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

const onPopState = (e: PopStateEvent) => {
    // a pending write would land on the entry we just arrived at
    clearTimeout(scrollTimer)
    poppedPath = window.location.pathname
    const y = e.state?.[SCROLL_KEY]
    poppedScroll = typeof y === 'number' ? y : undefined
}

// Restores the container for the page that was just rendered: a hash target
// on a link navigation, the saved position on Back/Forward, otherwise the top.
const placeContainer = () => {
    bindScrollListener()
    const container = getContainer()
    const restore = poppedPath === route.path ? poppedScroll : undefined
    poppedPath = null
    poppedScroll = undefined
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
        poppedScroll = undefined
        // save the leaving entry's position now; go() replaces its state next
        clearTimeout(scrollTimer)
        writeScroll()
        return previousBefore?.(to)
    }
}

onMounted(() => {
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('click', handleSameHashClick, { capture: true })
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
    clearTimeout(scrollTimer)
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
        <template #nav-bar-content-before>
            <UtVersionSwitcher class="nav-version-switcher" :versioning-plugin="versioningPlugin" />
        </template>
        <template #nav-bar-content-after>
            <span class="nav-action-divider" aria-hidden="true"></span>
            <a class="developer-btn" href="https://panel.ultikits.com/developer" target="_blank">
                {{ lang.startsWith('zh') ? '开发者平台' : 'Dev Portal' }}
            </a>
            <div v-if="!hasSidebar" class="nav-bar-toolbar">
                <SidebarTranslations placement="bottom" />
                <VPNavBarAppearance />
            </div>
        </template>
        <template #nav-screen-content-after>
            <UtVersionSwitcher :versioning-plugin="versioningPlugin" screen-menu />
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
   不改用默认菜单，是因为导航入口已由 tab 行承载：≥960px 时放出默认菜单
   会在导航栏里重复同一批入口，768–959px 这一带则由手机菜单兜住。宽度
   不是这里的理由，实测放出默认菜单后，959px（英文）与 950px（中文）都
   不横向溢出。手机菜单是覆盖层，不参与该行的排布。
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

/* 版本切换器：桌面端在导航栏标题右侧，手机端在屏幕菜单底部。
   nav-bar-content-before 是 .content-body 的第一个节点，落点取决于内容区从
   哪里开始——见下面「有侧栏时把标题放回文档流」那条规则。
   <960px 时这一行要留给搜索、汉堡与开发者平台按钮，切换器只保留手机屏幕
   菜单里的那份。

   选择器写到 .VPNavBar .content-body> 这一层，是因为组件自身的 scoped
   `.UtVersionSwitcher[data-v-…] { display: flex }`（tab 行时代的高度对齐）会盖住
   裸类名 .nav-version-switcher，隐藏不掉。 */
.VPNavBar .content-body>.nav-version-switcher {
    display: none;
}

@media (min-width: 960px) {
    .VPNavBar .content-body>.nav-version-switcher {
        display: flex;
        margin-left: 16px;
    }

    .VPNavBar.has-sidebar .content-body>.nav-version-switcher {
        margin-left: 0;
    }
}

/* 有侧栏时把标题放回文档流，宽度收成内容宽度。
   VitePress 默认把标题做成 272px 宽的绝对定位块，正好盖住侧栏那一列，内容区
   也预留同样的 padding-left；于是放在 nav-bar-content-before 的版本切换器会
   被推到标题框右缘，与标题文字之间空出约 116px（1440px 视口实测：文字止于
   155.5px，切换器起于 272px），看上去像被标题挤出去了。收窄之后标题只占自己
   的宽度，切换器紧接其后，搜索框等也从标题右缘排起。
   侧栏与正文卡片由 .VPSidebar / .VPDoc 各自定位，不读标题的这一列，不受影响；
   导航栏底部那条 1px 分隔线收窄后仍是整条连续，实测 y=64 一整行都是
   #2e2e32，标题右缘之外没有断口。
   上游这三条规则都带 scoped 属性选择器（≥1440px 那条还改写宽度），故用
   !important 覆盖，与本文件既有的覆盖写法一致。 */
@media (min-width: 960px) {
    .VPNavBar.has-sidebar .container>.title {
        position: static !important;
        width: max-content !important;
        max-width: none !important;
        padding-right: 16px !important;
    }

    .VPNavBar.has-sidebar .content {
        padding-left: 0 !important;
    }
}

/* 搜索按钮的底色。
   上游 VPNavBarSearchButton.vue 在 >=768px 给 .DocSearch-Button 铺
   var(--vp-c-bg-alt)；本站主题把 --vp-c-bg-alt 设成与 --vp-c-bg 相同的
   #000000 / #ffffff，这层底色于是与导航栏同色，按钮只剩图标、文字与 ⌘K 的
   描边。改用主题的 default-soft：深色是 rgba(101,117,133,0.16)，叠在黑色
   导航栏上约 #101315；浅色是 rgba(142,150,170,0.14)，叠在白色上约 #eff0f3。
   搜索按钮因此成为一块与导航栏分开的输入框。
   hover 时上游把 background 重置回 --vp-c-bg-alt，这里一并按住，只保留它
   那条品牌蓝描边。<768px 不动：那一档按钮是 48×55 的纯图标，本来就不铺底。 */
@media (min-width: 768px) {
    .VPNavBar .VPNavBarSearch .DocSearch-Button {
        background-color: var(--vp-c-default-soft);
    }

    .VPNavBar .VPNavBarSearch .DocSearch-Button:hover {
        background-color: var(--vp-c-default-soft);
    }
}

/* 社交链接与开发者平台按钮之间的分割线。
   上游 VPNavBar 自带的那条画在社交链接左侧（VPNavBar.vue 里
   `.appearance + .social-links::before` 一类的相邻兄弟规则，本站藏掉菜单、
   语言、外观三个节点后它仍然生效），本条把那条收起，并在按钮一侧补一条
   同规格的竖线：1px × 24px、--vp-c-divider，与上游一致。
   显示宽度跟随社交链接：上游 VPNavBarSocialLinks 只在 >=1280px 时进这一行，
   更窄时社交链接收进 VPNavBarExtra 的 flyout，本线随之不显示，与改动前
   该宽度的形态一致。 */
.VPNavBar .content-body>.VPNavBarSocialLinks.social-links::before {
    display: none !important;
}

.nav-action-divider {
    display: none;
}

@media (min-width: 1280px) {
    .nav-action-divider {
        display: block;
        flex: 0 0 auto;
        width: 1px;
        height: 24px;
        /* 左 8 是因为社交链接的 <a> 自带 8px 内缩（36px 命中区套 20px 图标），
           与右侧 16 合起来，两侧的光学间距都是 16px。 */
        margin-left: 8px;
        margin-right: 16px;
        background-color: var(--vp-c-divider);
    }
}

</style>
