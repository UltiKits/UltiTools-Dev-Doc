<script lang="ts">
// ── Dismissal state: module scope, on purpose ───────────────────────────────
// A normal <script> block runs in module scope exactly once, while <script
// setup> below runs per component instance (Vue SFC spec). That difference is
// the whole mechanism: this object outlives the component across client-side
// navigation, and dies when the theme chunk is re-evaluated on a full reload.
//
// Maintainer-specified lifetime (2026-09-04): dismissal survives in-site
// navigation but NOT a page reload. localStorage and sessionStorage both
// survive a reload, so neither can express this — module state is not a
// shortcut here, it is the only storage with the requested lifetime.
//
// Keyed by version state rather than a single global flag, also specified: the
// archived bar and the alpha bar warn about different things ("this content is
// outdated" versus "this content may change under you"), so dismissing one must
// leave the other free to appear.
//
// SSR: the object is created once per module evaluation and its only mutation
// site is the click handler, which cannot fire during a build. Server render and
// first client render therefore both read false, and no hydration mismatch is
// introduced. Asserted in scripts/check-rendered-links.sh section 3c, which
// requires the control to be present in the built HTML of every notice bar.
import { reactive } from 'vue';

const dismissed = reactive<Record<'archived' | 'alpha', boolean>>({
  archived: false,
  alpha: false,
});
</script>

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

// ── Dismissal (maintainer request, 2026-09-04) ──────────────────────────────
// `visible`, not `state`, is what drives both the v-if and the height write-back
// below. Routing the close button through the same computed that already gates
// the current-release case means dismissal reuses the cleanup path that case
// already proved, instead of adding a second one beside it.

// Feeds aria-label and nothing else. It was also bound to title, which reads as
// a harmless duplicate and is not: aria-label supplies the accessible NAME and
// title supplies the accessible DESCRIPTION, so a screen reader announced the
// same sentence twice. Dropping title rather than aria-label costs the hover
// tooltip a sighted mouse user got on this icon-only button, which is the
// cheaper loss -- title is not exposed on touch at all, and
// scripts/check-rendered-links.sh section 3c asserts the name through
// aria-label, so title was never the channel being verified.
const dismissLabel = computed(() => (isZh.value ? '关闭此提示' : 'Dismiss this notice'));

const visible = computed(
  () => state.value !== 'current' && !dismissed[state.value as 'archived' | 'alpha']
);

// The early return is not dead code even though the button only renders under
// v-if="visible", which already requires state !== 'current'. It is what narrows
// `key` to the two keys `dismissed` actually has, so the write below needs no
// type assertion: the runtime check and the type are the same statement rather
// than a cast asserting an invariant enforced somewhere else in the file.
//
// Retargeting focus is the other half of the fix. Activating this control
// removes the focused button from the DOM along with the bar, so without a
// retarget focus is destroyed: measured in headless Chromium, document
// .activeElement becomes <body> the moment the bar is removed. That is the
// WCAG 2.4.3 failure -- a screen reader loses its place and the reader gets no
// announcement of where they now are.
//
// Measured rather than assumed, because the obvious next claim is wrong here:
// the following Tab does NOT restart from the top of the document in Chrome. It
// landed on .VPNavBarMenuLink, because the spec's sequential focus navigation
// starting point is set to the removed element's position. Chrome's mitigation
// is real and is not a substitute -- it repairs the Tab sequence, not the lost
// focus, and it is a per-engine behaviour rather than something to rely on.
//
// The bar renders above VPNav, so VPNav's first focusable is the element the
// reader would have reached next anyway. After the fix focus lands on a.title
// (the localised home link: href="/" on English pages, "/zh/" on Chinese ones)
// and the next Tab continues to the search button. nextTick, because the
// element must be gone before focus moves; moving it first would let Vue's
// removal reset focus to <body> again.
const dismiss = () => {
  const key = state.value;
  if (key === 'current') return;
  dismissed[key] = true;
  nextTick(() => {
    document.querySelector<HTMLElement>('.VPNav a[href], .VPNav button')?.focus();
  });
};

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
//
// Dismissal is the same failure with a second trigger. The v-if sits on the
// ROOT element, so flipping it false removes the element without unmounting the
// component and onUnmounted never runs. The watcher below is therefore what
// clears the variable on dismissal too — otherwise the bar would vanish while
// the blank strip it reserved stayed for the rest of the session. It watches
// `visible` for exactly that reason, and still watches `state` alongside it for
// the archived -> alpha case, where `visible` stays true throughout and only
// re-observing the patched element keeps the height correct.

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
  if (visible.value) startObserving();
});

