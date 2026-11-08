# UltiTools Maven Plugin

UltiTools-API offers a Maven plugin for your development, which can automatically package your plugin and copy it to the server folder, and can also automatically upload your plugin to UltiCloud.

This page describes `ultitools-maven-plugin` 2.0.0. Version 1.x talks to the retired panel backend and can no longer publish.

## How to install

Add the following content to the `<build.plugins>` tag in your `pom.xml` file:

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

`<identifyString>` tag is required and specifies the plugin identifier. If there is no special requirement, it is recommended to be the same as the plugin name,

`<name>` tag is optional and specifies the plugin name; it is used to create a missing module and is kept in sync with an existing one,

`<shortDescription>` tag is optional and specifies the brief description of the plugin, which will be displayed in `upm list`; it is kept in sync like `<name>`,

`<accessKeyFile>` tag specifies the path of the file that holds your developer key, relative to the project directory; it is optional when the `ULTIKITS_TOKEN` environment variable is set,

`<pluginFolder>` tag specifies the path of the server plugin folder; it is used only by `ultitools:install`, which does nothing when it is unset.

## How to use

### Package your plugin

In your project root directory, execute the following command:

```shell
mvn clean package ultitools:install
```

This command will package your plugin and copy it to the server folder.

::: warning Stop the server before copying
On Windows the copy fails while the server holds the JAR open. On Linux and macOS it succeeds, but the running server keeps the old classes and can break until it is restarted.
:::

### Upload your module to UltiCloud

If you want your module to be included in `upm list` and allow users to install your module using the `upm install` command, you need to upload your module to UltiCloud.

Firstly, you need to create an account in [UltiCloud](https://panel.ultikits.com/), then create a developer key (`ucd_…`) in the Developer Center.

The plugin reads the key from the `ULTIKITS_TOKEN` environment variable, or else from the first line of the file named in `<accessKeyFile>`. An old access token is refused. Never commit the key file: add it to `.gitignore`.

An upload key can publish versions of modules that already exist. Creating a module, or changing its name and short description, needs a manage key.

Fill in the `<identifyString>` tag in `pom.xml`, which is used to identify your plugin. You need to make sure that your `<identifyString>` tag is unique.

::: tip Don't make it complicated

Don't make your identifier too complicated, because this tag will be used as the ID of the plugin, and users need to enter this ID when using the `upm install` command. Generally speaking, author name-plugin name is enough.

:::

Execute the following command in your project root directory:

```shell
mvn clean package ultitools:deploy
```

This command will package your plugin and upload it to UltiCloud.

Snapshot versions are refused unless you pass `-Dultitools.allowSnapshot=true`. Pass release notes with `-Dultitools.changelog="…"` (at most 5000 characters). The JAR may be at most 50 MiB. A published version cannot be deleted, only withdrawn.

### Withdraw a version or delete a module

`ultitools:withdraw` withdraws a published version and `ultitools:delete-module` deletes a module. Neither is bound to a build phase: both run only when named on the command line, need a manage key, and need an exact confirmation string.

```shell
# Withdraw one published version. Cannot be undone.
mvn ultitools:withdraw -Dultitools.withdrawVersion=1.2.3 -Dultitools.confirm=id-string@1.2.3

# Delete the module. Recoverable for 30 days with `ultikits modules restore id-string`.
mvn ultitools:delete-module -Dultitools.confirm=id-string
```
