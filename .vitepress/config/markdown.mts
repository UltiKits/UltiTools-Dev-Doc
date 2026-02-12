import {MarkdownOptions} from "vitepress";
import {tabsMarkdownPlugin} from "vitepress-plugin-tabs";
import {BiDirectionalLinks} from "@nolebase/markdown-it-bi-directional-links";
import {InlineLinkPreviewElementTransform} from "@nolebase/vitepress-plugin-inline-link-preview/markdown-it";
import {groupIconMdPlugin} from "vitepress-plugin-group-icons";

const markdownConfig: MarkdownOptions = {
    math: true,
    image: {
        lazyLoading: true
    },
    config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(BiDirectionalLinks({
            dir: process.cwd(),
        }))
        md.use(InlineLinkPreviewElementTransform)
        md.use(groupIconMdPlugin)
    }
}

export { markdownConfig }
