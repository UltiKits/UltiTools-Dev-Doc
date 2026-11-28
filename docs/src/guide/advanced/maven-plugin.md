# UltiTools Maven Plugin

::: info Maven plugin and UltiTools-API 7.0
The published Maven plugin `2.0.0` is a separate artifact; its copy and publishing workflows have not been verified with a 7.0 module.
:::

For a new 7.0 module, follow [Quick Start](../quick-start.md). Use `ultikits create` from `@ultikits/cli` 3.0.0 to scaffold a 7.0 project, or follow Quick Start to create it by hand. The Maven plugin does not scaffold projects and is not required to build or manually install a module.

## Plugin configuration

Add the published [Maven Central artifact](https://repo.maven.apache.org/maven2/com/ultikits/ultitools-maven-plugin/2.0.0/) under `<build><plugins>` in `pom.xml`. Include only the configuration for the goals you use:

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

| Goal | Parameters and defaults |
|---|---|
| `install`, `deploy` | Read `fileName` (default `${project.build.finalName}.jar`) under `outputDirectory` (default `${project.build.directory}`). |
| `install` | `pluginFolder` is the copy destination. No default; the goal does nothing if it is unset. |
| `deploy` | `version` defaults to `${project.version}`. `name`, `shortDescription`, and `changelog` are optional and have no configured defaults. `allowSnapshot` defaults to `false`. |
| `deploy`, `withdraw`, `delete-module` | `identifyString` is required; use the module's UltiCloud identifier. `accessKeyFile` has no default; relative paths are resolved against `baseDir` (default `${basedir}`). `apiUrl` defaults to `https://api.ultikits.com` and can be set with `-Dultitools.apiUrl`. |

## Maven goals

### Local JAR copy

For an UltiTools-API 7.0 module, Quick Start uses `mvn clean package` and a manual copy into `plugins/UltiTools/plugins/` while the server is stopped. Remove the old JAR when replacing your own build, then start the server. `/ul reload` does not load a new JAR.

In Maven plugin 2.0.0, `mvn clean package ultitools:install` packages the project and then copies the resulting JAR to `pluginFolder`, overwriting the destination if it has the same filename. `ultitools:install` is a plugin goal, not Maven's `install` lifecycle phase. Declaring the plugin without an execution does not run the goal automatically.

### UltiCloud publishing

`mvn clean package ultitools:deploy` packages the project and uploads the built JAR to UltiCloud. The goal reads a developer key from a nonblank `ULTIKITS_TOKEN` environment variable first, or from the first line of `accessKeyFile` otherwise. Keep keys out of the POM and version control.

An upload key can publish a version of an existing module. To let the goal create a missing module, supply `name` and use a manage key. The goal also attempts to sync configured `name` and `shortDescription` for existing modules; it skips the metadata update and continues the upload if the key lacks manage scope.

The goal rejects `-SNAPSHOT` module versions by default; use `-Dultitools.allowSnapshot=true` to opt in. This checks the module version being published, not the UltiTools-API dependency version. Set release notes with `-Dultitools.changelog="…"` (at most 5000 characters). The JAR limit is 50 MiB. A successful upload does not establish that the JAR loads on UltiTools 7.0.

### Version withdrawal and module deletion

`ultitools:withdraw` withdraws one published version. `ultitools:delete-module` deletes the module. Neither has a default phase. Both require a manage key and an exact confirmation. Keep the target version and confirmation out of shared Maven configuration; pass them explicitly on the command line after checking the target.

```shell
# Withdraw one published version.
mvn ultitools:withdraw -Dultitools.withdrawVersion=1.2.3 -Dultitools.confirm=example-module@1.2.3

# Delete the module.
mvn ultitools:delete-module -Dultitools.confirm=example-module
```
