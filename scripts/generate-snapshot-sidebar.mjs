// Reads alpha's sidebar.{en,zh}.mts (landed by scripts/inject-alpha.mjs at
// .vitepress/config/.snapshot-source/) and writes their sidebarGuide*/
// sidebarApi* exports, transpiled from TypeScript to plain ESM via esbuild,
// into .vitepress/config/sidebar-snapshot.generated.mjs.
//
// Why this matters: the v6.3.0-SNAPSHOT sidebar must reflect alpha's own
// page set, not master's latest sidebar — reusing master's sidebar produces
// entries that point at pages the SNAPSHOT tree doesn't have, and misses
// alpha-only pages (D-45, 03-CONTEXT.md). alpha's sidebar is written as
// .mts, so it has to be transpiled and executed to get data out of it — it
// cannot be read as JSON.
//
// Unlike scripts/inject-alpha.mjs (and scripts/generate-api-version.mjs),
// this script's failure semantics are the opposite of fail-closed: it must
// ALWAYS succeed and ALWAYS write its output file, whether or not
// .snapshot-source/ exists. Most builds (npm run build, npm run dev, this
// repo's normal docs-ci.yml `build` job) never run inject-alpha.mjs first —
// for those, "no snapshot source" is the ordinary, expected state, and this
// script must write four empty arrays rather than error out or skip writing
// the file. locale.en.mts and locale.zh.mts import this file's exports
// unconditionally, with no existsSync/try-catch of their own (D-46) — if
// this script ever returned early without writing, every unijected build,
// including local `npm run dev`, would fail on that import. existsSync is
// used here, once, purely to decide which of the two cases we're in; no
// consumer of this file's output is allowed to make that same check itself.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const SNAPSHOT_SIDEBAR_SRC_EN = path.join('.vitepress', 'config', '.snapshot-source', 'sidebar.en.mts');
const SNAPSHOT_SIDEBAR_SRC_ZH = path.join('.vitepress', 'config', '.snapshot-source', 'sidebar.zh.mts');
const OUTPUT_PATH = path.join('.vitepress', 'config', 'sidebar-snapshot.generated.mjs');

// alpha 的 sidebar 是 .mts，取不出 JSON，只能转译后执行。执行本身没法避开，
// 但**执行时手里有什么**可以。此前用 await import() 在本进程里跑它：esbuild 只
// 转译不沙箱，那段顶层代码于是以全权限 Node 运行在 Cloudflare 构建容器里，能读写
// 工作树里任何文件，包括 functions/ 下的 Cloudflare Function 源码。审查一条走 PR
// 进 alpha 的 doc-sync 改动时，注意力在文档内容上，未必有人去读 sidebar.en.mts
// 的顶层代码。
//
// 现在改为在一个全新的 vm context 里跑。那个 context 只有标准内置对象
// （Object/Array/JSON/Math），没有 require、没有 import、没有 process、没有 fs、
// 没有 fetch、没有 Buffer、没有计时器——能力被拿掉了，而不是寄希望于没人往里放
// 东西。实测 alpha 两份 sidebar 的 esbuild CJS 产物里既无 require( 也无 import：
// 唯一那条 import 是纯类型位置使用的 DefaultTheme，被 TS loader 抹掉。
//
// 三道 fail-closed 断言，任一不成立就让构建红，而不是继续拿一份半懂的数据往下走：
//   1. 转译产物里不得残留模块解析。沙箱里没有 require/import，与其让它在运行时抛
//      一个难以归因的 ReferenceError，不如在这里就说清楚是 alpha 的 sidebar 变了。
//   2. 每个导出必须是数组。
//   3. 每个条目只能带白名单内的键，值只能是字符串、布尔或数组。键集合是实测出来
//      的（master 与 alpha 两侧、中英四份文件合起来只用到 base/items/link/
//      skipVersioning/target/text），另外把 VitePress 自己文档里的
//      collapsed/docFooterText/rel 一并允许。
//
// 第三条不只是防御：这份数据下面会被 JSON.stringify 写进生成文件，函数与
// undefined 本来就会被**静默**丢掉。断言把那次静默丢弃变成一次响亮的失败。
const ALLOWED_ITEM_KEYS = new Set([
  'text', 'link', 'items', 'base', 'collapsed', 'docFooterText', 'rel',
  'target', 'skipVersioning',
]);

function fail(message) {
  console.error(`generate-snapshot-sidebar: ${message}`);
  process.exit(1);
}

function assertPlainSidebarItems(value, exportName, srcPath, trail = exportName) {
  if (!Array.isArray(value)) {
    fail(`${srcPath} 的导出 ${trail} 不是数组（实际 ${typeof value}）。alpha 的 sidebar 结构变了，注入链路拒绝继续。`);
  }
  value.forEach((item, i) => {
    const where = `${trail}[${i}]`;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      fail(`${srcPath} 的 ${where} 不是对象（实际 ${Array.isArray(item) ? 'array' : typeof item}）。alpha 的 sidebar 结构变了，注入链路拒绝继续。`);
    }
    for (const [key, val] of Object.entries(item)) {
      if (!ALLOWED_ITEM_KEYS.has(key)) {
        fail(`${srcPath} 的 ${where} 带了白名单之外的键 "${key}"。alpha 的 sidebar 结构变了，注入链路拒绝继续——白名单见本脚本 ALLOWED_ITEM_KEYS。`);
      }
      if (key === 'items') {
        assertPlainSidebarItems(val, exportName, srcPath, `${where}.items`);
      } else if (typeof val !== 'string' && typeof val !== 'boolean') {
        fail(`${srcPath} 的 ${where}.${key} 既不是字符串也不是布尔（实际 ${typeof val}）。函数与其他类型会被下游的 JSON.stringify 静默丢掉，这里拒绝继续。`);
      }
    }
  });
}

