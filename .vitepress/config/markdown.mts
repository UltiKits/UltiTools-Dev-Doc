import {MarkdownOptions} from "vitepress";
import {tabsMarkdownPlugin} from "vitepress-plugin-tabs";
import {InlineLinkPreviewElementTransform} from "@nolebase/vitepress-plugin-inline-link-preview/markdown-it";
import {groupIconMdPlugin} from "vitepress-plugin-group-icons";

const markdownConfig: MarkdownOptions = {
    image: {
        lazyLoad: true
    },
    config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(InlineLinkPreviewElementTransform)
        md.use(groupIconMdPlugin)
    }
}

export { markdownConfig }
