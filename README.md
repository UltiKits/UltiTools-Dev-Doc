# UltiTools 新版开发文档

这里是焕然一新的 [dev.doc.ultikits.com](https://ultitools.doc.ultikits.com)。

## 如何在本地编辑和预览该网站

本项目要求：

- Node.js 为 `v14.0.0` 或更高版本
- pnpm 为 `v7.4.0` 或更高版本

网站内容以 Markdown 格式书写，位于 `docs` 文件夹中。

```sh
pnpm i
pnpm run dev
```

## 构建环境

站点由 Cloudflare Pages 构建与部署，构建系统主版本号为 3。Cloudflare 会在 2027-02-23 把仍停留在构建系统 v2 的项目强制迁移，官方未提供从 v3 退回 v2 的通路；本项目已在该日期之前主动完成迁移。

Node 版本由仓库根目录的 `.node-version` 钉住，构建镜像读取该文件确定使用的 Node 版本。

包管理器是 npm，`package-lock.json` 是仓库里唯一的锁文件（上一节的 `pnpm i` 是历史遗留，不反映当前策略）。锁文件把 `markdown-it` 固定在一个确定版本，这个锁必须生效：`@nolebase/markdown-it-bi-directional-links` 依赖的模块路径只存在于该版本，锁文件一旦被忽略，依赖会被解析到更高版本并导致构建失败。

仓库里没有 `engines` 字段、没有 `packageManager` 字段、没有 `yarn.lock`、也没有 `pnpm-lock.yaml`。构建系统 v3 删掉了依据这四者探测包管理器版本的行为，本仓库不依赖其中任何一条。

## 如何参与贡献

目前网站处于维护状态，我们会定期更新文档内容。欢迎大家：

- 将文档翻译成其他语言
- 修复错别字或错误的书写格式
- 发 issue 讨论译法或书写格式
- 发 issue 讨论部署或协作流程上的问题
