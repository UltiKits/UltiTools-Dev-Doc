import type { DefaultTheme, LocaleConfig } from 'vitepress'

// Since 2.1, @viteplus/versions copies its whole route table (every page of
// every version, `routesMap` in its dist/index.js) into
// props.versioningPlugin.routes of each nav item it versions. Nav items end up
// in the site data that VitePress inlines into every HTML page, once per
// locale, so on this site each page grew from about 160 KB to about 610 KB
// (measured on guide/introduction.html, 2.3.0).
//
// The table is read only by the plugin's own version-switcher component. This
// site renders UtVersionSwitcher instead, which checks page existence against
// config/version-pages.generated.mjs, so the table is dropped here.
type NavItem = DefaultTheme.NavItem & { items?: NavItem[]; props?: Record<string, any> }

function strip(items: NavItem[] | undefined): number {
    let removed = 0
    for (const item of items ?? []) {
        const plugin = item.props?.versioningPlugin
        if (plugin && 'routes' in plugin) {
            delete plugin.routes
            removed++
        }
        removed += strip(item.items)
    }
    return removed
}

export function dropVersionRoutes<T extends { locales?: LocaleConfig; themeConfig?: DefaultTheme.Config }>(config: T): T {
    strip(config.themeConfig?.nav as NavItem[] | undefined)
    for (const locale of Object.values(config.locales ?? {})) {
        strip((locale.themeConfig as DefaultTheme.Config | undefined)?.nav as NavItem[] | undefined)
    }
    return config
}
