// Prints the alpha snapshot label that the last `npm run build:with-alpha`
// injected (for example v6.4.0-SNAPSHOT), for shell checks such as
// scripts/check-rendered-links.sh and the docs-ci build-with-alpha job.
//
// The label is decided once, by scripts/inject-alpha.mjs, from the framework's
// main-branch pom.xml, and written to
// .vitepress/config/.snapshot-source/snapshot-version.json. This script only
// reads that file. Exit 1 with a reason on stderr when nothing was injected or
// the file is malformed: a shell check must never fall back to a guessed label.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '.vitepress', 'config', '.snapshot-source', 'snapshot-version.json');

let parsed;
try {
  parsed = JSON.parse(readFileSync(SRC, 'utf-8'));
} catch (err) {
  console.error(`snapshot-version: cannot read ${path.relative(ROOT, SRC)} (${err.code ?? err.message}); run npm run build:with-alpha first`);
  process.exit(1);
}
if (typeof parsed?.version !== 'string' || !/^v\d+\.\d+\.\d+-SNAPSHOT$/.test(parsed.version)) {
  console.error(`snapshot-version: ${path.relative(ROOT, SRC)} has no vX.Y.Z-SNAPSHOT "version" field: ${JSON.stringify(parsed?.version)}`);
  process.exit(1);
}
console.log(parsed.version);
