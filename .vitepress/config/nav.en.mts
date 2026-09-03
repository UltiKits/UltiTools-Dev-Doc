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
    }
]

export { navEN }
