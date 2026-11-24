# 启动阶段与早期钩子

自 v7.0.0 起，UltiTools 框架 JAR 是一个 Paper 插件：它携带 `paper-plugin.yml`，不再携带 `plugin.yml`。模块 JAR 不变，仍用自己的 `plugin.yml` 描述自身。框架的描述文件声明了 `api-version: '26.3'`、`load: POSTWORLD`、一个引导器（bootstrapper）和一个运行库加载器，并把 Vault 与 PlaceholderAPI 列为可选的服务器依赖。

::: warning 未发布的 v7.0.0 行为
本页描述尚未发布的 7.0.0 框架。6.x 框架没有引导阶段，也不会调用早期钩子。
:::

## 两个阶段

启动现在分两个阶段进行。

1. 引导阶段，在任何世界加载之前。Paper 先解析框架的运行库。随后 UltiTools 应用待处理的模块更新与删除，接纳 `plugins/UltiTools/plugins/` 中的模块 JAR，构建共享的模块类加载器，并调用每个已接纳且声明了早期钩子的模块的钩子。该阶段以一行汇总结束：

   ```text
   [UltiTools] Bootstrap: processed pending module changes; 3 module JAR(s) on the module class path; 1 module bootstrap(s) ran, 0 failed.
   ```

2. 启用阶段，在世界加载之后。模块发现、构造、IoC 容器、命令、监听器以及常规的 `registerSelf()` 钩子都在这里运行，与 6.x 相同。服务器插件和 Bukkit 服务只从这一阶段起可用。

如果引导准备整体失败，框架会连同错误输出 `[UltiTools] Failed to prepare module bootstrap; the framework will be disabled during enable.`，并在启用阶段禁用自身。它不会以空的模块集合继续启动。

## 早期钩子

模块可以在自己的 `plugin.yml` 中用 `bootstrapper:` 指定一个类，在引导阶段运行代码：

```yaml
name: MyModule
main: com.example.mymodule.MyModule
version: '1.0.0'
api-version: 700
bootstrapper: com.example.mymodule.MyModuleBootstrap
```

该类实现 `com.ultikits.ultitools.bootstrap.ModuleBootstrap`，带有公开的无参构造器，并且必须位于同一个模块 JAR 中：

```java
public final class MyModuleBootstrap implements ModuleBootstrap {
    @Override
    public void bootstrap(ModuleBootstrapContext context) throws Exception {
        context.logger().info("Preparing " + context.moduleName());
    }
}
```

`ModuleBootstrap` 标注为 `@ApiStatus.Experimental`。钩子每次启动调用一次，在服务器启动线程上执行，且只对已接纳的模块调用：未通过安全校验、或因 `api-version` 被拒绝的 JAR 不会被调用。钩子收到的 `ModuleBootstrapContext` 提供三项内容：

| 方法 | 返回值 |
|---|---|
| `moduleName()` | 模块 `plugin.yml` 中的 `name:`；未声明时为 JAR 文件名 |
| `moduleJar()` | 模块 JAR 的绝对、规范化路径 |
| `logger()` | 一个 `java.util.logging.Logger`，输出进入 Paper 的引导日志，前缀为 `[UltiTools/<模块名>]` |

`ModuleBootstrapContext` 由框架实现，模块不得实现它。

钩子可以使用模块自身的类、框架的类和服务器 API，并通过 `context.logger()` 输出日志。此时还没有 Bukkit 服务器、没有任何插件实例（模块自己的和其他插件的都没有）、没有 IoC 服务，也没有世界。不要引用其他插件的类，也不要初始化需要 Bukkit 的共享库，因为静态初始化失败会影响之后用到该类的每个模块。

没有 `bootstrapper:` 键的模块启动方式与以前完全相同，钩子是可选的。

## 早期钩子失败

钩子抛出任何异常或错误即视为失败；类无法加载、不在模块自己的 JAR 中、没有实现 `ModuleBootstrap`、或没有公开的无参构造器，同样视为失败。受影响的只有该模块：它在本次启动不加载，框架和其他模块照常启动。`OutOfMemoryError` 这类虚拟机错误不会被捕获。

服主会看到两行。引导阶段有一行英文错误，附带堆栈：

