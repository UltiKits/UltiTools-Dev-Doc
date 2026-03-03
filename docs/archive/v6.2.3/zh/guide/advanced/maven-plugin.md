# UltiTools Maven 插件

UltiTools-API 为你的开发提供了一个 Maven 插件，可以自动将你的插件打包并复制到服务器文件夹中，也可以自动将你的插件上传至 UltiCloud。

## 如何安装

在你的 `pom.xml` 文件中的 `<build.plugins>` 标签下添加以下内容：

```xml
    <plugin>
        <groupId>com.ultikits</groupId>
        <artifactId>ultitools-maven-plugin</artifactId>
        <version>1.0.0</version>
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

`<name>` 标签用于指定插件名称，

`<identifyString>` 标签用于指定插件标识符，若无特殊需求，建议与插件名称相同，

`<shortDescription>` 标签用于指定插件简介，将会在插件 `upm list` 中展示

`<accessKeyFile>` 标签用于指定 UltiCloud 访问密钥文件的路径，

`<pluginFolder>` 标签用于指定服务器插件文件夹的路径。

## 如何使用

### 打包插件

在你的项目根目录下执行以下命令：

```shell
mvn clean package ultitools:install
```

这条命令会将你的插件打包并复制到服务器文件夹中。

::: warning

如果你的服务器正在运行，请先关闭服务器，否则复制会失败！

:::

### 上传插件至 UltiCloud

如果你想你的插件被收录在upm list中，让用户可以使用 `upm install` 命令安装你的插件，你需要将你的插件上传至 UltiCloud。

首先，你需要在 [UltiCloud](https://panel.ultikits.com/) 中创建一个账号，然后点击开发者中心，鼠标悬浮于访问密钥上获取访问密钥。

![maven-plugin-1.png](/maven-plugin-1.png)

将访问密钥保存至一个文件中，然后在 `pom.xml` 中的 `<accessKeyFile>` 标签中指定该文件的路径。

填写`pom.xml` 中的 `<identifyString>` 标签，这个标签用于标识你的插件。你需要确保你的 `<identifyString>` 标签是唯一的。

::: tip 不要弄得太复杂

请不要让你的标识符太复杂，因为这个标签将会作为插件的ID，用户在使用 `upm install` 命令时需要输入这个ID。一般来说，作者名-插件名 就足够了。

:::

在你的项目根目录下执行以下命令：

```shell
mvn clean package ultitools:deploy
```

这条命令会将你的插件打包并上传至 UltiCloud。
