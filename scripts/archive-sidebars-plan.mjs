// Prints the archived-version -> frozen-sidebar plan for
// scripts/check-sidebar-links.sh, read from the single source of truth
// .vitepress/config/archive-sidebars.mjs (the locale configs read the same
// table). One tab-separated line per check:
//
//   guide<TAB><constant><TAB><lang><TAB><version> [<version> ...]
//   api<TAB><constant><TAB><lang><TAB><version> [<version> ...]
//
// Before printing, it runs the same completeness assertion the build runs, so
// an archived directory with no row, or a row with no directory, fails the
// check (exit 2) instead of leaving that version unchecked. Leftover SNAPSHOT
// trees are not this check's concern (the build reports them), so the
// assertion is told about whichever SNAPSHOT directory is present.

import { readdirSync } from 'node:fs';
import {
  ARCHIVE_SIDEBARS,
  DEFAULT_ARCHIVE_DIR,
  SNAPSHOT_DIR_PATTERN,
  assertArchiveSidebarsComplete,
} from '../.vitepress/config/archive-sidebars.mjs';

const archiveDir = process.env.ARCHIVE_DIR || DEFAULT_ARCHIVE_DIR;
const snapshots = readdirSync(archiveDir).filter((name) => SNAPSHOT_DIR_PATTERN.test(name));

try {
  assertArchiveSidebarsComplete({ archiveDir, snapshotVersion: snapshots.length === 1 ? snapshots[0] : null });
} catch (err) {
  console.error(`archive-sidebars-plan: ${err.message}`);
  process.exit(2);
}

for (const [lang, L] of [['en', 'EN'], ['zh', 'ZH']]) {
  const guides = new Map();
  const api = [];
  for (const [version, entry] of Object.entries(ARCHIVE_SIDEBARS)) {
    const constant = `sidebarGuide${L}_${entry.guide}`;
    if (!guides.has(constant)) guides.set(constant, []);
    guides.get(constant).push(version);
    if (entry.api === 'shared') api.push(version);
  }
  for (const [constant, versions] of guides) {
    console.log(['guide', constant, lang, versions.join(' ')].join('\t'));
  }
  if (api.length > 0) {
    console.log(['api', `sidebarApi${L}`, lang, api.join(' ')].join('\t'));
  }
}
