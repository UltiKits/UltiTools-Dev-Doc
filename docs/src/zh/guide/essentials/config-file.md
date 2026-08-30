# 配置文件

UltiTools提供了优雅的单例模式的封装API，让你可以像操作对象一样操作配置文件。

## 创建 YAML 配置文件

首先，你需要在 `resources` 文件夹中创建一个 `config` 文件夹。按照你的需求放入你的插件配置文件。这些配置文件会被原封不动的放入UltiTools插件的集体配置文件夹中展示给用户。

## 操作配置文件

### 创建配置文件对象

根据你的配置文件的键值对结构，创建一个类，继承 `AbstractConfigEntity` 类。

<<< @/../examples/src/main/java/com/ultikits/docs/config/SomeConfig.java

#### @ConfigEntity

`@ConfigEntity` 注解用于标记一个配置文件的位置，需要一个字符串参数，用于指定配置文件在插件配置文件夹中的路径。通常这个路径与你在开发过程中resource文件夹目录中的路径是相同的。

但是这里的字符串也可以指向一个文件夹。如果你指定的是一个文件夹，则该文件夹下只有 `.yml` 文件会被加载为当前配置类，其余类型会被静默跳过。

```java
@Getter
@Setter
@ConfigEntity("test")  // 这里是一个文件夹
public class TestConfig extends AbstractConfigEntity {
    @ConfigEntry(path = "testString")
    private String testString = "test";
    ...
}
```

::: warning 注意

如果你指定的是一个文件夹，那么你需要确保文件夹下的所有配置文件都是可被同一配置类读取的。这里的检测不会检测子文件夹。

:::

你可以通过 `UltiToolsPlugin#getConfigs` 方法来获取所有被加载的配置类。

```java
List<TestConfig> configs = BasicFunctions.getInstance().getConfigs(TestConfig.class);
```

或者你可以直接指定一个文件夹内的配置文件的路径来获取配置类。

```java
TestConfig config = BasicFunctions.getInstance().getConfig("test/test1.yml", TestConfig.class);
```

#### @ConfigEntry

`@ConfigEntry` 注解用于标记一个配置项，

`path` 属性用于指定该配置项在配置文件中键的路径；

`comment` 属性用于指定该配置项的注释；

`parser` 属性用于指定该配置项的解析器。解析器用于将配置文件中的对象转换为配置项的类型。默认的解析器是 `DefaultConfigParser` ，
它可以处理大多数情况，但并不是所有情况。如果你需要解析一个更复杂的对象，你可以创建一个继承 `ConfigParser` 类的类，并在 `parser` 属性中指定它。

::: tip 内置解析器示例
`StringHashMapParser` 是框架内置、可直接复用的实现，完整类名为 `com.ultikits.ultitools.interfaces.impl.pasers.StringHashMapParser`，通过 `@ConfigEntry(parser = StringHashMapParser.class)` 直接引用即可，不需要另外自己实现一个解析器。下方代码仅用于展示其实现逻辑，请导入上面给出的框架类，不要导入这个示例文件。
<<< @/../examples/src/main/java/com/ultikits/docs/config/StringHashMapParser.java
:::

#### @Getter 和 @Setter

`@Getter` 和 `@Setter` 则为Lombok注解，用于自动生成 `getter` 和 `setter` 方法。

### 获取配置文件对象

继承了 `UltiToolsPlugin` 的主类中，有一个 `getConfig` 方法，用于获取配置文件对象。 

你需要获取插件主类的实例，然后调用 `getConfig` 方法。

```java
SomeConfig someConfig = SomePlugin.getInstance().getConfig(SomeConfig.class);
```

然后，你就可以使用 `getter` 和 `setter` 方法来操作配置文件了。

```java
boolean something = someConfig.getSomething();
```

::: tip 设置与保存

在设置完配置对象内容后，你可以不用保存它，UltiTools会在插件关闭时自动为你保存。
当然你也可以手动调用 `save` 方法来立即保存。

:::

::: tip
尽管 UltiTools 允许你从代码里更改并保存配置文件，但这并不是推荐的做法：它会给用户带来意料之外的改动，还可能覆盖用户尚未保存的修改。
配置是给用户读取和编辑的，是否应用某项改动应该由用户自己决定，程序只应响应用户的显式操作去改。
如果你的插件需要自行持久化数据，请改用[数据存储](/zh/guide/essentials/data-storage)。
:::

## 注册配置文件

### 自动注册

因为UltiTools提供了自动注册功能，所以你无需手动注册配置文件，只需要在你的配置文件类上添加 `@ConfigEntity` 注解即可。

请查看[这篇文章](/zh/guide/advanced/auto-register)来了解更多关于自动注册的内容。

### 手动注册

你可以重写你的插件主类中的 `getAllConfigs` 方法来注册配置文件。
这条路径仅在插件主类未启用自动配置注册（`@EnableAutoRegister` 或 `@UltiToolsModule`，其 `config` 属性默认为 `true`）时才会生效：一旦启用，`getAllConfigs` 就不会被调用，即使你重写了它。`@ConfigEntity` 在两条路径下都是必需的，但它本身并不决定哪条路径生效。

```java
@Override
public List<AbstractConfigEntity> getAllConfigs() {
    return Collections.singletonList(new SomeConfig("some/path/to/config"));
}
```

## 配置校验 <Badge type="tip" text="v6.2.0+" />

从 v6.2.0 开始，UltiTools 提供了校验注解来防止无效的配置值。详情请参阅[配置校验](/zh/guide/advanced/config-validation)指南。

<<< @/../examples/src/main/java/com/ultikits/docs/config/MyConfig.java

可用的校验注解：`@Range`、`@NotEmpty`、`@Size`、`@Pattern`（来自 `com.ultikits.ultitools.annotations.config` 包）。

## 保存配置文件

你无需担心配置文件的加载与保存等问题，UltiTools会自动为你做好一切。

::: info 注释（v6.3.0 起）
Bukkit 在保存时会保留已有注释，UltiTools 显式设置了 `options().parseComments(true)`，不依赖默认值。首次新增的键也会连同其 `@ConfigEntry(comment)` 一并写入；服主已有的键则不会被改动。
:::

一个纯粹外观上的副作用：SnakeYAML 保存时会把双引号字符串值重新写成单引号，值本身不变，只是引号风格变化。

## 重载配置文件

`UltiToolsPlugin` 提供了 `getConfigManager#reloadConfigs` 方法，你可以在需要的时候调用它来重新加载配置文件。

```java
SomePlugin.getConfigManager().reloadConfigs(SomePlugin.getInstance());
```