function transpileAndExtract(srcPath, exportNames) {
  const result = esbuild.buildSync({
    entryPoints: [srcPath],
    bundle: false,
    write: false,
    format: 'cjs',
    platform: 'neutral',
    loader: { '.mts': 'ts' },
  });
  const code = result.outputFiles[0].text;

  if (/\brequire\s*\(/.test(code) || /\bimport[\s(]/.test(code)) {
    fail(`${srcPath} 转译后仍带模块解析（require( 或 import）。注入链路在无模块系统的沙箱里执行它，这样的模块跑不起来；alpha 的 sidebar 不再是自洽的数据模块，拒绝继续。`);
  }

  // 全新 context，不传入任何 Node 全局。module/exports 是 esbuild CJS 产物唯一
  // 需要的两个绑定；产物最后会**重新赋值** module.exports（__toCommonJS），所以
  // 必须读 context 里的 module.exports，读传进去的 exports 别名会永远是空的。
  const sandbox = { module: { exports: {} } };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  try {
    vm.runInContext(code, sandbox, { filename: srcPath, timeout: 5000 });
  } catch (err) {
    // 沙箱里跑不起来的顶层代码，几乎一定是因为它在够 Node 全局（process、
    // require、fetch、Buffer 之类）——那正是这个沙箱要拿掉的东西。裸栈不说明
    // 这一点，所以这里把归因写清楚，再把原始错误附上。
    fail(
      `${srcPath} 的顶层代码在沙箱里执行失败：${err && err.message ? err.message : err}\n` +
      `  注入链路只给 alpha 的 sidebar 一个标准内置对象的 context——没有 require、\n` +
      `  import、process、fs、fetch、Buffer 与计时器。一份纯数据的 sidebar 不需要\n` +
      `  其中任何一个，所以这条失败要么是 alpha 的 sidebar 变成了别的东西，要么就是\n` +
      `  它在做它不该做的事。两种情况都要人看一眼，不该让构建带着一份半懂的数据继续。`
    );
  }
  const moduleExports = sandbox.module.exports;

  return exportNames.map((name) => {
    const value = moduleExports[name] ?? [];
    assertPlainSidebarItems(value, name, srcPath);
    // 跨 realm 深拷贝：断言过后再切断与沙箱 realm 的一切引用，交给下游的只有
    // 纯数据。
    return JSON.parse(JSON.stringify(value));
  });
}

// existsSync only appears here, to decide whether this build was preceded by
// scripts/inject-alpha.mjs. No consumer of this file's output makes this
// check itself (D-46, RESEARCH "Anti-Patterns to Avoid").
const hasSnapshotSource = existsSync(SNAPSHOT_SIDEBAR_SRC_EN) && existsSync(SNAPSHOT_SIDEBAR_SRC_ZH);

let sidebarGuideSnapshotEN = [];
let sidebarApiSnapshotEN = [];
let sidebarGuideSnapshotZH = [];
let sidebarApiSnapshotZH = [];

if (hasSnapshotSource) {
  [sidebarGuideSnapshotEN, sidebarApiSnapshotEN] = transpileAndExtract(
    SNAPSHOT_SIDEBAR_SRC_EN,
    ['sidebarGuideEN', 'sidebarApiEN']
  );
  [sidebarGuideSnapshotZH, sidebarApiSnapshotZH] = transpileAndExtract(
    SNAPSHOT_SIDEBAR_SRC_ZH,
    ['sidebarGuideZH', 'sidebarApiZH']
  );
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

// writeFileSync always runs, whether hasSnapshotSource is true or false —
// never return early without writing (see header comment).
writeFileSync(
  OUTPUT_PATH,
  `// Generated by scripts/generate-snapshot-sidebar.mjs at build time. Do not edit by hand.
export const sidebarGuideSnapshotEN = ${JSON.stringify(sidebarGuideSnapshotEN)};
export const sidebarApiSnapshotEN = ${JSON.stringify(sidebarApiSnapshotEN)};
export const sidebarGuideSnapshotZH = ${JSON.stringify(sidebarGuideSnapshotZH)};
export const sidebarApiSnapshotZH = ${JSON.stringify(sidebarApiSnapshotZH)};
`
);

console.log(
  `generate-snapshot-sidebar: wrote ${OUTPUT_PATH} (source=${hasSnapshotSource ? 'injected' : 'none'}, ` +
  `en guide=${sidebarGuideSnapshotEN.length} api=${sidebarApiSnapshotEN.length}, ` +
  `zh guide=${sidebarGuideSnapshotZH.length} api=${sidebarApiSnapshotZH.length})`
);
