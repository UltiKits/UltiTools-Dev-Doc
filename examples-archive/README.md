# examples-archive

Frozen copies of the `examples/` sources that archived documentation versions include with
`<<< @/../examples-archive/<version>/...`. They are not a Maven module and are not compiled: an
archived page shows the code as it was when that version was archived.

- `v6.2.4/` holds the 78 files the v6.2.4 archive references, byte-for-byte as in commit `d673301`
  ("archive v6.2.4 and update to v6.2.5"), the commit that copied the pages into `docs/archive/`.
- Nothing under `docs/archive/` may reference the live `examples/` folder. `scripts/check-archive-examples.sh`
  fails the `archive-examples` job in `docs-ci.yml` if one does, and also if a reference here does not resolve.
- `scripts/archive-version.sh` cuts a new archive and freezes its examples here in the same step (see CONTRIBUTING.md).

冻结的示例代码：归档版本的页面通过 `<<< @/../examples-archive/<版本>/...` 引用这里的文件，而不是会随发版变化的 `examples/`。
