<script setup lang="ts">
// Thin wrapper around @viteplus/versions' own version-switcher.component.vue
// (node_modules/@viteplus/versions/components/version-switcher.component.vue).
// Reuses that component's derivation logic (D-62: "版本推导逻辑不要重写") and
// its desktop/mobile chrome (VPFlyout, the screen-menu accordion, VPMenuLink),
// and corrects the three things it gets wrong on this site:
//
//   1. Its buildVersionPath emits /<locale>/<version>/<rest>. This site serves
//      /<version>/<locale>/<rest> — measured, /zh/v6.2.4/guide/introduction.html
//      is a 404 while /v6.2.4/zh/guide/introduction.html is a 200
//      (04-RESEARCH.md finding 4, 04-CONTEXT.md 研究阶段更正 correction 4).
//      buildPath from ./versioning is used instead; it is never reimplemented
//      here.
//   2. Its mobile accordion hardcodes the button text to the literal string
//      "Switch Version" instead of the active version, and its mobile item
//      list additionally includes a row pointing at the reader's own page
//      (04-RESEARCH.md Pitfall 5). Both branches here share one filtered row
//      list and one active-version-derived label.
//   3. It always lands on a version's homepage rather than the same article,
//      even when the article exists in the target version. pageExists from
//      ./versioning (the same source of truth VersionNoticeBar.vue's D-58
//      fallback uses) decides per row whether to link to the same article or
//      to that version's locale root.
//
// props.versioningPlugin.versions is typed Set<string> by the upstream
// component, but the value populateNav actually injects at build time is a
// plain array (measured) — treated as an array throughout this file.
//
// Every value below derives from route data and build-time props. No
// typeof window / window.location / localStorage / matchMedia branch exists
// anywhere in this file, so SSR output and client hydration compute the same
// string and no hydration mismatch can fire (same rule
// version-switcher.component.vue:35-46 already relies on).
import { computed, ref } from 'vue';
import { useData, useRoute } from 'vitepress';
// @ts-ignore
import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue';
// @ts-ignore
import VPMenuLink from 'vitepress/dist/client/theme-default/components/VPMenuLink.vue';
// @ts-ignore — generated at build time, no type declarations emitted. Same
// manifest VersionNoticeBar.vue reads, so the notice bar and this switcher
// cannot disagree about whether a given target page exists.
import { VERSION_PAGES } from '../../config/version-pages.generated.mjs';
import { activeVersion, buildPath, pageExists, versionState } from './versioning';

interface VersioningPlugin {
  versions: string[];
  currentVersion: string;
}

interface Props {
  versioningPlugin: VersioningPlugin;
  screenMenu?: boolean;
}

const props = defineProps<Props>();
const route = useRoute();
const { lang } = useData();
const isOpen = ref(false);

const isZh = computed(() => lang.value.startsWith('zh'));
const relativePath = computed(() => route.data.relativePath);
const versions = computed(() => props.versioningPlugin.versions);
const current = computed(() => props.versioningPlugin.currentVersion);

const active = computed(() =>
  activeVersion(relativePath.value, versions.value, current.value)
);

// The current version plus every other known version, active one filtered
// out. One shared list for both branches — the upstream mobile branch
// iterates the unfiltered list and additionally renders the current version
// separately, which is exactly the self-row defect this removes.
//
// The sort is not cosmetic. @viteplus/versions populates props.versioningPlugin
// .versions from readdirSync(archivePath) with no sort of its own
// (dist/index.js, StateModel.init), and readdir order on an ext4 dir_index
// filesystem is hash order — the reader can be shown v6.2.3, v6.1.0, v6.2.4,
// v6.2.0, and the order is not stable across machines or across the archive
// directory being recreated. Ascending is chosen because it is what this site
// already renders on the machines where readdir happens to return sorted
// names, so making the order deterministic changes no reader's view.
// scripts/generate-version-pages.mjs sorts the same names the same way; like
// that one, this is a lexicographic sort and would place a future v6.10.0
// before v6.9.0.
const rowVersions = computed(() =>
  [current.value, ...[...versions.value].sort()].filter((v) => v !== active.value)
);

interface VersionRow {
  version: string;
  href: string;
  unreleased: boolean;
}

const rows = computed<VersionRow[]>(() =>
  rowVersions.value.map((target) => {
    const samePage = pageExists(target, relativePath.value, versions.value, VERSION_PAGES);
    const fallbackRelativePath = isZh.value ? 'zh/index.md' : 'index.md';
    const href = buildPath(
      target,
      samePage ? relativePath.value : fallbackRelativePath,
      versions.value,
      current.value
    );
    return {
      version: target,
      href,
      // versioning.ts owns the alpha rule (versionState -> 'alpha'), and this
      // file's header says the derivation logic is never reimplemented here.
      // Re-deriving it would let the badge and the notice bar disagree the
      // day the alpha marker stops being a -SNAPSHOT suffix.
      unreleased: versionState(target, current.value) === 'alpha'
    };
  })
);

const switchLabel = computed(() => (isZh.value ? '切换版本' : 'Switch version'));
const badgeText = computed(() => (isZh.value ? '未发布' : 'Unreleased'));

function toggle(): void {
  isOpen.value = !isOpen.value;
}
</script>

