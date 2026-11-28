# 支持 1.21 以下的服务端

本页提供旧服务端历史文档的入口。

自 v7.0.0 起，UltiTools 的目标环境为 **Paper 26.3 build 258 与 Java 25**。[框架构建][pom]使用 `paper-api:26.3.build.258-stable`，以 `--release 25` 编译。这是单一目标基准，不是最低版本范围；旧版 Paper 和普通 Spigot 不属于支持目标。

自 v7.0.0 起，框架按原样加载模块 JAR，不再在加载期改写字节码、探测服务端 API，也不再执行启动或离线链接审计。将模块迁到新基准之前，参见[框架兼容性政策][admission]与 [7.0 升级指南](./upgrading-to-7)。

如果必须在旧服务端上运行，请留在 6.x 线，选择支持该服务端的框架与模块版本。见 [6.5.0 归档指南：支持 1.21 以下的服务端](/zh/v6.5.0/guide/advanced/older-servers.html)，其中说明了旧版如何适配、有哪些限制，以及在旧版 Paper 上应验证哪些行为。

[pom]: https://github.com/UltiKits/UltiTools-Reborn/blob/main/pom.xml
[admission]: https://github.com/UltiKits/UltiTools-Reborn/blob/main/COMPATIBILITY.md#module-api-floor-700-and-plain-module-loading-as-of-700
