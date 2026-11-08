# UltiTools Maven 插件

UltiTools-API 为你的开发提供了一个 Maven 插件，可以自动将你的插件打包并复制到服务器文件夹中，也可以自动将你的插件上传至 UltiCloud。

本页对应 `ultitools-maven-plugin` 2.0.0。1.x 连接的是已下线的旧面板后端，已无法发布。

## 如何安装

在你的 `pom.xml` 文件中的 `<build.plugins>` 标签下添加以下内容：

```xml
    <plugin>
        <groupId>com.ultikits</groupId>
        <artifactId>ultitools-maven-plugin</artifactId>
        <version>2.0.0</version>
        <configuration>
            <name>plugin_name</name>
            <identifyString>id-string</identifyString>
            <shortDescription>brief description</shortDescription>
            <accessKeyFile>path/to/access_key.txt</accessKeyFile>
            <pluginFolder>path/to/server/plugins/UltiTools/plugins</pluginFolder>
        </configuration>
    </plugin>
```

其中，

`<identifyString>` 标签必填，用于指定插件标识符，若无特殊需求，建议与插件名称相同，

`<name>` 标签可选，用于指定插件名称；模块不存在时用于创建模块，已存在时会同步到模块上，

`<shortDescription>` 标签可选，用于指定插件简介，将会在插件 `upm list` 中展示；与 `<name>` 一样会被同步，

`<accessKeyFile>` 标签用于指定保存开发者密钥的文件路径（相对项目目录）；设置了环境变量 `ULTIKITS_TOKEN` 时可省略，

`<pluginFolder>` 标签用于指定服务器插件文件夹的路径；只有 `ultitools:install` 使用它，未设置时该目标什么也不做。

## 如何使用

### 打包插件

在你的项目根目录下执行以下命令：

```shell
mvn clean package ultitools:install
```

这条命令会将你的插件打包并复制到服务器文件夹中。

::: warning 复制前需要先关闭服务器
Windows 上服务器占用 JAR 时复制会失败。Linux 和 macOS 上复制会成功，但运行中的服务器仍使用旧类，在重启前可能出错。
:::

### 上传插件至 UltiCloud

如果你想你的插件被收录在upm list中，让用户可以使用 `upm install` 命令安装你的插件，你需要将你的插件上传至 UltiCloud。

首先，你需要在 [UltiCloud](https://panel.ultikits.com/) 中创建一个账号，然后在开发者中心创建开发者密钥（`ucd_…`）。

插件先读环境变量 `ULTIKITS_TOKEN`，没有时读 `<accessKeyFile>` 所指文件的第一行。旧版访问令牌会被拒绝。不要提交密钥文件，请把它加入 `.gitignore`。

上传密钥只能为已有模块发布版本；创建模块或修改名称、简介需要管理密钥。

填写`pom.xml` 中的 `<identifyString>` 标签，这个标签用于标识你的插件。你需要确保你的 `<identifyString>` 标签是唯一的。

::: tip 不要弄得太复杂

请不要让你的标识符太复杂，因为这个标签将会作为插件的ID，用户在使用 `upm install` 命令时需要输入这个ID。一般来说，作者名-插件名 就足够了。

:::

在你的项目根目录下执行以下命令：

```shell
mvn clean package ultitools:deploy
```

这条命令会将你的插件打包并上传至 UltiCloud。

快照版本默认拒绝发布，需要时加 `-Dultitools.allowSnapshot=true`。用 `-Dultitools.changelog="…"` 传更新说明（最多 5000 字）。JAR 最大 50 MiB。已发布的版本不能删除，只能撤回。

### 撤回版本与删除模块

`ultitools:withdraw` 撤回已发布版本，`ultitools:delete-module` 删除模块。两者都不绑定构建阶段：只在命令行显式调用时执行，需要管理密钥，并且需要完全一致的确认字符串。

```shell
# 撤回一个已发布版本，不可恢复。
mvn ultitools:withdraw -Dultitools.withdrawVersion=1.2.3 -Dultitools.confirm=id-string@1.2.3

# 删除模块，30 天内可用 `ultikits modules restore id-string` 恢复。
mvn ultitools:delete-module -Dultitools.confirm=id-string
```
