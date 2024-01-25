import {MarkdownOptions} from "vitepress";
import {tabsMarkdownPlugin} from "vitepress-plugin-tabs";
import {BiDirectionalLinks} from "@nolebase/markdown-it-bi-directional-links";
import {ElementTransform, Options as ElementTransformOptions} from "@nolebase/markdown-it-element-transform";

const markdownConfig: MarkdownOptions = {
    config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(BiDirectionalLinks({
            dir: process.cwd(),
        }))
        md.use(ElementTransform, (() => {
            let transformNextLinkCloseToken = false

            // noinspection JSUnusedGlobalSymbols
            return {
                transform(token) {
                    switch (token.type) {
                        case 'link_open':
                            if (token.attrGet('class') !== 'header-anchor') {
                                token.tag = 'VPNolebaseInlineLinkPreview'
                                transformNextLinkCloseToken = true
                            }
                            break
                        case 'link_close':
                            if (transformNextLinkCloseToken) {
                                token.tag = 'VPNolebaseInlineLinkPreview'
                                transformNextLinkCloseToken = false
                            }

                            break
                    }
                },
            } as ElementTransformOptions
        })())
    }
}

export { markdownConfig }