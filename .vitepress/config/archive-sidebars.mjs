// Single source of truth for which frozen sidebar each archived version uses.
//
// Consumers:
//   - .vitepress/config/locale.en.mts and locale.zh.mts build their
//     `<version>/guide/` and `<version>/api/` sidebar keys from this table.
//   - scripts/check-sidebar-links.sh reads the same table (through
//     `node scripts/archive-sidebars-plan.mjs`) to decide which constant to
//     resolve against which archived tree.
//
// Before this file existed the mapping was written twice, once in the locale
// configs and once in the check script. Pointing v6.2.4 at the wrong sidebar
// in the locale config rendered 10 dead links while the script still exited
// 0, and an archived version missing from the script was not checked at all.
//
// Plain ESM (not .mts) on purpose: the bash check script loads it with a bare
// `node`, with no TypeScript loader.
//
// Table shape, per archived version:
//   guide: the suffix of the frozen guide sidebar constant, so 'v624' means
//          sidebarGuideEN_v624 / sidebarGuideZH_v624. Required.
//   api:   'shared' -> sidebarApiEN / sidebarApiZH; null -> no API sidebar
//          (an empty array), because that release tree has no api/ pages.
//
// Adding an archived version: run scripts/archive-version.sh, then add one
// row here. Forgetting the row fails the build and the sidebar check with a
// message naming the version (assertArchiveSidebarsComplete below).

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARCHIVE_SIDEBARS = Object.freeze({
    'v6.3.2': Object.freeze({ guide: 'v632', api: null }),
    'v6.3.1': Object.freeze({ guide: 'v631', api: null }),
    'v6.3.0': Object.freeze({ guide: 'v630', api: null }),
    'v6.2.5': Object.freeze({ guide: 'v625', api: null }),
    'v6.2.4': Object.freeze({ guide: 'v624', api: 'shared' }),
    'v6.2.3': Object.freeze({ guide: 'v624', api: 'shared' }),
    'v6.2.2': Object.freeze({ guide: 'v624', api: 'shared' }),
    'v6.2.1': Object.freeze({ guide: 'v620', api: 'shared' }),
    'v6.2.0': Object.freeze({ guide: 'v620', api: 'shared' }),
    'v6.1.0': Object.freeze({ guide: 'v610', api: 'shared' }),
});

// The alpha snapshot directory that scripts/inject-alpha.mjs creates. It is
// generated, gitignored and has its own sidebar (sidebar-snapshot.generated.mjs),
// so it never appears in the table above.
export const SNAPSHOT_DIR_PATTERN = /^v\d+\.\d+\.\d+-SNAPSHOT$/;

export const DEFAULT_ARCHIVE_DIR = fileURLToPath(new URL('../../docs/archive', import.meta.url));

const LOCALE_ROOTS = { en: '', zh: 'zh' };

// Compares the table with what is on disk. Every problem is collected and
// reported at once, and the function throws: a build that cannot say which
// sidebar an archived tree uses must not render it with a guessed one.
//
// snapshotVersion is the label the current injection produced (or null when
// nothing was injected). A SNAPSHOT directory on disk that does not match it
// is a leftover from an earlier injection; it would render with no sidebar.
export function assertArchiveSidebarsComplete({ archiveDir = DEFAULT_ARCHIVE_DIR, snapshotVersion = null } = {}) {
    const problems = [];
    const onDisk = readdirSync(archiveDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('v'))
        .map((entry) => entry.name);

    for (const name of onDisk) {
        if (SNAPSHOT_DIR_PATTERN.test(name)) {
            if (name !== snapshotVersion) {
                problems.push(
                    `docs/archive/${name} is a SNAPSHOT tree, but the current injection label is ` +
                    `${snapshotVersion ?? '(none: nothing injected)'}. It is a leftover from an earlier ` +
                    `injection; run \`npm run clean:snapshot\` (and \`npm run build:with-alpha\` if you want alpha content).`
                );
            }
            continue;
        }
        if (!Object.hasOwn(ARCHIVE_SIDEBARS, name)) {
            problems.push(`docs/archive/${name} has no row in ARCHIVE_SIDEBARS (.vitepress/config/archive-sidebars.mjs).`);
        }
    }

    for (const [version, entry] of Object.entries(ARCHIVE_SIDEBARS)) {
        const versionDir = path.join(archiveDir, version);
        if (!onDisk.includes(version)) {
            problems.push(`ARCHIVE_SIDEBARS has a row for ${version}, but docs/archive/${version} does not exist.`);
            continue;
        }
        if (typeof entry.guide !== 'string' || entry.guide === '') {
            problems.push(`ARCHIVE_SIDEBARS.${version}.guide must name a frozen guide sidebar suffix.`);
        }
        if (entry.api !== null && entry.api !== 'shared') {
            problems.push(`ARCHIVE_SIDEBARS.${version}.api must be 'shared' or null, got ${JSON.stringify(entry.api)}.`);
        }
        for (const [lang, sub] of Object.entries(LOCALE_ROOTS)) {
            const root = path.join(versionDir, sub);
            if (!existsSync(path.join(root, 'guide'))) {
                problems.push(`docs/archive/${version}/${sub ? `${sub}/` : ''}guide is missing (${lang}).`);
            }
            const hasApi = existsSync(path.join(root, 'api'));
            if (hasApi && entry.api === null) {
                problems.push(`docs/archive/${version}/${sub ? `${sub}/` : ''}api exists, but ARCHIVE_SIDEBARS.${version}.api is null (${lang}).`);
            }
            if (!hasApi && entry.api !== null) {
                problems.push(`ARCHIVE_SIDEBARS.${version}.api is '${entry.api}', but docs/archive/${version}/${sub ? `${sub}/` : ''}api does not exist (${lang}).`);
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(`archive sidebar mapping does not match docs/archive:\n  - ${problems.join('\n  - ')}`);
    }
}

// Builds the `<version>/guide/` and `<version>/api/` sidebar entries for one
// locale. guideConstants maps each guide suffix used in the table to that
// locale's constant; an unknown suffix throws instead of rendering nothing.
export function archiveSidebarEntries({ guideConstants, apiShared, snapshotVersion = null }) {
    assertArchiveSidebarsComplete({ snapshotVersion });
    const entries = {};
    for (const [version, { guide, api }] of Object.entries(ARCHIVE_SIDEBARS)) {
        if (!Object.hasOwn(guideConstants, guide)) {
            throw new Error(`ARCHIVE_SIDEBARS.${version}.guide is '${guide}', but the locale config passes no constant for it.`);
        }
        entries[`${version}/guide/`] = guideConstants[guide];
        entries[`${version}/api/`] = api === 'shared' ? apiShared : [];
    }
    return entries;
}
