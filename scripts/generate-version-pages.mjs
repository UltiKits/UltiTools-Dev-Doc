// Reads the page set of every documentation version on disk — docs/src for the
// current release, and each docs/archive/<name>/ directory for every archived
// version plus the alpha snapshot — and writes it, together with the current
// version's name, into .vitepress/config/version-pages.generated.mjs.
//
// Why this matters: .vitepress/theme/components/VersionNoticeBar.vue has to
// decide, while rendering an archived page, whether the SAME page exists in the
// current release. If it does, the notice links straight at it ("View this page
// in v6.2.5 →"); if it does not, the notice falls back to the current release's
// locale root under deliberately different wording ("Go to the latest version
// →", D-58), so a fallback reads as a fallback instead of as the same promise
// pointing somewhere else. A browser cannot stat the filesystem, so that answer
// has to be computed at build time and shipped as data. The same manifest
// carries KNOWN_VERSIONS, which is what lets a path segment be recognised as a
// version name rather than guessed at, and CURRENT_VERSION, which is what the
// three-state classification (D-57) compares against.
//
// Failure semantics are deliberately the UNION of this repo's two existing
// generators, because the two failure modes are not the same kind of event:
//
//   - Infrastructure absent → fail closed. readdirSync throwing on docs/src or
//     docs/archive is left uncaught, so it propagates out of this module and
//     kills the build — the same posture as scripts/generate-api-version.mjs
//     (D-44). If we cannot read our own content tree, every page's version
//     classification is wrong, and a wrong notice bar on every page is worse
//     than no build at all.
//   - Content absent → always write. A version directory that simply contains
//     no markdown writes an empty array and does not error — the same posture
//     as scripts/generate-snapshot-sidebar.mjs (D-39). "This version has no
//     pages" is a content state, not a broken toolchain.
//
// CURRENT_VERSION is parsed out of .vitepress/config.mts rather than duplicated
// here, so there is one source of truth for it. Exactly one match is required:
// zero or several means versionsConfig's shape moved, and a guessed value would
// silently mis-classify every page on the site — every archived page claiming
// to be the current release, or the current release claiming to be archived —
// instead of failing.
//
// Unlike scripts/generate-api-version.mjs, this script does NOT filter out
// directory names ending in "-SNAPSHOT". That script's array means "versions
// with a real javadoc.io index", which a snapshot has never had. This script's
// arrays mean "versions that exist on this site", and the three-state rule
// needs the snapshot name specifically: it is the entire input to the alpha
// state.
//
// The generated file is gitignored and never committed, for the same reason as
// every other generated file here: a committed copy would be byte-identical to
// a stale run and would silently mask a failed generation instead of failing
// closed. Its consumer imports it unconditionally and makes no existsSync check
// of its own (D-46) — which is why this script must be invoked from BOTH the
// build and the dev npm scripts. Adding it to build alone leaves `npm run dev`
// failing on that unconditional import.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.join('.vitepress', 'config.mts');
const SRC_DIR = path.join('docs', 'src');
const ARCHIVE_DIR = path.join('docs', 'archive');
const OUTPUT_PATH = path.join('.vitepress', 'config', 'version-pages.generated.mjs');

const config = readFileSync(CONFIG_PATH, 'utf-8');

// Multiline-anchored on the `current:` key so a `current` appearing inside a
// string, a comment or a longer identifier cannot match. Exactly one hit is
// required; see the header for why a fallback would be worse than an exit.
const currentMatches = [...config.matchAll(/^\s*current:\s*['"]([^'"]+)['"]/gm)];

if (currentMatches.length !== 1) {
  console.error(
    `generate-version-pages: expected exactly one versionsConfig "current:" key in ${CONFIG_PATH}, found ${currentMatches.length}`
  );
  process.exit(1);
}

const CURRENT_VERSION = currentMatches[0][1].trim();

// A page key is the extension-stripped, locale-inclusive path relative to its
// own version root:
//   docs/archive/v6.2.1/zh/guide/introduction.md -> zh/guide/introduction
//   docs/src/index.md                            -> index
//   docs/src/zh/index.md                         -> zh/index
// The version segment is absent by construction, which is what makes two
// versions' key sets directly comparable.
function collectPageKeys(rootDir) {
  const keys = [];

  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(child, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const base = entry.name.slice(0, -'.md'.length);
        keys.push(prefix ? `${prefix}/${base}` : base);
      }
    }
  };

  walk(rootDir, '');
  return keys.sort();
}

// readdirSync's own exception is left unhandled here on purpose (see header).
const KNOWN_VERSIONS = readdirSync(ARCHIVE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const VERSION_PAGES = { [CURRENT_VERSION]: collectPageKeys(SRC_DIR) };

for (const name of KNOWN_VERSIONS) {
  VERSION_PAGES[name] = collectPageKeys(path.join(ARCHIVE_DIR, name));
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

writeFileSync(
  OUTPUT_PATH,
  `// Generated by scripts/generate-version-pages.mjs at build time. Do not edit by hand.
export const CURRENT_VERSION = ${JSON.stringify(CURRENT_VERSION)};
export const KNOWN_VERSIONS = ${JSON.stringify(KNOWN_VERSIONS)};
export const VERSION_PAGES = ${JSON.stringify(VERSION_PAGES)};
`
);

const totalPages = Object.values(VERSION_PAGES).reduce((sum, keys) => sum + keys.length, 0);

console.log(
  `generate-version-pages: wrote ${OUTPUT_PATH} (current=${CURRENT_VERSION}, ` +
  `${Object.keys(VERSION_PAGES).length} versions, ${totalPages} pages)`
);
