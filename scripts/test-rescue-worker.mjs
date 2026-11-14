import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { registerRescueWorker } from '../.vitepress/theme/register-rescue-worker.mjs'

// 可以对源码或构建后的同一 worker 运行；这不是浏览器 UAT。
const worker = process.env.RESCUE_WORKER_PATH
  ? pathToFileURL(path.resolve(process.env.RESCUE_WORKER_PATH))
  : new URL('../docs/public/sw.js', import.meta.url)
const source = await readFile(worker, 'utf8')

function harness(cacheNames = [], { deleteGate, rejectedNavigation = false } = {}) {
  const handlers = new Map()
  const calls = []
  let matchOptions
  class WindowClient {
    url = 'https://example.test/zh/guide/introduction#example'
    async navigate(url) {
      calls.push(['navigate', url])
      if (rejectedNavigation) throw new Error('window closed')
    }
  }
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    skipWaiting: async () => { calls.push(['skipWaiting']) },
    registration: { unregister: async () => { calls.push(['unregister']); return true } },
    caches: {
      keys: async () => [...cacheNames],
      delete: async (name) => {
        if (deleteGate) await deleteGate.promise
        cacheNames.splice(cacheNames.indexOf(name), 1)
        calls.push(['delete', name])
        return true
      },
    },
    clients: { matchAll: async (options) => { matchOptions = options; return [new WindowClient()] } },
  }
  runInNewContext(source, { self, WindowClient, Promise })
  return {
    calls, handlers,
    get matchOptions() { return matchOptions },
    async dispatch(type) {
      let lifetime
      handlers.get(type)({ waitUntil: (promise) => { lifetime = promise } })
      assert.ok(lifetime?.then, `${type} must extend its lifetime with waitUntil`)
      await lifetime
    },
  }
}

test('install waits for skipWaiting and never installs a fetch handler', async () => {
  const sw = harness()
  await sw.dispatch('install')
  assert.deepEqual(sw.calls, [['skipWaiting']])
  assert.deepEqual([...sw.handlers.keys()].sort(), ['activate', 'install'])
})

test('fresh visitors unregister without claiming or reloading the page', async () => {
  const sw = harness()
  await sw.dispatch('activate')
  assert.deepEqual(sw.calls, [['unregister']])
})

test('old caches are deleted completely before unregistering and reloading old pages', async () => {
  const gate = Promise.withResolvers()
  const sw = harness(['workbox-precache-old', 'workbox-runtime-old'], { deleteGate: gate })
  const activation = sw.dispatch('activate')
  await setImmediate()
  assert.equal(sw.calls.length, 0, 'cleanup must not unregister or reload while deletion is pending')
  gate.resolve()
  await activation
  assert.deepEqual(sw.calls.map(([type]) => type), ['delete', 'delete', 'unregister', 'navigate'])
  assert.equal(sw.matchOptions.type, 'window')
  assert.equal(sw.matchOptions.includeUncontrolled, true, 'also find pages still controlled by the old worker')
})

test('a subsequent cache-free visit cannot enter a reload loop', async () => {
  const sw = harness(['workbox-old'])
  await sw.dispatch('activate')
  await sw.dispatch('activate')
  assert.equal(sw.calls.filter(([type]) => type === 'navigate').length, 1)
})

test('a window closing during navigation does not abort successful cleanup', async () => {
  const sw = harness(['workbox-old'], { rejectedNavigation: true })
  await sw.dispatch('activate')
  assert.equal(sw.calls.filter(([type]) => type === 'unregister').length, 1)
})

test('native registration retains the classic root worker and bypasses the HTTP cache', async () => {
  const registration = {}
  const calls = []
  const result = await registerRescueWorker({ register: async (...args) => { calls.push(args); return registration } })
  assert.equal(result, registration)
  assert.deepEqual(calls, [['/sw.js', { scope: '/', type: 'classic', updateViaCache: 'none' }]])
})

test('registration failures remain observable to the component', async () => {
  const failure = new Error('network unavailable')
  await assert.rejects(registerRescueWorker({ register: async () => { throw failure } }), failure)
})
