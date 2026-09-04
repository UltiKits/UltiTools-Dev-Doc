// Version classification and path construction, shared by the version-state
// notice bar and (from plan 04-03) the version switcher.
//
// Every function here is pure: it takes all of its inputs as arguments and
// reads no ambient state. That is the whole point. VitePress server-renders
// each route with route.data.relativePath already known and the client
// recomputes the identical value during hydration, so as long as nothing here
// branches on a browser-only global, server output and client output match
// byte for byte and no hydration mismatch can fire. This is the same shape
// node_modules/@viteplus/versions/components/version-switcher.component.vue
// already runs safely in production (D-60/D-62: reproduce that rule, do not
// reinvent it).
//
// Measured relativePath shapes on this site (read out of the built page chunks
// under .vitepress/dist/assets/, not assumed):
//
//   zh/v6.2.1/guide/introduction.md   archived, Chinese
//   v6.2.1/guide/introduction.md      archived, English
//   zh/guide/introduction.md          current release, Chinese
//   guide/introduction.md             current release, English
//   index.md / zh/index.md            either locale's homepage
//
// The locale segment, when present, comes FIRST — before the version segment.
// That ordering is what the served URL shape below has to match. Note that
// activeVersion and pageKey below are deliberately insensitive to the order:
// both reduce the two orderings to the same answer, so only buildPath's
// emission had to change when the ordering flipped.

export type VersionState = 'current' | 'archived' | 'alpha';

// This site has exactly two locales: the root locale (English, no path segment)
// and Chinese under a single `zh` segment. That segment is hardcoded here on
// purpose. Deriving it from site data would be less correct here, not more:
// VitePress mis-resolves site.localeIndex on archived Chinese pages
// (04-RESEARCH.md finding 3 — the same root cause that leaves those pages with
// no sidebar), so a site-data-derived locale would be wrong on a large part of
// exactly the page set this module exists to serve.
const LOCALE_SEGMENT = 'zh';

function segmentsOf(relativePath: string): string[] {
  return relativePath.replace(/\.md$/, '').split('/').filter(Boolean);
}

/**
 * The version a page belongs to, or `current` when the path carries no version
 * segment. Same rule as version-switcher.component.vue:37-46: the version is
 * the first segment, unless the first segment is the locale, in which case it
 * is the second — and it only counts when it is a name we actually know.
 */
export function activeVersion(
  relativePath: string,
  versions: string[],
  current: string
): string {
  const segs = segmentsOf(relativePath);
  const candidate = segs[0] === LOCALE_SEGMENT ? segs[1] : segs[0];
  return candidate && versions.includes(candidate) ? candidate : current;
}

/**
 * The three-state classification (D-57). `current` is the state that renders no
 * DOM node at all (VER-07); it is never a hidden node.
 */
export function versionState(version: string, current: string): VersionState {
  if (version === current) return 'current';
  return version.endsWith('-SNAPSHOT') ? 'alpha' : 'archived';
}

/**
 * The version-stripped, extension-stripped, locale-inclusive page key —
 * the form the build-time manifest is keyed on, and the form that makes two
 * versions' page sets directly comparable.
 */
export function pageKey(relativePath: string, versions: string[]): string {
  return segmentsOf(relativePath)
    .filter((seg) => !versions.includes(seg))
    .join('/');
}

/**
 * Whether `target` carries the same page the reader is currently on. Drives
 * D-58's two link wordings: a same-page link when true, a locale-root fallback
 * under different wording when false.
 */
export function pageExists(
  target: string,
  relativePath: string,
  versions: string[],
  pages: Record<string, string[]>
): boolean {
  const keys = pages[target];
  return Array.isArray(keys) && keys.includes(pageKey(relativePath, versions));
}

/**
 * The URL the site actually serves for this page in `target`:
 *
 *   /<locale>/<version>/<rest>.html   when target is not the current release
 *   /<locale>/<rest>.html             when it is
 *
 * The locale segment comes first. It used to come second, because the site
 * served /<version>/<locale>/<rest> — a shape produced by `link: '/zh/'` in
 * locale.zh.mts, which stopped @viteplus/versions from recognising `zh` as a
 * language at all. With that line removed the plugin emits the locale first,
 * matching the locale keys it generates internally, and this function has to
 * agree with it: a link built the old way now 404s.
 *
 * The .html suffix is required rather than cosmetic: cleanUrls is not set in
 * .vitepress/config.mts, so every link already present in the built output
 * carries it, and a suffixless URL is not served. Keys that are `index` or end
 * in `/index` collapse to the directory form with a trailing slash instead,
 * which is the form the site serves for those.
 */
export function buildPath(
  target: string,
  relativePath: string,
  versions: string[],
  current: string
): string {
  const segs = segmentsOf(relativePath).filter((seg) => !versions.includes(seg));
  const locale = segs[0] === LOCALE_SEGMENT ? (segs.shift() as string) : '';
  let rest = segs.join('/');

  const isIndex = rest === 'index' || rest.endsWith('/index');
  if (isIndex) {
    rest = rest.slice(0, -'index'.length).replace(/\/$/, '');
  }

  const base = '/' + [locale, target === current ? '' : target, rest].filter(Boolean).join('/');

  if (!isIndex) return base + '.html';
  return base.endsWith('/') ? base : base + '/';
}
