<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, ref } from 'vue'

const { site, localeIndex, page, theme, hash } = useData()

const open = ref(false)

function ensureStartingSlash(path: string): string {
  return /^\//.test(path) ? path : `/${path}`
}

function normalizeLink(
  link: string,
  addPath: boolean,
  path: string,
  addExt: boolean
) {
  return addPath
    ? link.replace(/\/$/, '') +
    ensureStartingSlash(
      path
        .replace(/(^|\/)index\.md$/, '$1')
        .replace(/\.md$/, addExt ? '.html' : '')
    )
    : link
}

const currentLang = computed(() => {
  return {
    label: site.value.locales[localeIndex.value]?.label,
    link:
      site.value.locales[localeIndex.value]?.link ||
      (localeIndex.value === 'root' ? '/' : `/${localeIndex.value}/`)
  }
})

const localeLinks = computed(() => {
  const links: any[] = Object.entries(site.value.locales).flatMap(([key, value]) =>
    currentLang.value.label === value.label
      ? []
      : {
        text: value.label,
        link:
          normalizeLink(
            value.link || (key === 'root' ? '/' : `/${key}/`),
            theme.value.i18nRouting !== false,
            page.value.relativePath.slice(
              currentLang.value.link.length - 1
            ),
            !site.value.cleanUrls
          ) + hash.value
      }
  )

  // 过滤掉 text 为空的项目
  const filteredLinks = links.filter(item => item.text && item.text.trim() !== '')

  // 添加当前语言（不可点击）
  if (currentLang.value.label) {
    filteredLinks.unshift({
      text: currentLang.value.label,
      link: '',
      isCurrent: true
    })
  }

  return filteredLinks
})
</script>

<template>
  <div class="sidebar-translations" @mouseleave="open = false">
    <button class="trigger" @click="open = !open">
      <span class="vpi-languages icon"></span>
      <span class="text">{{ currentLang.label }}</span>
    </button>

    <div class="menu" :class="{ open }">
      <div class="menu-content">
        <template v-for="item in localeLinks" :key="item.text">
          <span v-if="item.isCurrent" class="item current">
            {{ item.text }}
            <span class="vpi-check icon-check"></span>
          </span>
          <a v-else :href="item.link" class="item">
            {{ item.text }}
          </a>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ... existing styles ... */
.icon-check {
  margin-left: auto;
  font-size: 14px;
  color: var(--vp-c-brand);
}

.item.current {
  cursor: default;
  color: var(--vp-c-brand);
  font-weight: 600;
  display: flex;
  align-items: center;
}

.sidebar-translations {
  position: relative;
  display: flex;
  align-items: center;
}

.trigger {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  min-width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
  transition: color 0.25s, background-color 0.25s;
  padding: 0 8px;
}

.text {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.trigger:hover {
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-alt);
}

.icon {
  font-size: 20px;
}

.menu {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  padding-bottom: 10px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s, transform 0.25s, visibility 0.25s;
  z-index: 20;
}

.menu.open {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.menu-content {
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 4px;
  box-shadow: var(--vp-shadow-2);
  min-width: 120px;
}

.item {
  display: block;
  padding: 6px 12px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color 0.25s, color 0.25s;
}

.item:hover {
  color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-alt);
}
</style>
