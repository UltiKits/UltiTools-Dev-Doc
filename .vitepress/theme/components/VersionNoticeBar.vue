<script setup lang="ts">
// Version-state notice bar. Three DOM outcomes, not three CSS states of one
// node: an archived bar, an alpha bar, and — on the current release — nothing
// at all. VER-07 is satisfied by rendering no node, never by hiding one, which
// is why the root element carries a v-if rather than a display rule.
//
// The manifest is imported as a module rather than routed through themeConfig
// on purpose, deviating from 04-RESEARCH.md's "import 进 themeConfig"
// suggestion. Measured: this site inlines its site data into every built page
// (each page's HTML is already ~160KB), so a 12.5KB manifest placed in
// themeConfig would be paid 393 times over, while a module import lands once in
// the cached theme chunk. The import is unconditional and makes no existsSync
// check of its own (D-46); scripts/generate-version-pages.mjs runs from both
// the build and the dev scripts and is what guarantees the file is there.
import { useData, useRoute } from 'vitepress';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
// @ts-ignore — generated at build time, no type declarations emitted
import { CURRENT_VERSION, KNOWN_VERSIONS, VERSION_PAGES } from '../../config/version-pages.generated.mjs';
import { activeVersion, buildPath, pageExists, versionState } from './versioning';

const { lang, frontmatter } = useData();
const route = useRoute();

const relativePath = computed(() => route.data.relativePath);
const version = computed(() => activeVersion(relativePath.value, KNOWN_VERSIONS, CURRENT_VERSION));
const state = computed(() => versionState(version.value, CURRENT_VERSION));

// Same locale idiom as the sibling component mounted in this slot
// (SecondNavBar.vue:9), rather than a fourth idiom in a repo that already has
// three and no shared i18n helper. Verified on the build artifact that this
// resolves correctly on archived Chinese pages too: /v6.2.1/zh/guide/
// introduction.html renders <html lang="zh-CN"> and SecondNavBar's own
// lang.startsWith('zh') branch renders its Chinese copy there.
const isZh = computed(() => lang.value.startsWith('zh'));

// ── Copy, verbatim from 04-UI-SPEC.md § Copywriting Contract ────────────────
// The alpha sentence is not new copy: it is the already-reviewed sentence
// scripts/inject-alpha.mjs currently emits, with the ::: warning title line
// dropped (the bar's background carries that signal now) and a version-number
// lead-in prepended.

const stateLabel = computed(() => {
  if (state.value === 'alpha') {
    return isZh.value ? `未发布版本 ${version.value}。` : `Unreleased version ${version.value}.`;
  }
  return isZh.value ? `历史版本 ${version.value}。` : `Archived version ${version.value}.`;
});

const stateSentence = computed(() => {
  if (state.value === 'alpha') {
    return isZh.value
      ? '本页内容来自 alpha 分支，随时可能变更，不属于任何已发布版本。'
      : 'This page describes the alpha branch and may change at any time; it is not part of any released version.';
  }
  return isZh.value
    ? '本页内容为历史发布版本，不再接受更新。'
    : 'This page describes a past release and will not receive further updates.';
});

// ── Archived state: the one-click route into the current release (VER-05) ───
// D-58: when the same page exists in the current release, link straight at it;
// otherwise fall back to that release's locale root under DIFFERENT wording, so
// a fallback reads as a fallback rather than as the same promise pointing
// somewhere else.

const hasSamePage = computed(() =>
  pageExists(CURRENT_VERSION, relativePath.value, KNOWN_VERSIONS, VERSION_PAGES)
);

const localeRoot = computed(() =>
  buildPath(CURRENT_VERSION, isZh.value ? 'zh/index.md' : 'index.md', KNOWN_VERSIONS, CURRENT_VERSION)
);

const noticeHref = computed(() =>
  hasSamePage.value
    ? buildPath(CURRENT_VERSION, relativePath.value, KNOWN_VERSIONS, CURRENT_VERSION)
    : localeRoot.value
);

const noticeLinkText = computed(() => {
  if (hasSamePage.value) {
    return isZh.value ? `查看本页在 ${CURRENT_VERSION} 中的版本 →` : `View this page in ${CURRENT_VERSION} →`;
  }
  return isZh.value ? '前往最新版 →' : 'Go to the latest version →';
});

// ── Alpha state: commit and injection time (VER-06) ─────────────────────────
// scripts/inject-alpha.mjs writes alphaCommit / alphaInjectedAt onto EVERY
// markdown file in the SNAPSHOT tree, so both values arrive with SSR and need
// no fetch. This row is mandatory and never collapsible: per 03-CONTEXT.md
// D-43 the visible injection timestamp is the only channel by which a silently
// auto-disabled nightly sync is detectable at all.
//
// The timestamp is formatted by slicing the ISO string. Do not reach for a
// locale-aware date formatter here: those resolve against the host's timezone
// and locale, so the server would produce one string and the browser another,
// which is precisely the hydration mismatch ROADMAP criterion 5 forbids.

const shortSha = computed(() => String(frontmatter.value.alphaCommit ?? '').slice(0, 7) || 'unknown');

