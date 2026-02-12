import {UserConfig} from "vitepress";
import {GitChangelog, GitChangelogMarkdownSection} from "@nolebase/vitepress-plugin-git-changelog/vite";
import {groupIconVitePlugin} from "vitepress-plugin-group-icons";

const viteConfig: UserConfig = {
    vite: {
        plugins: [
            GitChangelog({
                repoURL: () => 'https://github.com/UltiKits/UltiTools-Dev-Doc',
            }),
            GitChangelogMarkdownSection(),
            groupIconVitePlugin(),
        ],
        ssr: {
            noExternal: [
                '@nolebase/vitepress-plugin-enhanced-readabilities',
                '@nolebase/vitepress-plugin-highlight-targeted-heading',
                '@nolebase/vitepress-plugin-inline-link-preview',
                '@nolebase/vitepress-plugin-git-changelog',
                '@nolebase/markdown-it-bi-directional-links',
            ],
        }
    }
}

export { viteConfig }
