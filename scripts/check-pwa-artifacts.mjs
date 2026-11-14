import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.resolve(root, process.argv[2] || '.vitepress/dist')
const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'))
assert.equal(manifest.name, 'UltiKits Dev Doc')
assert.ok(manifest.icons?.length > 0, 'manifest must retain installable shortcut icons')
for (const icon of manifest.icons) {
  assert.ok((await stat(path.join(dist, icon.src))).size > 0, `missing manifest icon ${icon.src}`)
}
const files = await readdir(dist, { recursive: true })
const pages = files.filter((file) => file.endsWith('.html'))
assert.ok(pages.length > 0, 'empty page set cannot prove manifest injection')
for (const file of pages) {
  const html = await readFile(path.join(dist, file), 'utf8')
  assert.match(html, /<link\b[^>]*rel="manifest"[^>]*href="\/manifest\.webmanifest"/, `${file}: missing root manifest link`)
}
const chunks = files.filter((file) => /assets\/chunks\/register-rescue-worker\.[^.]+\.js$/.test(file))
assert.equal(chunks.length, 1, 'exactly one native registration chunk must be emitted')
const { registerRescueWorker } = await import(pathToFileURL(path.join(dist, chunks[0])).href)
let registered
await registerRescueWorker({ register: async (...args) => { registered = args } })
assert.deepEqual(registered, ['/sw.js', { scope: '/', type: 'classic', updateViaCache: 'none' }])
let references = 0
for (const file of files.filter((file) => file.startsWith('assets/') && file.endsWith('.js') && file !== chunks[0])) {
  if ((await readFile(path.join(dist, file), 'utf8')).includes(path.basename(chunks[0]))) references++
}
assert.ok(references > 0, 'native registration chunk must be referenced, not an orphan output file')
console.log(`PASS: manifest and icons retained; ${pages.length} HTML pages link the manifest; compiled root registration bypasses HTTP cache and has ${references} importer(s)`)