const injectedAt = computed(() => {
  const iso = String(frontmatter.value.alphaInjectedAt ?? '');
  return iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : 'unknown';
});

const alphaMeta = computed(() =>
  isZh.value
    ? `commit ${shortSha.value} · 注入于 ${injectedAt.value} UTC`
    : `commit ${shortSha.value} · ${injectedAt.value} UTC`
);

// ── Height write-back: the single write site for --vp-layout-top-height ─────
// The variable carries ONLY this bar's height. It must not include
// SecondNavBar's 48px: measured, setting the variable moves VPNav, VPSidebar,
// VPContent and the article card while .SecondNavBar stays put at top: 64px and
// ends up overlapping the nav. The variable means "chrome above VPNav"; the tab
// row is chrome below it and gets its own variable in plan 04-04.
//
// Two cleanup paths are needed, and the second is the one that is easy to miss.
// Client-side navigation from an archived page to a current-release page does
// NOT unmount this component — only the inner v-if flips — so without the
// watcher the variable survives and the whole site keeps a permanent blank
// strip above the nav, which is a direct VER-07 failure.

const barRef = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;

const writeHeight = () => {
  const el = barRef.value;
  if (!el) return;
  document.documentElement.style.setProperty('--vp-layout-top-height', `${el.offsetHeight}px`);
};

const stopObserving = () => {
  observer?.disconnect();
  observer = undefined;
  document.documentElement.style.removeProperty('--vp-layout-top-height');
};

const startObserving = () => {
  const el = barRef.value;
  if (!el) return;
  // archived -> alpha (and back) changes state without ever passing through
  // 'current', so the watcher below re-enters here while a live observer is
  // still held. v-if stays truthy across that transition, so Vue patches the
  // same element in place and barRef is unchanged — the old observer keeps
  // observing it, and overwriting the reference would make it undisconnectable.
  // Reachable in one SPA: a build:with-alpha artifact carries both the
  // archived trees and v6.3.0-SNAPSHOT.
  observer?.disconnect();
  writeHeight();
  observer = new ResizeObserver(writeHeight);
  observer.observe(el);
};

onMounted(() => {
  if (state.value !== 'current') startObserving();
});

onUnmounted(stopObserving);

watch(state, (next) => {
  if (next === 'current') {
    stopObserving();
  } else {
    nextTick(startObserving);
  }
});
</script>

<template>
  <div
    v-if="state !== 'current'"
    ref="barRef"
    class="VersionNoticeBar"
    :class="`VersionNoticeBar--${state}`"
    :data-ut-version-state="state"
  >
    <p class="notice-row notice-state">
      <span class="notice-label">{{ stateLabel }}</span>
      {{ stateSentence }}
    </p>
    <p v-if="state === 'alpha'" class="notice-row notice-meta">{{ alphaMeta }}</p>
    <p v-else class="notice-row">
      <a class="notice-link" :href="noticeHref" :data-ut-notice-link="noticeHref">{{ noticeLinkText }}</a>
    </p>
  </div>
</template>

<style scoped>
/* One positioning rule, no breakpoint branch. Measured against the three
   alternatives (in-flow with and without the height variable, and sticky):
   fixed is the only one that lands every element where intended at BOTH 1440px
   and 375px. Below 960px VPNav is position: relative, so an in-flow bar
   displaces it once in flow and again through the variable; a fixed bar
   occupies no flow, which makes the variable the single source of downward
   push. */
.VersionNoticeBar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: var(--vp-z-index-layout-top);
    width: 100%;
    box-sizing: border-box;
    padding: 16px;
    border-bottom: 1px solid var(--vp-c-divider);
    font-size: 14px;
    line-height: 1.5;
    color: var(--vp-c-text-1);
}

@media (min-width: 960px) {
    .VersionNoticeBar {
        padding: 16px 24px;
    }
}

/* Archived reads as informational: the same -soft / text-1 pairing VitePress
   itself uses for its ::: info and ::: note blocks. */
.VersionNoticeBar--archived {
    background-color: var(--vp-c-default-soft);
}

/* Alpha reads as caution: the same family as the ::: warning block it takes
   over. The two states are distinguishable by hue before a word is read. */
.VersionNoticeBar--alpha {
    background-color: var(--vp-c-warning-soft);
}

.notice-row {
    margin: 0;
}

.notice-row + .notice-row {
    margin-top: 8px;
}

.notice-label {
    font-weight: 600;
}

.VersionNoticeBar--alpha .notice-label {
    color: var(--vp-c-warning-1);
}

.notice-link {
    color: var(--vp-c-brand-1);
    font-weight: 600;
    text-decoration: none;
}

.notice-link:hover {
    text-decoration: underline;
}

/* De-emphasised by size and font, not by contrast: --vp-c-text-2 measures
   4.36:1 on the dark warning background, under this repo's own 4.5:1 floor
   (scripts/check-contrast.py, D-24). */
.notice-meta {
    font-family: var(--vp-font-family-mono);
    font-size: 12px;
    color: var(--vp-c-text-1);
    white-space: nowrap;
    overflow-x: auto;
}
</style>