<template>
  <VPFlyout
    v-if="!screenMenu"
    class="UtVersionSwitcher"
    icon="vpi-versioning"
    :button="active"
    :label="switchLabel"
    :data-ut-active-version="active"
  >
    <div class="items">
      <div
        v-for="row in rows"
        :key="row.version"
        class="version-row"
        :data-ut-version-link="row.href"
      >
        <VPMenuLink :item="{ text: row.version, link: row.href }" />
        <span
          v-if="row.unreleased"
          class="unreleased-badge"
          data-ut-unreleased-badge
        >{{ badgeText }}</span>
      </div>
    </div>
  </VPFlyout>

  <div
    v-else
    class="UtVersionSwitcherScreen"
    :class="{ open: isOpen }"
    :data-ut-active-version="active"
  >
    <button
      class="button"
      type="button"
      aria-controls="ut-version-switcher-screen"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span class="button-text">
        <span class="vpi-versioning icon" />
        {{ active }}
      </span>
      <span class="vpi-plus button-icon" />
    </button>

    <div id="ut-version-switcher-screen" class="items">
      <div
        v-for="row in rows"
        :key="row.version"
        class="version-row"
        :data-ut-version-link="row.href"
      >
        <VPMenuLink :item="{ text: row.version, link: row.href }" />
        <span
          v-if="row.unreleased"
          class="unreleased-badge"
          data-ut-unreleased-badge
        >{{ badgeText }}</span>
      </div>
    </div>
  </div>
</template>

<!-- Unscoped on purpose: the icon's --icon custom property must resolve
     wherever .vpi-versioning is used (the desktop trigger via VPFlyout's own
     :class="[icon, 'option-icon']", and the mobile button's literal span),
     mirroring version-switcher.component.vue's own unscoped icon block —
     which this file no longer pulls in once theme/index.mts stops importing
     it, so the icon definition has to live somewhere and this is that
     somewhere. -->
<style>
.vpi-versioning.option-icon {
  margin-right: 0px;
}

.vpi-versioning {
  --icon: url("data:image/svg+xml;charset=utf-8;base64,PHN2ZyB3aWR0aD0iNjRweCIgaGVpZ2h0PSI2NHB4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIHN0cm9rZS13aWR0aD0iMi4yIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNvbG9yPSIjMDAwMDAwIj48cGF0aCBkPSJNMTcgN0MxOC4xMDQ2IDcgMTkgNi4xMDQ1NyAxOSA1QzE5IDMuODk1NDMgMTguMTA0NiAzIDE3IDNDMTUuODk1NCAzIDE1IDMuODk1NDMgMTUgNUMxNSA2LjEwNDU3IDE1Ljg5NTQgNyAxNyA3WiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjIuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48L3BhdGg+PHBhdGggZD0iTTcgN0M4LjEwNDU3IDcgOSA2LjEwNDU3IDkgNUM5IDMuODk1NDMgOC4xMDQ1NyAzIDcgM0M1Ljg5NTQzIDMgNSAzLjg5NTQzIDUgNUM1IDYuMTA0NTcgNS44OTU0MyA3IDcgN1oiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PC9wYXRoPjxwYXRoIGQ9Ik03IDIxQzguMTA0NTcgMjEgOSAyMC4xMDQ2IDkgMTlDOSAxNy44OTU0IDguMTA0NTcgMTcgNyAxN0M1Ljg5NTQzIDE3IDUgMTcuODk1NCA1IDE5QzUgMjAuMTA0NiA1Ljg5NTQzIDIxIDcgMjFaIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjwvcGF0aD48cGF0aCBkPSJNNyA3VjE3IiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjwvcGF0aD48cGF0aCBkPSJNMTcgN1Y4QzE3IDEwLjUgMTUgMTEgMTUgMTFMOSAxM0M5IDEzIDcgMTMuNSA3IDE2VjE3IiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjwvcGF0aD48L3N2Zz4=");
}
</style>

<style scoped>
/* Flex row, full height so this control aligns with the tab-row's link items
   beside it. SecondNavBar.vue's active-indicator query targets the two
   nav-item class names its sibling links carry; this component deliberately
   carries neither, so the same layout effect is reproduced locally here
   instead of inherited from that rule. */
.UtVersionSwitcher {
  display: flex;
  align-items: center;
  height: 100%;
}

.version-row {
  display: flex;
  align-items: center;
}

.unreleased-badge {
  display: inline-block;
  margin-left: 4px;
  border-radius: 10px;
  padding: 0 6px;
  line-height: 16px;
  font-size: 10px;
  font-weight: 600;
  color: var(--vp-badge-warning-text);
  background-color: var(--vp-badge-warning-bg);
  white-space: nowrap;
}

/* Mobile accordion — same shape as the upstream .VPScreenVersionSwitcher this
   replaces, renamed to avoid colliding with a class the upstream component
   (still present in node_modules, still reachable if something else imports
   it directly) also defines. */
.UtVersionSwitcherScreen {
  border-bottom: 1px solid var(--vp-c-divider);
  height: 48px;
  overflow: hidden;
  transition: border-color 0.5s;
}

.UtVersionSwitcherScreen .items {
  visibility: hidden;
}

.UtVersionSwitcherScreen.open {
  padding-bottom: 10px;
  height: auto;
}

.UtVersionSwitcherScreen.open .items {
  visibility: visible;
}

.UtVersionSwitcherScreen.open .button {
  padding-bottom: 6px;
  color: var(--vp-c-brand-1);
}

.UtVersionSwitcherScreen.open .button-icon {
  transform: rotate(45deg);
}

.UtVersionSwitcherScreen .icon {
  margin-right: 8px;
}

.button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 4px 11px 0;
  width: 100%;
  line-height: 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.button:hover {
  color: var(--vp-c-brand-1);
}

.button-icon {
  transition: transform 0.25s;
}
</style>
