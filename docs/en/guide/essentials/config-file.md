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
    @ConfigEntry(path = "someMapPath", comment = "somecomment2", parser = StringHashMapParser.class)
    private Map<String, String> someMap = new HashMap<>();

    public SomeConfig(String configFilePath) {
        super(configFilePath);
    }
}
```

#### @ConfigEntity

The `@ConfigEntity` annotation is used to mark the location of a configuration file, which requires a string parameter
to specify the path of the configuration file in the plugin configuration folder. Usually this path is the same as the
path in the resource folder directory during your development.

The parameter here can also point to a folder. If you specify a folder, all configuration files in the folder will be
loaded as the current configuration class.

```java
@Getter
@Setter
@ConfigEntity("test")  // This is a folder
public class TestConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "testString")
    private String testString = "test";
    ...
}
```

::: warning Note

If you specify a folder, you need to make sure that all configuration files in the folder can be read by the same
configuration class. Sub-folders are not included.

:::

You can use the `UltiToolsPlugin#getConfigs` method to get all loaded configurations.

```java
List<TestConfig> configs = BasicFunctions.getInstance().getConfigs(TestConfig.class);
```

Or you can directly specify the path of the configuration file in a folder to get the configuration.

```java
TestConfig config = BasicFunctions.getInstance().getConfig("test/test1.yml", TestConfig.class);
```


#### @ConfigEntry

`@ConfigEntry` is used to mark a configuration item. 

The `path` attribute is used to specify the path of the key of this
configuration item in the configuration file. 

The `comment` attribute is used to specify the comment of this configuration item.

The `parser` attribute is used to specify the parser of this configuration item. The parser is used to convert the
object in the configuration file to the type of the configuration item. The default parser is `DefaultConfigParser`
, it can handle most of the case but not all. If you need to parse a more complex object, you can create a class that 
inherit the `ConfigParser` class and specify it in the `parser` attribute.

::: tip Custom Parser Example
```java
public class StringHashMapParser extends ConfigParser<HashMap<String, String>> {
    @Override
    public HashMap<String, String> parse(Object object) {
        if (!(object instanceof ConfigurationSection)) {
            return null;
        }
        ConfigurationSection section = (ConfigurationSection) object;
        HashMap<String, String> map = new HashMap<>();
        for (String key : section.getKeys(false)) {
            map.put(key, section.getString(key));
        }
        return map;
    }

    @Override
    public MemorySection serializeToMemorySection(HashMap<String, String> object) {
        MemorySection memorySection = new MemoryConfiguration();
        for (String key : object.keySet()) {
            memorySection.set(key, object.get(key));
        }
        return memorySection;
    }
}
```
:::

#### @Getter and @Setter

`@Getter` and `@Setter` are Lombok annotations, which are used to automatically generate `getter` and `setter` methods.

### Get configuration file object

Your main class which extends `UltiToolsPlugin` has a `getConfig` method to get the configuration file object.

You need to get the instance of the plugin main class, and then call the `getConfig` method.

```java
SomeConfig someConfig = SomePlugin.getInstance().getConfig(SomeConfig.class);
```

Now you can use the `getter` and `setter` methods to operate the configuration file.

::: tip Set and Save

After you set a value of a configuration you don't need to save it, UltiTools will automatically save it when disabling.
However, if you want to save it immediately, you can call the `save` method.

:::

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


