<script setup lang="ts">
// Language switch shown at the bottom of the sidebar (and, on pages without a
// sidebar, in the nav bar).
//
// It does not use VitePress's useLangs(). @viteplus/versions adds one locale
// per archived version (`v6.2.0`, `zh/v6.2.0`, ...) whose label is a single
// space, and VitePress resolves an archived page to that version locale, so
// useLangs() returns a blank current label and lists blank entries. It also
// builds the other-language link by prefix substitution without checking that
// the page exists there: v6.2.0-v6.2.4 have zh/guide/essentials/version-wrapper
// but no English counterpart, and the generated link was a 404.
//
// Here the languages are the locales whose label is not blank (no hand list of
// versions), the reader's language is taken from the page path, and the target
// page is checked against the build-time page manifest that the version switcher
// and the notice bar already use. A missing counterpart falls back to the same
// version's homepage in the other language. Every value derives from route data
// and site data, so server render and hydration agree.
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
// @ts-ignore generated at build time by scripts/generate-version-pages.mjs
import { CURRENT_VERSION, KNOWN_VERSIONS, VERSION_PAGES } from '../../config/version-pages.generated.mjs'
import { activeVersion, buildPath, pageExists } from './versioning'

const props = withDefaults(defineProps<{ placement?: 'top' | 'bottom' }>(), { placement: 'top' })

const { site, page, hash, lang, theme } = useData()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

interface Lang {
  key: string
  label: string
  // path prefix of this locale inside relativePath: '' for root, 'zh/' for zh
  prefix: string
}

const languages = computed<Lang[]>(() =>
  Object.entries(site.value.locales)
    .filter(([, value]) => typeof value.label === 'string' && value.label.trim() !== '')
    .map(([key, value]) => ({ key, label: value.label as string, prefix: key === 'root' ? '' : `${key}/` }))
)

const relativePath = computed(() => page.value.relativePath)

const currentLang = computed<Lang | undefined>(() => {
  const langs = languages.value
  // longest prefix wins; the root locale has the empty prefix and matches last
  const byPath = [...langs]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((l) => relativePath.value.startsWith(l.prefix))
  return byPath ?? langs.find((l) => site.value.locales[l.key]?.lang === lang.value)
})

const version = computed(() => activeVersion(relativePath.value, KNOWN_VERSIONS, CURRENT_VERSION))

const localeLinks = computed(() => {
  const current = currentLang.value
  if (!current) return []
  const rest = relativePath.value.slice(current.prefix.length)
  return languages.value
    .filter((l) => l.key !== current.key)
    .map((l) => {
      const target = l.prefix + rest
      const exists = pageExists(version.value, target, KNOWN_VERSIONS, VERSION_PAGES)
      const link = exists
        ? buildPath(version.value, target, KNOWN_VERSIONS, CURRENT_VERSION) + hash.value
        : buildPath(version.value, `${l.prefix}index.md`, KNOWN_VERSIONS, CURRENT_VERSION)
      return { text: l.label, link }
    })
})

function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    close()
    root.value?.querySelector<HTMLElement>('.trigger')?.focus()
  }
}

function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (!next || !root.value?.contains(next)) close()
}

function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}

watch(open, (isOpen) => {
  if (typeof document === 'undefined') return
  if (isOpen) document.addEventListener('pointerdown', onPointerDown, true)
  else document.removeEventListener('pointerdown', onPointerDown, true)
})

watch(relativePath, close)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('pointerdown', onPointerDown, true)
})
</script>

<template>
  <div
    v-if="currentLang && localeLinks.length"
    ref="root"
    class="sidebar-translations"
    :class="`placement-${props.placement}`"
    @mouseleave="close"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <button
      class="trigger"
      type="button"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="theme.langMenuLabel || 'Change language'"
      @click="open = !open"
    >
      <span class="vpi-languages icon"></span>
      <span class="text">{{ currentLang.label }}</span>
    </button>

    <div class="menu" :class="{ open }">
      <div class="menu-content">
        <span class="item current">
          {{ currentLang.label }}
          <span class="vpi-check icon-check"></span>
        </span>
        <a
          v-for="item in localeLinks"
          :key="item.text"
          :href="item.link"
          :tabindex="open ? 0 : -1"
          class="item"
          @click="close"
        >
          {{ item.text }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  background-color: var(--vp-c-default-soft);
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

/* nav-bar variant: the trigger sits at the top of the page, so open downwards */
.placement-bottom .menu {
  bottom: auto;
  top: 100%;
  padding-bottom: 0;
  padding-top: 10px;
  transform: translateX(-50%) translateY(-10px);
}

.placement-bottom .menu.open {
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
  background-color: var(--vp-c-default-soft);
}
</style>
