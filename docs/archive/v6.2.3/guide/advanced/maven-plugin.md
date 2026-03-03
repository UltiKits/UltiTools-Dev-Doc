::: warning 🚧 Non-English content included

The translation of the UltiPanel is still in progress, and some content may not in English yet.

:::

# UltiTools Maven Plugin

UltiTools-API offers a Maven plugin for your development, which can automatically package your plugin and copy it to the server folder, and can also automatically upload your plugin to UltiCloud.

## How to install

Add the following content to the `<build.plugins>` tag in your `pom.xml` file:

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

`<name>` tag is used to specify the plugin name,

`<identifyString>` tag is used to specify the plugin identifier. If there is no special requirement, it is recommended to be the same as the plugin name,

`<shortDescription>` tag is used to specify the brief description of the plugin, which will be displayed in `upm list`,

`<accessKeyFile>` tag is used to specify the path of the UltiCloud access key file,

`<pluginFolder>` tag is used to specify the path of the server plugin folder.

## How to use

### Package your plugin

In your project root directory, execute the following command:

```shell
mvn clean package ultitools:install
```

This command will package your plugin and copy it to the server folder.

::: warning

If your server is running, please shut down the server first, otherwise the copy will fail!

:::

### Upload your module to UltiCloud

If you want your module to be included in `upm list` and allow users to install your module using the `upm install` command, you need to upload your module to UltiCloud.

Firstly, you need to create an account in [UltiCloud](https://panel.ultikits.com/), then click Developer Center, and hover over the access key to get the access key.

![maven-plugin-1.png](/maven-plugin-1.png)

Save the access key to a file, and then specify the path of the file in the `<accessKeyFile>` tag in `pom.xml`.

Fill in the `<identifyString>` tag in `pom.xml`, which is used to identify your plugin. You need to make sure that your `<identifyString>` tag is unique.

::: tip Don't make it complicated

Don't make your identifier too complicated, because this tag will be used as the ID of the plugin, and users need to enter this ID when using the `upm install` command. Generally speaking, author name-plugin name is enough.

:::

Execute the following command in your project root directory:

```shell
mvn clean package ultitools:deploy
```

This command will package your plugin and upload it to UltiCloud.
