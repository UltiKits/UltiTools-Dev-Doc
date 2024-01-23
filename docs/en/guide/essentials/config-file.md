# Configuration

UltiTools provides an elegant singleton pattern encapsulation API that allows you to operate configuration files like
objects.

## Create a YAML configuration file

Firstly, you need to create a `config` folder in the `resources` folder. Put your plugin configuration files in it
according to your needs. These configuration files will be put into the collective configuration folder of UltiTools
plugin and displayed to users.

## Operate configuration files

### Create a configuration file object

According to the key-value pair structure of your configuration file, create a class that inherits
the `AbstractConfigEntity` class.

```java

@Getter
@Setter
@ConfigEntity("some/path/to/config")
public class SomeConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "somepath", comment = "somecomment")
    private boolean something = false;

    public SomeConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

The `@ConfigEntity` annotation is used to mark the location of a configuration file, which requires a string parameter
to specify the path of the configuration file in the plugin configuration folder. Usually this path is the same as the
path in the resource folder directory during your development.

`@ConfigEntry` is used to mark a configuration item. The `path` attribute is used to specify the path of the key of this
configuration item in the configuration file, and the `comment` attribute is used to specify the comment of this
configuration item.

`@Getter` and `@Setter` are Lombok annotations, which are used to automatically generate `getter` and `setter` methods.

### Get configuration file object

Your main class which extends `UltiToolsPlugin` has a `getConfig` method to get the configuration file object.

You need to get the instance of the plugin main class, and then call the `getConfig` method.

```java
SomeConfig someConfig = SomePlugin.getInstance().getConfig(SomeConfig.class);
```

Now you can use the `getter` and `setter` methods to operate the configuration file.

```java
boolean something = someConfig.getSomething();
```

::: tip

Although UltiTools allows you to make changes to the configuration file and save the changes, this does not mean that it
is a good behavior for the program to change the configuration file.
Programs changing configuration files will cause unexpected changes for users, and may cause users to lose unsaved
configurations.
Configuration is for reading, and users should configure it themselves and decide whether to apply the configuration.
If you need to persistently store data, please refer to [Data Storage](/en/guide/essentials/data-storage).

:::

## Register configuration file

### Automatically register

Since UltiTools provides automatic registration function, you don't need to register configuration files manually, just
add the `@ConfigEntry` annotation to your configuration file class.

Please refer to [this article](/en/guide/advanced/auto-register) for more information about automatic registration.

### Manually register

You can register the config file by override the `getAllConfigs` method in your plugin main class.

```java

@Override
public List<AbstractConfigEntity> getAllConfigs() {
    return Collections.singletonList(new SomeConfig("some/path/to/config"));
}
```

## Saving configuration files

You don't need to worry about the loading and saving of configuration files, UltiTools will do everything for you
automatically.

::: warning

If you save the config file, some comments in the file may disappear.

:::

## Configuration file reload

`UltiToolsPlugin` provides the `getConfigManager#reloadConfigs` method, you can call it to reload configuration files
when needed.

```java
SomePlugin.getInstance().getConfigManager().reloadConfigs();
```


