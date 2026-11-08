<script setup lang="ts">
// Language switch shown at the bottom of the sidebar (and, on pages without a
// sidebar, in the nav bar). The language list and links come from
// ../composables/versioned-langs.ts, the same code that config.mts substitutes
// for VitePress's own useLangs(), so this switch and the default theme's
// language menus always agree. See that file for why VitePress's version
// does not work with archived versions.
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useLangs } from '../composables/versioned-langs'

const props = withDefaults(defineProps<{ placement?: 'top' | 'bottom' }>(), { placement: 'top' })

const { page, theme } = useData()
const { currentLang, localeLinks } = useLangs({ correspondingLink: true })

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const relativePath = computed(() => page.value.relativePath)

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
    v-if="currentLang.label && localeLinks.length"
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
