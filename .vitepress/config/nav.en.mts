const navEN = [
    {
        text: 'Documents',
        activeMatch: `/guide/`,
        link: '/guide/introduction',
    },
    // The `target` field below (set to '_self') stops VitePress's global
    // click handler from taking this over. The handler bails out early
    // only when the clicked <a>
    // carries a `target` attribute (vitepress/dist/client/app/router.js,
    // the `link.hasAttribute('target')` branch) — otherwise it treats /api/
    // as a same-origin HTML route and does a client-side navigation to it.
    // /api/ is a Cloudflare Pages Function route with no matching page in
    // the build output, so a client-side navigation renders VitePress's own
    // 404 instead of ever calling the Function. This field is not about
    // where the link opens — it is about opting this <a> out of that
    // interception. '_self' (not '_blank') matters too: VPLink.vue's
    // isExternal flag treats target === '_blank' as an external link and
    // adds an icon plus rel="noreferrer"; '_self' does not trigger that
    // branch, so appearance and click behavior stay exactly as they are
    // today, minus the interception.
    {
        text: 'API Reference',
        activeMatch: `/api/`,
        link: '/api/',
        skipVersioning: true,
        target: '_self'
    },
    {
        text: 'User Doc',
        link: 'https://doc.ultikits.com',
        skipVersioning: true
    },
    // No link, no activeMatch, no versioningPlugin prop supplied by hand:
    // @viteplus/versions' populateNav step auto-merges
    // props.versioningPlugin = { versions, currentVersion } into any nav item
    // carrying a component key (04-UI-SPEC.md § Version Switcher Contract).
    // Supplying that prop here would duplicate a build-time value and let the
    // two drift. Rendered by SecondNavBar.vue on desktop and by VitePress's
    // own VPNavScreenMenu on mobile from this one entry — see
    // theme/index.mts for why the registered name is 'VersionSwitcher', not
    // 'UtVersionSwitcher'.
    //
    // Server-rendered TWICE per page, not once. Both consumers iterate
    // theme.nav and render a component branch: VitePress's own
    // VPNavBarMenu.vue:21-25 as well as SecondNavBar.vue:82. The second copy
    // is invisible only because Layout.vue hides
    // `.VPNavBar .content-body > .VPNavBarMenu.menu` outright — an unrelated
    // rule that predates the switcher. Removing that rule surfaces a duplicate
    // flyout in the nav bar. scripts/check-rendered-links.sh asserts the
    // occurrence count is exactly 2, so a third consumer, or a change to the
    // hiding rule, is visible rather than silent.
    {
        component: 'VersionSwitcher'
    }
]

export { navEN }
