// Replacement for VitePress's default-theme useLangs() (theme-default/
// composables/langs.js). config.mts aliases that module to this file, so every
// default-theme component that imports it uses this version: the language group
// of the "..." menu (VPNavBarExtra), the nav-bar and mobile-menu language lists
// (VPNavBarTranslations, VPNavScreenTranslations), the site title link
// (VPNavBarTitle) and the 404 page. SidebarTranslations.vue uses it directly.
//
// Why VitePress's own version does not work on this site: @viteplus/versions
// adds one locale per archived version (`v6.2.4`, `zh/v6.2.4`, ...). VitePress
// lists every locale whose label differs from the current one, so with ten
// versions the menu has about twenty entries, all but two of them duplicates
// that link to the current release. It also builds the other-language link by
// prefix substitution without checking that the page exists there: v6.2.0 to
// v6.2.4 have zh/guide/essentials/version-wrapper and no English counterpart.
//
// Here the languages are the locales whose key carries no version segment
// (root and zh, derived from site data and the generated version list, not a
// hand list), the reader's language is taken from the page path, and the
// target page is checked against the build-time page manifest that the version
// switcher and the notice bar use. A missing counterpart falls back to the same
// version's homepage in the other language. Every value derives from route data
// and site data, so server render and hydration agree.
import { useData, useRoute } from 'vitepress'
import { computed } from 'vue'
// @ts-ignore generated at build time by scripts/generate-version-pages.mjs
import { CURRENT_VERSION, KNOWN_VERSIONS, VERSION_PAGES } from '../../config/version-pages.generated.mjs'
import { activeVersion, buildPath, pageExists } from '../components/versioning'

export interface SiteLanguage {
  key: string
  label: string
  // path prefix of this locale inside relativePath: '' for root, 'zh/' for zh
  prefix: string
}

export function useLangs({ linkToCorrespondingPage = false } = {}) {
  const { site, localeIndex, page, theme } = useData()
  const route = useRoute()

  const languages = computed<SiteLanguage[]>(() =>
    Object.entries(site.value.locales)
      .filter(([key]) => !key.split('/').some((seg) => (KNOWN_VERSIONS as string[]).includes(seg)))
      .map(([key, value]) => ({
        key,
        label: (value.label ?? '').trim(),
        prefix: key === 'root' ? '' : `${key}/`,
      }))
      .filter((l) => l.label !== '')
  )

  // longest prefix wins; the root locale has the empty prefix and matches last
  const language = computed<SiteLanguage | undefined>(() =>
    [...languages.value]
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((l) => page.value.relativePath.startsWith(l.prefix))
  )

  // `link` keeps VitePress's meaning (the site title and the 404 page link to
  // it): the matched locale's own link, which for an archived version is the
  // language's current-release homepage.
  const currentLang = computed(() => ({
    label: language.value?.label,
    link:
      site.value.locales[localeIndex.value]?.link ||
      (localeIndex.value === 'root' ? '/' : `/${localeIndex.value}/`),
  }))

  const localeLinks = computed(() => {
    const current = language.value
    if (!current) return []
    const relativePath = page.value.relativePath
    const version = activeVersion(relativePath, KNOWN_VERSIONS, CURRENT_VERSION)
    const rest = relativePath.slice(current.prefix.length)
    const samePage = linkToCorrespondingPage && theme.value.i18nRouting !== false
    return languages.value
      .filter((l) => l.key !== current.key)
      .map((l) => {
        const target = l.prefix + rest
        const link =
          samePage && pageExists(version, target, KNOWN_VERSIONS, VERSION_PAGES)
            ? buildPath(version, target, KNOWN_VERSIONS, CURRENT_VERSION) + route.query + route.hash
            : buildPath(version, `${l.prefix}index.md`, KNOWN_VERSIONS, CURRENT_VERSION)
        return { text: l.label, link }
      })
  })

  return { localeLinks, currentLang }
}
