# UltiTools Maven 插件

::: info Maven 插件与 UltiTools-API 7.0
已发布的 Maven 插件 `2.0.0` 是独立构件；它的复制和发布流程尚未在 7.0 模块上验证。
:::

新建 7.0 模块请参阅[快速开始](../quick-start.md)。使用 `@ultikits/cli` 3.0.0 的 `ultikits create` 生成 7.0 项目，或按快速开始手工创建。Maven 插件不生成项目，构建和手动安装模块也不需要它。

## 插件配置

将 [Maven Central 上已发布的构件](https://repo.maven.apache.org/maven2/com/ultikits/ultitools-maven-plugin/2.0.0/)添加到 `pom.xml` 的 `<build><plugins>` 下。只需填写所用目标的配置：

```xml
<plugin>
    <groupId>com.ultikits</groupId>
    <artifactId>ultitools-maven-plugin</artifactId>
    <version>2.0.0</version>
    <configuration>
        <pluginFolder>/path/to/server/plugins/UltiTools/plugins</pluginFolder>
        <identifyString>example-module</identifyString>
    </configuration>
</plugin>
```

| 目标 | 参数与默认值 |
|---|---|
| `install`、`deploy` | 从 `outputDirectory`（默认 `${project.build.directory}`）读取 `fileName`（默认 `${project.build.finalName}.jar`）。 |
| `install` | `pluginFolder` 是复制目标目录，无默认值。未设置时，此目标不执行复制。 |
| `deploy` | `version` 默认是 `${project.version}`。`name`、`shortDescription` 和 `changelog` 可选，无配置默认值。`allowSnapshot` 默认是 `false`。 |
| `deploy`、`withdraw`、`delete-module` | `identifyString` 必填，填写模块的 UltiCloud 标识。`accessKeyFile` 无默认值，相对路径以 `baseDir`（默认 `${basedir}`）为准。`apiUrl` 默认是 `https://api.ultikits.com`，可用 `-Dultitools.apiUrl` 设置。 |

## Maven 目标

### 本地 JAR 复制

构建 UltiTools-API 7.0 模块时，按快速开始使用 `mvn clean package` 构建，停服后手动把 JAR 复制到 `plugins/UltiTools/plugins/`。替换自己的构建时移除旧 JAR，再启动服务器。`/ul reload` 不会加载新 JAR。

在 Maven 插件 2.0.0 中，`mvn clean package ultitools:install` 先打包，再把构建生成的 JAR 复制到 `pluginFolder`，覆盖同名文件。`ultitools:install` 是插件目标，不是 Maven 的 `install` 生命周期阶段。仅声明插件而未配置执行项，不会自动运行这个目标。

### UltiCloud 发布

`mvn clean package ultitools:deploy` 打包项目并将生成的 JAR 上传到 UltiCloud。目标优先读取非空白的 `ULTIKITS_TOKEN` 环境变量，否则读取 `accessKeyFile` 的第一行作为开发者密钥。不要把密钥放进 POM 或提交到版本库。

上传密钥能为已有模块发布版本。若要让目标自动创建不存在的模块，请配置 `name` 并使用管理密钥。对已有模块，目标会尝试同步配置中的 `name` 和 `shortDescription`；若密钥没有管理权限，会跳过资料更新并继续上传。

目标默认拒绝发布 `-SNAPSHOT` 模块版本，可用 `-Dultitools.allowSnapshot=true` 放行。判断的是待发布的模块版本，不是所依赖的 UltiTools-API 版本。用 `-Dultitools.changelog="…"` 传更新说明（最多 5000 个字符）。JAR 上限为 50 MiB。上传成功不代表 JAR 能在 UltiTools 7.0 加载。

### 版本撤回与模块删除

`ultitools:withdraw` 撤回一个已发布版本；`ultitools:delete-module` 删除模块。两者都没有默认生命周期阶段，都需要管理密钥和完全匹配的确认字符串。不要在共享 Maven 配置中填写目标版本和确认字符串；核对目标后在命令行显式传入。

```shell
# 撤回一个已发布版本。
mvn ultitools:withdraw -Dultitools.withdrawVersion=1.2.3 -Dultitools.confirm=example-module@1.2.3

# 删除模块。
mvn ultitools:delete-module -Dultitools.confirm=example-module
```