onUnmounted(stopObserving);

watch([visible, state], ([isVisible]) => {
  if (!isVisible) {
    stopObserving();
  } else {
    nextTick(startObserving);
  }
});
</script>

<template>
  <div
    v-if="visible"
    ref="barRef"
    class="VersionNoticeBar"
    :class="`VersionNoticeBar--${state}`"
    :data-ut-version-state="state"
  >
    <div class="notice-content">
      <p class="notice-row notice-state">
        <span class="notice-label">{{ stateLabel }}</span>
        {{ stateSentence }}
      </p>
      <p v-if="state === 'alpha'" class="notice-row notice-meta">{{ alphaMeta }}</p>
      <p v-else class="notice-row">
        <a class="notice-link" :href="noticeHref" :data-ut-notice-link="noticeHref">{{ noticeLinkText }}</a>
      </p>
    </div>
    <button
      type="button"
      class="notice-dismiss"
      data-ut-notice-dismiss
      :aria-label="dismissLabel"
      @click="dismiss"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path
          d="M4 4 L12 12 M12 4 L4 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
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
    display: flex;
    align-items: flex-start;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
    padding: 16px;
    border-bottom: 1px solid var(--vp-c-divider);
    font-size: 14px;
    line-height: 1.5;
    color: var(--vp-c-text-1);
}

/* min-width: 0 is load-bearing, not defensive: without it this flex item takes
   its max-content width as its floor, so .notice-meta's nowrap commit line
   would push the bar wider than the viewport instead of scrolling inside its
   own overflow-x: auto. */
.notice-content {
    flex: 1;
    min-width: 0;
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

/* Below 960px the commit line is allowed to wrap instead of scrolling inside
   itself. Measured: its content is 267px wide while the available column is
   248px at a 320px viewport (the bar's 32px of padding plus the close control's
   24px and its 16px gap), so at <=345px it overflowed and the reader had to
   drag that one line sideways to finish reading it. That line carries the
   injected commit and timestamp, which are the only detector for the nightly
   alpha sync silently stopping — a value that must be dragged into view is a
   detector that will not be read on a phone.

   This also removes a platform-dependent height: while the row overflowed it
   grew by the horizontal scrollbar's 15px on classic-scrollbar platforms and by
   0px on overlay-scrollbar ones (measured: 179px vs 164px for the same bar at
   320px). Wrapping makes the two agree, so the static fallback below is one
   number rather than a bet on which scrollbar model the reader has.

   nowrap is kept at >=960px, where the line always fits and the hash and the
   timestamp read as one unit. */
@media (max-width: 959px) {
    .notice-meta {
        white-space: normal;
        overflow-x: visible;
    }
}

/* The close control carries no accent colour. 04-UI-SPEC.md § Color reserves
   accent to two elements in this bar — the CTA link and the state-label word —
   and states the check as "never a third", so the button inherits --vp-c-text-1
   from the bar and its focus ring uses that same token. 24px square and the
   16px gap keep it on the 4px grid; both are smaller than the two content rows
   it sits beside, so the control adds no height of its own at any width. */
.notice-dismiss {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background-color: transparent;
    color: inherit;
    cursor: pointer;
}

/* --vp-c-bg, not an accent token: on both -soft state backgrounds this reads as
   a subtle lighter square in light mode and a darker one in dark mode. */
.notice-dismiss:hover {
    background-color: var(--vp-c-bg);
}

.notice-dismiss:focus-visible {
    outline: 2px solid var(--vp-c-text-1);
    outline-offset: 2px;
}
</style>
