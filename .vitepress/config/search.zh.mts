import {DefaultTheme} from "vitepress/theme";

const docSearchLocaleZH: DefaultTheme.AlgoliaSearchOptions['locales'] = {
    zh: {
        placeholder: '如果是开发者大人的话...搜索什么的都是没有关系的哦~',
        translations: {
            button: {
                buttonText: '搜索文档这里请喵~',
                buttonAriaLabel: '搜索文档'
            },
            modal: {
                searchBox: {
                    resetButtonTitle: '清除查询条件',
                    resetButtonAriaLabel: '清除查询条件',
                    cancelButtonText: '取消',
                    cancelButtonAriaLabel: '取消'
                },
                startScreen: {
                    recentSearchesTitle: '搜索历史',
                    noRecentSearchesText: '还没有与开发者大人建立过共同回忆呜~ QAQ',
                    saveRecentSearchButtonTitle: '保存至搜索历史',
                    removeRecentSearchButtonTitle: '从搜索历史中移除',
                    favoriteSearchesTitle: '收藏',
                    removeFavoriteSearchButtonTitle: '从收藏中移除'
                },
                errorScreen: {
                    titleText: '无法获取结果',
                    helpText: '你可能需要检查你的网络连接'
                },
                footer: {
                    selectText: '就是你了！',
                    navigateText: '这这不对...',
                    closeText: '你给路达呦',
                    searchByText: '你的专属搜索姬'
                },
                noResultsScreen: {
                    noResultsText: '无法找到相关结果',
                    suggestedQueryText: '你可以尝试查询',
                    reportMissingResultsText: '你认为该查询应该有结果？',
                    reportMissingResultsLinkText: '点击反馈'
                }
            }
        }
    }
}

export { docSearchLocaleZH }