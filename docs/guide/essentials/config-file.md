# 配置文件

UltiTools提供了优雅的单例模式的封装API，让你可以像操作对象一样操作配置文件。

## 创建 YAML 配置文件

首先，你需要在 `resources` 文件夹中创建一个 `config` 文件夹。按照你的需求放入你的插件配置文件。这些配置文件会被原封不动的放入UltiTools插件的集体配置文件夹中展示给用户。

## 操作配置文件

### 创建配置文件对象

根据你的配置文件的键值对结构，创建一个类，继承 `AbstractConfigEntity` 类。

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

其中，`@ConfigEntity` 注解用于标记一个配置文件的位置，需要一个字符串参数，用于指定配置文件在插件配置文件夹中的路径。通常这个路径与你在开发过程中resource文件夹目录中的路径是相同的。

`@ConfigEntry` 注解用于标记一个配置项，`path` 属性用于指定该配置项在配置文件中键的路径，`comment` 属性用于指定该配置项的注释。

`@Getter` 和 `@Setter` 则为Lombok注解，用于自动生成 `getter` 和 `setter` 方法。

### 获取配置文件对象

继承了 `UltiToolsPlugin` 的主类中，有一个 `getConfig` 方法，用于获取配置文件对象。 

你需要获取插件主类的实例，然后调用 `getConfig` 方法。

```java
SomeConfig someConfig = SomePlugin.getInstance().getConfig("/path/to/config.yml", SomeConfig.class);
```

然后，你就可以使用 `getter` 和 `setter` 方法来操作配置文件了。

```java
boolean something = someConfig.getSomething();
```

## 注册配置文件

在你的插件主类中注册配置文件。

```java
getConfigManager().register(this, SomeConfig("path/to/config.yml"));
```

你无需担心配置文件的加载与保存等问题，UltiTools会自动为你做好一切。
