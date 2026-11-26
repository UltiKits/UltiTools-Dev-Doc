# 从 6.x 升级到 7.0

7.0.0 尚未发布。完整的升级指南将在后续文档更新中补齐。

这是 UltiTools 模块作者和[使用框架的外部插件](/zh/guide/advanced/external-plugin-api)作者的升级总入口。下列清单链接到已有的迁移说明。模块 JAR 准入和 `/upm` 相关步骤仅适用于 UltiTools 模块，不适用于独立的 Paper 插件。

## 升级检查清单

1. 核对新的构建目标和 [6.x 模块升级到 7.0 的要求](./module-versioning#modules-6x-to-7)。
2. 核对[已删除的 API](./module-versioning#api-被移除)，在重新构建前替换旧调用。
3. 将[文本与语言文件](./module-versioning#_7-0-的文本与语言)迁移到 7.0 的消息系统。
4. 核对[物品构建与存储](./module-versioning#item-construction-7)和[旧箱子页面与确认组件](./module-versioning#legacy-chest-removal)。
5. 重新构建并[检查生成的模块 JAR](./module-versioning#检查产物)。
6. 阅读[启动时应用模块变更与恢复](./module-versioning#启动时应用与恢复)，再重启测试服务器以验证升级。
