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

// ── 6. Frontmatter metadata: alphaCommit / alphaInjectedAt / noindex head ──
// D-43 requires the injected commit and injection time to stay inside the
// SNAPSHOT tree itself — the visible timestamp on the entry pages (step 7)
// is the only reader-visible signal if the nightly cron silently stops
// working. D-48 requires every SNAPSHOT page to carry robots noindex;
// RESEARCH already verified with a real build that frontmatter `head`
// renders into the dist HTML for docs/archive/ pages, so this writes that
// field rather than standing up an unverified docs/public/_headers rule.
//
// alphaInjectedAt/injectedAt (step 8) must be byte-identical across every
// file from a single run, so it is computed exactly once here, not per-file
// or re-read from the JSON later.
const INJECTED_AT = new Date().toISOString();

// Splits `---\n<frontmatter>\n---\n<rest>` without a full YAML parser: this
// repo's frontmatter blocks are simple flat/nested-mapping YAML (see
// RESEARCH's noindex example), and every write below only ever appends new
// top-level keys or a new item under an existing `head:` sequence — it never
// needs to understand or re-serialize a value it didn't write itself.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  return { raw: match[0], body: match[1], rest: content.slice(match[0].length) };
}

function withInjectedFrontmatter(content, commitSha, injectedAt) {
  const parsed = parseFrontmatter(content);
  const fmLines = parsed ? parsed.body.split(/\r?\n/) : [];
  const rest = parsed ? parsed.rest : content;

  // If this page already declares its own `head:` sequence, append the
  // noindex item to it instead of adding a second `head:` key (which would
  // make the later key win and silently drop whatever the page's own head
  // entries were meant to do) — a top-level YAML key is any line with zero
  // leading whitespace, so the sequence's end is the next such line.
  const noindexItem = ['  - - meta', '    - name: robots', '      content: noindex'];
  const headLineIndex = fmLines.findIndex((line) => /^head:\s*$/.test(line));
  if (headLineIndex === -1) {
    fmLines.push('head:', ...noindexItem);
  } else {
    let insertAt = fmLines.length;
    for (let i = headLineIndex + 1; i < fmLines.length; i++) {
      if (/^\S/.test(fmLines[i])) {
        insertAt = i;
        break;
      }
    }
    fmLines.splice(insertAt, 0, ...noindexItem);
  }

  fmLines.push(`alphaCommit: ${commitSha}`, `alphaInjectedAt: "${injectedAt}"`);
  return `---\n${fmLines.join('\n')}\n---\n${rest}`;
}

let frontmatterProcessedCount = 0;
for (const file of mdFiles) {
  const content = readFileSync(file, 'utf-8');
  writeFileSync(file, withInjectedFrontmatter(content, commitSha, INJECTED_AT));
  frontmatterProcessedCount += 1;
}

// ── 7. Unreleased-documentation banner on the four entry pages ─────────────
// Exactly four: the two literal locale homepages D-43 names, plus the two
// guide/introduction.md pages — the sidebar's actual first entry and the
// javadoc backlink's target, which is a more reliable freshness-detection
// surface than index.md alone (layout: home renders the container block
// below the hero/feature grid, not at the top of the viewport).
const ENTRY_PAGES = [
  { rel: 'index.md', lang: 'en' },
  { rel: path.join('zh', 'index.md'), lang: 'zh' },
  { rel: path.join('guide', 'introduction.md'), lang: 'en' },
  { rel: path.join('zh', 'guide', 'introduction.md'), lang: 'zh' },
];

const shortSha = commitSha.slice(0, 7);

// Title + 2 sentences of body, 3 lines total — inside AGENTS.md's 3-line
// container-block ceiling (check-container-length.sh does not scan injected
// output, but the convention still applies, per 03-CONTEXT.md D-43). The
// literal strings "Unreleased documentation" / "未发布内容" are the exact
// keywords later preview/verify steps grep for.
function warningBanner(lang) {
  const lines = lang === 'zh'
    ? [
        '::: warning 未发布内容',
        '本页内容来自 alpha 分支，随时可能变更，不属于任何已发布版本。',
        `本次注入来源 commit \`${shortSha}\`，注入时间 ${INJECTED_AT}。`,
        ':::',
      ]
    : [
        '::: warning Unreleased documentation',
        'This page describes the alpha branch and may change at any time; it is not part of any released version.',
        `Injected from commit \`${shortSha}\` at ${INJECTED_AT}.`,
        ':::',
      ];
  return lines.join('\n');
}

const missingEntryPages = [];
let bannerInsertedCount = 0;
for (const { rel, lang } of ENTRY_PAGES) {
  const filePath = path.join(ARCHIVE_DEST, rel);
  if (!existsSync(filePath)) {
    missingEntryPages.push(rel);
    continue;
  }
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatter(content);
  const banner = warningBanner(lang);
  const newContent = parsed
    ? `${parsed.raw}${banner}\n\n${parsed.rest}`
    : `${banner}\n\n${content}`;
  writeFileSync(filePath, newContent);
  bannerInsertedCount += 1;
}
// Fail closed rather than silently insert fewer than four: these four paths
// exist on alpha today, so a miss means alpha's directory layout changed
// underneath this script (03-02-PLAN.md Task 1) — not something to paper
// over with a partial banner set.
if (missingEntryPages.length > 0) {
  fail(`entry page(s) not found for unreleased-documentation banner: ${missingEntryPages.join(', ')}`);
}
if (bannerInsertedCount !== 4) {
  fail(`expected exactly 4 unreleased-documentation banners, inserted ${bannerInsertedCount}`);
}

// ── 8. docs/public/snapshot-status.json ─────────────────────────────────────
// docs/public/ is copied verbatim to the deployed site root (docs/public/
// _redirects is the existing live proof of that path), so this becomes
// https://dev.ultikits.com/snapshot-status.json — the nightly workflow's
// (03-CONTEXT.md D-51) debounce read. Four flat string fields, no nesting:
// a plain `curl | node -e "JSON.parse(...).commit"` read shouldn't need a
// jq path expression to get at the one field it cares about.
mkdirSync('docs/public', { recursive: true });
const snapshotStatus = {
  commit: commitSha,
  ref: ALPHA_REF,
  injectedAt: INJECTED_AT,
  generator: 'scripts/inject-alpha.mjs',
};
writeFileSync(
  path.join('docs', 'public', 'snapshot-status.json'),
  `${JSON.stringify(snapshotStatus, null, 2)}\n`
);

// ── 9. Summary ───────────────────────────────────────────────────────────
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
  `frontmatter metadata on ${frontmatterProcessedCount} file(s), ` +
  `${bannerInsertedCount} unreleased-documentation banner(s), ` +
  `commit ${commitSha.slice(0, 7)}, snapshot-status.json written`
);
