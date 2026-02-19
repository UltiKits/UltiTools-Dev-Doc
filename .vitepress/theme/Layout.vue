<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { inBrowser, useData, useRoute } from 'vitepress'
import { watchEffect, nextTick, watch, onMounted, onUnmounted } from 'vue'
// @ts-ignore
import SecondNavBar from './components/SecondNavBar.vue'
// @ts-ignore
import SidebarTranslations from './components/SidebarTranslations.vue'
// @ts-ignore
import VPNavBarAppearance from 'vitepress/dist/client/theme-default/components/VPNavBarAppearance.vue'
import { NolebaseEnhancedReadabilitiesMenu, NolebaseEnhancedReadabilitiesScreenMenu } from '@nolebase/vitepress-plugin-enhanced-readabilities/client'
import { NolebaseHighlightTargetedHeading } from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import ReloadPrompt from './components/ReloadPrompt.vue'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'

const { Layout } = DefaultTheme
const { lang, frontmatter } = useData()
const route = useRoute()

// 修复锚点定位问题
const scrollToHash = (hash: string) => {
    if (!inBrowser) return
    nextTick(() => {
        // 解码 hash，例如 #%E4%B8%AD%E6%96%87 -> #中文
        const selector = decodeURIComponent(hash)
        let target: HTMLElement | null = null
        try {
            target = document.querySelector(selector) as HTMLElement
        } catch (e) {
            console.warn('Invalid hash selector:', selector)
        }

        const container = document.querySelector('.VPDoc .container') as HTMLElement
        if (target && container) {
            const targetRect = target.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            const scrollTop = container.scrollTop

            // 目标位置 = 当前滚动位置 + (目标视口坐标 - 容器视口坐标) - 顶部留白
            container.scrollTo({
                top: scrollTop + targetRect.top - containerRect.top - 20,
                behavior: 'smooth'
            })
        }
    })
}

const handleHashChange = () => {
    if (window.location.hash) {
        scrollToHash(window.location.hash)
    }
}

// 手动处理 Outline 高亮
const updateActiveOutline = () => {
    const container = document.querySelector('.VPDoc .container')
    if (!container) return

    // 获取所有 header 元素
    const headers = Array.from(container.querySelectorAll('.vp-doc :where(h1,h2,h3,h4,h5,h6)'))
        .filter((el) => el.id && el.hasChildNodes())
        .map((el) => {
            // 计算 header 相对于 container 的位置
            const rect = el.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            return {
                link: '#' + el.id,
                // 这里要用 scrollTop + 相对 top
                // 或者直接用相对 container top 的偏移
                top: rect.top - containerRect.top + container.scrollTop
            }
        })

    if (!headers.length) return

    const scrollTop = container.scrollTop
    // 偏移量，使得 header 滚动到顶部下方一点时激活
    const offset = 100

    let activeLink: string | null = null
    for (const { link, top } of headers) {
        if (top > scrollTop + offset) {
            break
        }
        activeLink = link
    }

    const outline = document.querySelector('.VPDocAsideOutline')
    if (!outline) return

    const marker = outline.querySelector('.outline-marker') as HTMLElement
    const links = Array.from(outline.querySelectorAll('.VPDocOutlineItem a')) as HTMLAnchorElement[]

    let foundActive = false
    links.forEach(link => {
        const href = link.getAttribute('href')
        // 解码 href 以匹配 id (中文 id)
        const decodedHref = decodeURIComponent(href || '')
        const decodedActive = decodeURIComponent(activeLink || '')

        if (activeLink && decodedHref === decodedActive) {
            link.classList.add('active')
            if (marker) {
                marker.style.top = link.offsetTop + 33 + 'px' // 33px 是大致偏移，源码是 39 或 33
                marker.style.opacity = '1'
            }
            foundActive = true

            // 自动修改 hash，但不触发滚动（replaceState）
            // 避免重复 replace
            if (decodeURIComponent(window.location.hash) !== decodedActive) {
                history.replaceState(null, '', activeLink)
            }
        } else {
            link.classList.remove('active')
        }
    })

    if (!foundActive && marker) {
        // 如果没有激活的，隐藏 marker
        marker.style.opacity = '0'
    }
}

// 简单的 throttle
function throttle(func: Function, limit: number) {
    let inThrottle: boolean
    return function (this: any) {
        const args = arguments
        const context = this
        if (!inThrottle) {
            func.apply(context, args)
            inThrottle = true
            setTimeout(() => inThrottle = false, limit)
        }
    }
}

