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
- 不手改 `docs/archive/`。那是发版时由版本化机制切分的历史快照，内容冻结；仅当它使全站门禁无法通过时才做最小修复，且不改动描述 API 行为的文字。
- 本仓库是 public 的。不提交本地绝对路径、token、凭证。
