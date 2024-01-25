import {UserConfig} from "vitepress";

const viteConfig: UserConfig = {
    vite: {
        ssr: {
            noExternal: [
                '@nolebase/vitepress-plugin-enhanced-readabilities',
                '@nolebase/vitepress-plugin-highlight-targeted-heading',
                '@nolebase/markdown-it-bi-directional-links',
                '@nolebase/vitepress-plugin-inline-link-preview'
            ],
        }
    }
}

export { viteConfig }