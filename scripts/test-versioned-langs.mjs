import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

// VitePress 2 把 query/hash 放在 useRoute()，useData() 不再提供 hash ref。
// 只替换框架上下文；路径计算执行仓库内真实的 versioning.ts。
async function languageLinks(relativePath = 'guide/introduction.md') {
  const context = createContext({})
  const data = {
    site: { value: { locales: {
      root: { label: 'English', lang: 'en-US' },
      zh: { label: '简体中文', lang: 'zh-CN' },
      'v6.3.2': { label: 'English' },
      'zh/v6.3.2': { label: '简体中文' },
    } } },
    localeIndex: { value: 'root' },
    page: { value: { relativePath } },
    theme: { value: {} },
  }
  const route = { query: '?from=guide', hash: '#example' }
  const source = await readFile(new URL('../.vitepress/theme/composables/versioned-langs.ts', import.meta.url), 'utf8')
  const paths = await readFile(new URL('../.vitepress/theme/components/versioning.ts', import.meta.url), 'utf8')
  const versioning = new SourceTextModule(stripTypeScriptTypes(paths), { context })
  const fixturePages = ['guide/introduction', 'zh/guide/introduction', 'zh/guide/only-chinese']
  const values = {
    vitepress: { useData: () => data, useRoute: () => route },
    vue: { computed: (get) => ({ get value() { return get() } }) },
    '../../config/version-pages.generated.mjs': {
      CURRENT_VERSION: 'v6.4.0',
      KNOWN_VERSIONS: ['v6.4.0', 'v6.3.2'],
      VERSION_PAGES: { 'v6.4.0': fixturePages, 'v6.3.2': fixturePages },
    },
  }
  const module = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await module.link((specifier) => {
    if (specifier === '../components/versioning') return versioning
    const exports = values[specifier]
    assert.ok(exports, `unexpected import: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return { useLangs: module.namespace.useLangs, data, route }
}

test('SSR accepts VitePress 2 useData without a hash ref', async () => {
  const { useLangs } = await languageLinks()
  assert.equal(useLangs({ linkToCorrespondingPage: true }).localeLinks.value[0].link,
    '/zh/guide/introduction.html?from=guide#example')
})

test('archived Chinese pages switch language within the same version', async () => {
  const { useLangs } = await languageLinks('zh/v6.3.2/guide/introduction.md')
  const links = useLangs({ linkToCorrespondingPage: true }).localeLinks.value
  assert.equal(links.length, 1)
  assert.equal(links[0].text, 'English')
  assert.equal(links[0].link, '/v6.3.2/guide/introduction.html?from=guide#example')
})

test('missing translation falls back to the same version home without a dangling hash', async () => {
  const { useLangs } = await languageLinks('zh/v6.3.2/guide/only-chinese.md')
  assert.equal(useLangs({ linkToCorrespondingPage: true }).localeLinks.value[0].link, '/v6.3.2/')
})

test('disabled corresponding-page routing keeps the language home link', async () => {
  const { useLangs, data } = await languageLinks()
  data.theme.value.i18nRouting = false
  assert.equal(useLangs({ linkToCorrespondingPage: true }).localeLinks.value[0].link, '/zh/')
})

test('language links read the current route query/hash after navigation', async () => {
  const { useLangs, route } = await languageLinks()
  const links = useLangs({ linkToCorrespondingPage: true })
  route.query = '?from=search'
  route.hash = '#next'
  assert.equal(links.localeLinks.value[0].link, '/zh/guide/introduction.html?from=search#next')
})