```text
[UltiTools] Module 'MyModule-1.0.0.jar' failed in its bootstrap phase (com.example.mymodule.MyModuleBootstrap): java.lang.IllegalStateException: example -- the module is not loaded at this start. Update rollback is checked during enable; check the enable log before changing any module JARs.
```

之后在启用阶段，按 UltiTools 配置的语言输出一行，中文为：

```text
[UltiTools-API] 模块 'MyModule-1.0.0.jar' 在本次启动的引导阶段失败，未加载；原因见前面的引导错误。
```

英文为 `[UltiTools-API] Module 'MyModule-1.0.0.jar' is not loaded because its bootstrap phase failed at this start; see the earlier bootstrap error.`。引导阶段的日志只有英文，因为此时语言文件尚未加载。在 `depends` 中列出该失败模块的模块，随后按[模块加载顺序](/zh/guide/advanced/module-dependencies)中的常规规则被拒载。

失败只影响本次启动，下次启动会再次调用该钩子。

## 其他插件的类

在启用阶段，模块可以使用它在 `plugin.yml` 的 `depend:` 或 `softdepend:` 中声明的服务器插件的类。`softdepend:` 中列出但未安装的插件会被跳过，不会阻止模块加载。Vault 与 PlaceholderAPI 总会被查找，因为框架自身声明了它们。

只有声明过的插件才保证可见。所有模块共用一个模块类加载器，因此其他模块声明的插件、或某个依赖暴露出来的库（例如经由 Vault），也可能碰巧可见，但不要依赖这一点。模块加载的类如果不由任何已声明的插件提供，报错如下：

```text
com.example.other.SomeClass is not available to modules. If this class belongs to another server plugin, declare the providing plugin in the module's plugin.yml depend or softdepend; visibility of undeclared plugins is not guaranteed.
```

引导阶段还没有加载任何服务器插件，因此早期钩子不能使用其他插件的类，无论是否声明。

## 重复副本与顺序

框架按文件名顺序（按普通字符串比较）读取模块 JAR。多个 JAR 声明同一个 `main:` 类时，只有该顺序中的第一个会被考虑调用早期钩子，因此每次启动钩子只运行一次。如果第一个副本没有声明 `bootstrapper:`，即使后面的副本声明了，该模块也不会运行钩子。关于重复副本的启动警告，见[同一模块的两个副本](/zh/guide/advanced/module-versioning#同一模块的两个副本)。

不同模块的钩子同样按文件名顺序运行，但这个顺序不属于约定。不要编写依赖其他模块钩子已经运行的钩子。

## 运行库

自 v7.0.0 起，框架 JAR 不再在 `plugin.yml` 的 `libraries:` 中列出运行库，而是在引导阶段之前由 Paper 通过框架的加载器下载：

- `commons-dbutils:commons-dbutils:1.8.1`
- `org.java-websocket:Java-WebSocket:1.6.0`
- `net.bytebuddy:byte-buddy:1.18.17`
- `com.sun.mail:javax.mail:1.6.2`
- `com.zaxxer:HikariCP:7.1.0`

因此首次启动需要能访问 Maven Central，之后的启动复用 Paper 的库缓存。下载失败发生在 UltiTools 能输出任何日志之前，Paper 可能只报告 `Error resolving libraries`。请检查服务器到 Maven 仓库的网络连接。要改用其他镜像，在启动服务器前把 Paper 的环境变量 `PAPER_DEFAULT_CENTRAL_REPOSITORY` 设为该镜像的地址。

## 已知限制

- 不支持在不完全重启的情况下禁用后再启用 UltiTools，也不支持服务器的 `/reload` 和插件管理器的热重载。框架禁用时会关闭模块类加载器，重新启用不会重建它。`/ul reload` 仍然只重载配置。
- 钩子失败的模块不会启用，但它的 JAR 仍留在共享的模块类路径上。使用它的类的其他模块仍可能受影响，静态初始化失败时尤其如此。
- 待处理的模块更新在引导阶段（世界加载之前）应用，但要等启用阶段模块加载完成后才确认。如果服务器在这之间停止或崩溃，下次启动会恢复之前的 JAR。请等启动完成后再停止服务器。
