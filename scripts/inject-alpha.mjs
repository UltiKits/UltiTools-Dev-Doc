// Downloads the alpha branch's docs/src, examples/src, and sidebar.{en,zh}.mts,
// rewrites the injected markdown's code-snippet references to point at a
// SNAPSHOT-only examples mirror, and lands everything under
// docs/archive/v6.3.0-SNAPSHOT/, examples-snapshot/, and
// .vitepress/config/.snapshot-source/.
//
// Why this matters: alpha's docs/src references 76 unique example paths, 12 of
// which do not exist in this branch's examples/src (03-RESEARCH.md, real
// measurement). VitePress's snippet renderer calls fs.statSync(src).isFile()
// before it ever checks fs.existsSync(src) (node_modules/vitepress/dist/node/
// chunk-D3CUZ4fa.js, 1.6.4) — a missing file is an uncaught ENOENT that kills
// the whole build, not the "Code snippet path not found" message the plugin's
// own source appears to promise (RESEARCH Pitfall 2). So this script must
// inject examples/src alongside docs/src and rewrite every reference to the
// SNAPSHOT-only mirror, then positively verify each rewritten reference
// resolves on disk before declaring success — leaving that check to VitePress
// is not an option, it will crash instead of skipping.
//
// Fail-closed on purpose, at every step: an unreachable alpha ref, a
// truncated/corrupt tarball, a missing tar member, or a snippet reference that
// still doesn't resolve after rewriting all exit non-zero with a reason
// printed to stderr (prefixed "inject-alpha: "). Getting the alpha tree is
// this side's own infrastructure; if it fails silently, nobody would notice
// the deployed site is missing a version (D-44, 03-CONTEXT.md).
//
// Every path this script writes to (docs/archive/v6.3.0-SNAPSHOT/,
// examples-snapshot/, .vitepress/config/.snapshot-source/) is gitignored, not
// committed — a committed copy would be byte-identical to a stale run and
// would silently mask a failed build-time injection instead of failing
// closed, the same reasoning as .gitignore's
// functions/api/_shared/version.generated.js entry.

import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ALPHA_REPO / ALPHA_REF exist solely to let a fault-injection run point this
// script at a ref/repo that cannot resolve, so D-44's fail-closed posture and
// D-41's judge-emptiness-not-exit-code behavior can be demonstrated end to
// end instead of only asserted (03-01-PLAN.md Task 2). They are not
// production configuration — Cloudflare Pages' Build command never sets
// them, and the default values below are the real upstream.
const ALPHA_REPO = process.env.ALPHA_REPO || 'UltiKits/UltiTools-Dev-Doc';
const ALPHA_REF = process.env.ALPHA_REF || 'alpha';

const SNAPSHOT_VERSION = 'v6.3.0-SNAPSHOT';
const ARCHIVE_DEST = path.join('docs', 'archive', SNAPSHOT_VERSION);
const EXAMPLES_DEST = path.join('examples-snapshot', 'src');
const SIDEBAR_SOURCE_DEST = path.join('.vitepress', 'config', '.snapshot-source');

const OLD_SNIPPET_PREFIX = '@/../examples/';
const NEW_SNIPPET_PREFIX = '@/../examples-snapshot/';

function fail(reason) {
  console.error(`inject-alpha: ${reason}`);
  process.exit(1);
}

// ── 1. Resolve the alpha commit sha ────────────────────────────────────────
// git ls-remote returns empty output + exit code 0 for a ref that does not
// exist — it must be judged on emptiness, not on exit code (RESEARCH
// Pitfall 3, D-41).
let lsRemoteOutput;
try {
  lsRemoteOutput = execFileSync(
    'git',
    ['ls-remote', `https://github.com/${ALPHA_REPO}.git`, ALPHA_REF],
    { encoding: 'utf-8' }
  );
} catch (err) {
  fail(`git ls-remote failed for ref "${ALPHA_REF}" of ${ALPHA_REPO}: ${err.message}`);
}

const commitSha = lsRemoteOutput.split('\t')[0].trim();
if (!commitSha) {
  fail(`ref "${ALPHA_REF}" not found in ${ALPHA_REPO} (git ls-remote returned no output)`);
}
if (!/^[0-9a-f]{40}$/.test(commitSha)) {
  fail(`git ls-remote returned a value that is not a 40-hex-char sha: "${commitSha}"`);
}

// ── 2. Download the tarball ─────────────────────────────────────────────────
const tmpDir = mkdtempSync(path.join(tmpdir(), 'inject-alpha-'));
const tarballPath = path.join(tmpDir, 'alpha.tar.gz');
const extractDir = path.join(tmpDir, 'extract');
mkdirSync(extractDir, { recursive: true });

const tarballUrl = `https://codeload.github.com/${ALPHA_REPO}/tar.gz/refs/heads/${ALPHA_REF}`;
try {
  execFileSync('curl', [
    '-sS',
    '--fail',
    '--location',
    '--connect-timeout', '10',
    '--max-time', '60',
    '-o', tarballPath,
    tarballUrl,
  ]);
} catch (err) {
  fail(`curl download of ${tarballUrl} failed: ${err.message}`);
}

