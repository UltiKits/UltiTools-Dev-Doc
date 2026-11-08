// Shared numeric version comparison for the build scripts.
//
// Version names are compared as major.minor.patch numbers, never as text
// (as text, v6.10.0 would sort before v6.2.5). A pre-release suffix such as
// -SNAPSHOT sorts just before its release: 6.3.2 < 6.4.0-SNAPSHOT < 6.4.0.
// A leading "v" is optional. Names that do not parse as a version sort after
// all versions, in plain text order, so the result stays deterministic.

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;

function parse(name) {
  const m = VERSION_RE.exec(name);
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
}

export function compareVersions(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) {
    if (pa) return -1;
    if (pb) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  for (let i = 0; i < 3; i += 1) {
    if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] - pb.nums[i];
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}