const throttledUpdateOutline = throttle(updateActiveOutline, 100)

const bindScrollListener = () => {
    const container = document.querySelector('.VPDoc .container')
    if (container) {
        container.removeEventListener('scroll', throttledUpdateOutline)
        container.addEventListener('scroll', throttledUpdateOutline)
        // 立即更新一次
        updateActiveOutline()
    }
}

onMounted(() => {
    if (inBrowser) {
        window.addEventListener('hashchange', handleHashChange)
        // 初始加载
        if (window.location.hash) {
            setTimeout(() => scrollToHash(window.location.hash), 100)
        }

        // 初始绑定
        setTimeout(bindScrollListener, 500)
    }
})

onUnmounted(() => {
    if (inBrowser) {
        window.removeEventListener('hashchange', handleHashChange)
        const container = document.querySelector('.VPDoc .container')
        if (container) {
            container.removeEventListener('scroll', throttledUpdateOutline)
        }
    }
})

// 监听路径变化（切换页面时）
watch(
    () => route.path,
    () => {
        // 页面切换，重置滚动位置并重新绑定
        nextTick(() => {
            // 延迟执行以等待 DOM 更新
            setTimeout(() => {
                bindScrollListener()

                // 如果带 hash，滚动到 hash
                if (window.location.hash) {
                    scrollToHash(window.location.hash)
                } else {
                    // 否则滚动到顶部
                    const container = document.querySelector('.VPDoc .container')
                    if (container) container.scrollTop = 0
                }
            }, 200)
        })
    }
)

if (inBrowser) {
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
}

watchEffect(() => {
    let language = lang.value.split('-')[0];
    if (language === 'zh') {
        language = 'zh-CN'
    }
    // Obtain configuration from: https://giscus.app/
    giscusTalk({
        repo: 'UltiKits/UltiTools-Dev-Doc',
        repoId: 'R_kgDOKHynCA',
        category: 'General',
        categoryId: 'DIC_kwDOKHynCM4Cb4Le',
        mapping: 'pathname',
        inputPosition: 'top',
        lang: `${language}`,
        lightTheme: 'light',
        darkTheme: 'transparent_dark',
        // ...
    }, {
        frontmatter, route
    },
        true
    );
})
</script>

<template>
    <Layout>
        <template #nav-bar-content-after>
            <a class="developer-btn" href="https://panel.ultikits.com/developer" target="_blank">
                {{ lang.startsWith('zh') ? '开发者平台' : 'Dev Portal' }}
            </a>
            <NolebaseEnhancedReadabilitiesMenu />
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

/* 隐藏 Navbar 上的语言和外观切换 */
.VPNavBar .content-body>.VPNavBarTranslations,
.VPNavBar .content-body>.VPNavBarAppearance {
    display: none !important;
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
    height: calc(100vh - var(--vp-nav-height));
    overflow: hidden;
    padding: 20px !important;
    padding-top: 64px !important;
    box-sizing: border-box;
}

.VPDoc .container {
    position: relative;
    height: 100%;
    overflow-y: auto;
    border-radius: 16px;
    border: 1px solid var(--vp-c-divider);
    background-color: var(--vp-c-bg);
    box-shadow: 0 4px 24px var(--vp-c-bg-alt);
    padding: 32px;
    /* 隐藏默认滚动条但允许滚动 */
    scrollbar-width: thin;

    /* 强制 Flex 布局，确保 Aside 高度被拉伸 */
    display: flex !important;
    align-items: stretch !important;
}

/* 修改 Aside 定位，使其包含在容器内 */
.VPDoc .aside-container {
    top: 128px !important;
    padding-top: 0 !important;
    max-height: calc(100vh - var(--vp-nav-height) - 84px) !important;
    overflow-y: auto !important;
}

.VPDocAsideOutline.has-outline .content {
    padding-top: 32px !important;
}

.VPDocAsideOutline.has-outline .content .outline-marker {
    margin-top: 38px !important;
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

/* 强制显示 */
.sidebar-bottom-toolbar :deep(.sidebar-translations),
.sidebar-bottom-toolbar :deep(.VPNavBarAppearance) {
    display: flex !important;
}

/* 修复侧边栏工具栏贴底问题 */
.VPSidebar {
    padding-bottom: 0 !important;
}

.VPSidebar>.nav {
    /* 确保 nav 至少占满可视高度，减去 top padding */
    min-height: calc(100vh - var(--vp-nav-height) - 32px);
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
    background-color: var(--vp-c-bg-alt);
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