try {
  execFileSync('gzip', ['-t', tarballPath]);
} catch (err) {
  fail(`downloaded tarball failed gzip integrity check (gzip -t): ${err.message}`);
}

// ── 3. Extract exactly the four members this injection needs ───────────────
// No wildcards, no --absolute-names: GNU tar exits non-zero with "Not found
// in archive" for any listed member that is missing, which is this step's
// fail-closed guarantee (D-42, D-45 — sidebar sources are required here too,
// not just docs/src and examples/src).
const repoName = ALPHA_REPO.split('/')[1] ?? ALPHA_REPO;
const topDir = `${repoName}-${ALPHA_REF}`;
const members = [
  `${topDir}/docs/src`,
  `${topDir}/examples/src`,
  `${topDir}/.vitepress/config/sidebar.en.mts`,
  `${topDir}/.vitepress/config/sidebar.zh.mts`,
];

try {
  execFileSync('tar', [
    '-xzf', tarballPath,
    '--strip-components=1',
    '-C', extractDir,
    ...members,
  ]);
} catch (err) {
  fail(`tar extraction of ${members.join(', ')} failed: ${err.message}`);
}

// ── 4. Land the three destinations, replacing whatever was there before ────
rmSync(ARCHIVE_DEST, { recursive: true, force: true });
mkdirSync(path.dirname(ARCHIVE_DEST), { recursive: true });
cpSync(path.join(extractDir, 'docs', 'src'), ARCHIVE_DEST, { recursive: true });

rmSync(EXAMPLES_DEST, { recursive: true, force: true });
mkdirSync(path.dirname(EXAMPLES_DEST), { recursive: true });
cpSync(path.join(extractDir, 'examples', 'src'), EXAMPLES_DEST, { recursive: true });

rmSync(SIDEBAR_SOURCE_DEST, { recursive: true, force: true });
mkdirSync(SIDEBAR_SOURCE_DEST, { recursive: true });
cpSync(
  path.join(extractDir, '.vitepress', 'config', 'sidebar.en.mts'),
  path.join(SIDEBAR_SOURCE_DEST, 'sidebar.en.mts')
);
cpSync(
  path.join(extractDir, '.vitepress', 'config', 'sidebar.zh.mts'),
  path.join(SIDEBAR_SOURCE_DEST, 'sidebar.zh.mts')
);

// ── 5. Rewrite code-snippet references, then assert zero residual + every
//       rewritten reference exists on disk ─────────────────────────────────
function walkMarkdownFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

const mdFiles = walkMarkdownFiles(ARCHIVE_DEST);
let replacedCount = 0;
let touchedFiles = 0;

for (const file of mdFiles) {
  const content = readFileSync(file, 'utf-8');
  if (!content.includes(OLD_SNIPPET_PREFIX)) continue;
  const occurrences = content.split(OLD_SNIPPET_PREFIX).length - 1;
  const rewritten = content.replaceAll(OLD_SNIPPET_PREFIX, NEW_SNIPPET_PREFIX);
  writeFileSync(file, rewritten);
  replacedCount += occurrences;
  touchedFiles += 1;
}

// Zero-residual assertion: the old prefix must not appear anywhere in the
// injected tree after rewriting.
const residual = [];
for (const file of mdFiles) {
  const content = readFileSync(file, 'utf-8');
  if (content.includes(OLD_SNIPPET_PREFIX)) residual.push(file);
}
if (residual.length > 0) {
  fail(`residual "${OLD_SNIPPET_PREFIX}" reference(s) found after rewrite in: ${residual.join(', ')}`);
}

// Positive-existence assertion: every rewritten reference must resolve to a
// real file. VitePress will not skip a missing one — it throws an uncaught
// ENOENT before it ever gets to check existsSync (Pitfall 2), so this check
// cannot be deferred to the build.
const snippetRefPattern = new RegExp(
  `<<<\\s+${NEW_SNIPPET_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\S+)`,
  'g'
);
const missing = [];
for (const file of mdFiles) {
  const content = readFileSync(file, 'utf-8');
  for (const match of content.matchAll(snippetRefPattern)) {
    const relPath = path.join('examples-snapshot', match[1]);
    if (!existsSync(relPath)) missing.push(`${file} -> ${relPath}`);
  }
}
if (missing.length > 0) {
  fail(`rewritten snippet reference(s) do not exist on disk:\n${missing.join('\n')}`);
}

// ── 6. Summary ───────────────────────────────────────────────────────────
const javaFileCount = (function countJava(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countJava(full);
    else if (entry.name.endsWith('.java')) count += 1;
  }
  return count;
})(EXAMPLES_DEST);

console.log(
  `inject-alpha: injected ${mdFiles.length} md files, ${javaFileCount} java files, ` +
  `rewrote ${replacedCount} snippet reference(s) across ${touchedFiles} file(s), ` +
  `commit ${commitSha.slice(0, 7)}`
);
