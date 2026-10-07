# 参与本仓库

本仓库是 UltiTools 开发文档站的源码：VitePress 站点本身，加上它承载的中英双语文档内容。

这两样东西由不同的流程负责，改动前先确定自己在做哪一类。

## 两类改动

| | 站点 | 内容 |
|---|---|---|
| 改什么 | 站点怎么构建、怎么渲染、怎么被检查 | 页面上写了什么 |
| 文件 | `.vitepress/`、`scripts/`、`.github/workflows/`、`package.json`、`examples/pom.xml`、`AGENTS.md` | `docs/src/**/*.md`、`examples/src/**/*.java` |
| 由谁驱动 | 本仓库自己的规划 | 框架仓库 `UltiTools-Reborn` 的改动 |
| 什么时候做 | 需要时 | 框架改动落地的同一个会话内 |

**归属按改动的目的判断，不按它碰了哪些文件。** 新增一个页面需要往 sidebar 加两行，那两行属于内容类改动；重构 sidebar 机制导致每个页面都要调整，那些页面属于站点类改动。

### 站点类改动

站点类改动走本仓库的规划流程，一个改动一个分支一个 PR。

一条硬性要求：**加门禁的同时要把它抓出来的既有违规修到零**。新门禁在 `master` 上必须是绿的，不能靠豁免清单或延后处理来通过。`scripts/check-container-length.sh` 落地时先修掉了 13 处既有违规才接进 CI，是这条的先例。

### 内容类改动

内容类改动由框架侧驱动。框架仓库每落地一个改变已文档化行为的改动，**在同一个会话内**同步到本仓库。

这个时机是刻意的。隔几周再补写，当时为什么这么改、哪些方案被否掉、要对齐哪一行 javadoc，这些都已经拿不回来了。

内容类改动允许连带修改承载它所必需的 sidebar 条目，不允许改动 sidebar 的组织方式。

行文规范见 `AGENTS.md`，它是唯一权威源。

## 分支

`master` 是**已发布**内容，dev.ultikits.com 从它部署。`alpha` 是**未发布**内容，对应框架仓库的 `alpha`。

两者的默认分支都指向已发布那一层，所以 `gh pr create` 不带 `--base` 会开到错的分支。**始终显式写 `--base alpha`。**

不直接推 `master`，也不直接推 `alpha`，一律走 PR。

## `alpha` 上可以写什么

可以写未发布的行为，但必须标出它落地的版本（`自 v6.3.0 起`）。

两件事在 `alpha` 上仍然不许做：

- 新增指向未发布 API 的 `<<< @/../examples/...` 引用。`examples/` 编译的是 Maven Central 上的正式版，这类引用在 `alpha` 上就会让 `examples-ci.yml` 变红。
- 改动 `versionsConfig.current` 或 `examples/pom.xml` 的 `<ultitools.version>`。这两个值与 Maven Central 的最新正式版构成三元等式，由 `scripts/check-version-consistency.sh` 守着，只在发版归档时一起推进。

## 发版归档

发版时把上一个正式版的文档切成 `docs/archive/<版本>/`。**用脚本，不要手工 `cp -r`**，也不要从 `alpha` 的工作区切：`alpha` 已经带着下一个版本的页面和示例，从那里切出来的 v6.2.5 归档会含有 6.3.0 才有的页面。

脚本从**同一个提交**读取页面和示例（`git archive`），复制到 `docs/archive/<版本>/`，把页面引用的每个示例冻结到 `examples-archive/<版本>/`（不是 Maven 模块，不编译），并把归档页面里的 `<<< @/../examples/` 改写为 `<<< @/../examples-archive/<版本>/`。原因：`examples/` 随每次发版变化，归档页面如果继续引用它，就会在归档之后被改写。v6.2.4 的归档实测有 78 个示例文件，其中 11 个在切出之后已经变了。

按下面四步依次执行，没有第二条路径：

1. 在发版的 `alpha` → `master` 合并**之前**记下提交：`REF=$(git rev-parse origin/master)`。合并之后 `master` 已经带着新版本的页面，再取就晚了。
2. 在从 `alpha` 切出的分支上，用这个提交切归档：`ARCHIVE_REF=$REF bash scripts/archive-version.sh v6.2.5`。没有设置 `ARCHIVE_REF` 以退出码 2 拒绝；不在 `origin/master` 上的提交、`examples/pom.xml` 或 `versionsConfig.current` 与归档版本不一致的提交，都会被拒绝；中途失败会清掉已写入的部分，可以直接重试。
3. 从**同一个提交**取 sidebar 快照：`sidebarGuide*_v625` 的字面量来自 `git show $REF:.vitepress/config/sidebar.en.mts` 和 `sidebar.zh.mts`，不要从 `alpha` 的 sidebar 复制。同时手工更新两处版本清单：`scripts/javadoc-io-index.sh` 的 `BACKFILL_VERSIONS`，以及 `scripts/check-sidebar-links.sh` 里各个 sidebar 常量的版本参数。
4. 最后才推进版本三元等式：`versionsConfig.current`、`examples/pom.xml` 的 `<ultitools.version>`、示例源码。

脚本不改 `.vitepress/config*`、sidebar 常量、两处版本清单和 `examples/pom.xml`，这些是第 3、4 步的手工部分。`docs-ci.yml` 的 `archive-examples` job 运行 `scripts/check-archive-examples.sh`：`docs/archive/` 下出现任何 `<<< @/../examples/` 引用，或 `examples-archive/` 引用指向不存在的文件，都会变红。这个 job 只检查引用，检查不出归档页面的内容是否来自正确的提交，所以第 1、2 步的顺序靠本节保证。

## 构建

```bash
npm install
npm run build
npm run dev
```

**用 npm，不要用 pnpm。** `package-lock.json` 是唯一可信的锁，它把 `markdown-it` 钉在 14.1.1。Cloudflare Pages 的构建镜像装的是 pnpm 8.7.1，读不懂 lockfileVersion 9.0 的 pnpm 锁文件时会静默降级成无锁安装，把 `markdown-it` 解析到 15.0.0，而 `@nolebase/markdown-it-bi-directional-links` 仍在 import 旧版才有的路径，构建随即失败。

**不要写成 `vitepress build docs`。** 传路径参数会改变 root 并找不到配置文件。裸跑 `npm run build`。

## 边界

- 不改 `node_modules/`、`.vitepress/dist/`、`.vitepress/cache/`、`dev-dist/`。
- 不手改 `docs/archive/`。那是发版时由版本化机制切分的历史快照，内容冻结；仅当它使全站门禁无法通过时才做最小修复，且不改动描述 API 行为的文字。归档页面引用的示例由 `scripts/archive-version.sh` 冻结在 `examples-archive/<版本>/`，不再引用 `examples/`。
- 本仓库是 public 的。不提交本地绝对路径、token、凭证。
