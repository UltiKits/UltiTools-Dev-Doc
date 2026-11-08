import type { LocaleConfig } from 'vitepress'

// @viteplus/versions adds one locale per archived version (`v6.2.4`,
// `zh/v6.2.4`, ...) and gives each of them the label " "
// (createVersionedLocale in its dist/index.js: `r.label=" "`). Each copy keeps
// the `lang` of the locale it was made from, so the human label is taken from
// the configured locale with the same `lang`. Nothing here lists versions: new
// archive directories are covered as they appear.
//
// The labels alone do not make VitePress's language menus usable, because
// VitePress lists every locale whose label differs from the current one; the
// menus themselves are handled by .vitepress/theme/composables/versioned-langs.ts.
export function labelArchiveLocales<T extends { locales?: LocaleConfig }>(config: T, configured: LocaleConfig): T {
    const labelByLang = new Map<string, string>()
    for (const locale of Object.values(configured)) {
        if (locale.lang && locale.label) labelByLang.set(locale.lang, locale.label)
    }
    for (const [key, locale] of Object.entries(config.locales ?? {})) {
        if (locale.label && locale.label.trim() !== '') continue
        const label = locale.lang ? labelByLang.get(locale.lang) : undefined
        if (!label) {
            throw new Error(`locale "${key}" has no label and no configured locale shares its lang "${locale.lang}"`)
        }
        locale.label = label
    }
    return config
}
