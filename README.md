# UltiTools 新版开发文档

这里是焕然一新的 [dev.doc.ultikits.com](https://ultitools.doc.ultikits.com)。

## 如何在本地编辑和预览该网站

本项目要求 Node.js 20，版本号钉在仓库根目录的 `.node-version` 里。

网站内容以 Markdown 格式书写，位于 `docs` 文件夹中。

```sh
npm ci
npm run dev
```

包管理器是 npm。不要用 pnpm：本仓库的 `pnpm-lock.yaml` 是被删掉的，见下一节。

## 构建环境

站点由 Cloudflare Pages 构建与部署，构建系统主版本号为 3。Cloudflare 会在 2027-02-23 把仍停留在构建系统 v2 的项目强制迁移，官方未提供从 v3 退回 v2 的通路；本项目已在该日期之前主动完成迁移。

Node 版本由仓库根目录的 `.node-version` 钉住，构建镜像读取该文件确定使用的 Node 版本。

`package-lock.json` 是仓库里唯一的锁文件，这个锁必须生效：它把 `markdown-it` 固定在一个确定版本，而 `@nolebase/markdown-it-bi-directional-links` 依赖的模块路径只存在于该版本。锁文件一旦被忽略，依赖会被解析到更高版本并导致构建失败——这正是 `pnpm-lock.yaml` 被删掉的原因：它是 lockfileVersion 9.0，而构建镜像里的 pnpm 读不懂，会静默降级成无锁安装。

仓库里没有 `engines` 字段、没有 `packageManager` 字段、没有 `yarn.lock`、也没有 `pnpm-lock.yaml`。构建系统 v3 删掉了依据这四者探测包管理器版本的行为，本仓库不依赖其中任何一条。

## 缓存与离线能力

本站不提供离线可用能力，内容更新在下一次正常访问就到达。详见 [CACHING.md](CACHING.md)。

## 如何参与贡献

目前网站处于维护状态，我们会定期更新文档内容。欢迎大家：

- 将文档翻译成其他语言
- 修复错别字或错误的书写格式
- 发 issue 讨论译法或书写格式
- 发 issue 讨论部署或协作流程上的问题
