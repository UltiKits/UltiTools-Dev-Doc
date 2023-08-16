---
footer: false
---

# 快速开始

在这篇文章中，将会教你如何创建一个 UltiTools 模块。

## 使用 IDEA 插件快速创建

UltiKits 开发了官方的 IDEA 插件，你可以使用他来快速创建项目。

## 添加依赖项

在你的 Java 项目中，将 UltiTools API 添加到你的依赖项中。

::: code-group

```xml [using Maven]
<dependency>
    <groupId>com.ultikits</groupId>
    <artifactId>UltiTools-API</artifactId>
    <version>{VERSION}</version>
</dependency>
```

```groovy [using Gradle]
dependencies {
    implementation 'com.ultikits:UltiTools-API:{VERSION}'
}
```

:::

添加完成后刷新你的项目。

## 创建插件元数据文件

在你开始编写代码之前，你需要在 `resources` 文件夹中创建一个 `plugin.yml` 文件。

UltiTools 在加载该模块之前会先读取该文件，以便确认该模块的主类等信息。

```yaml
# 插件名称
name: TestPlugin
# 插件版本
version: '${project.version}'
# 插件主类
main: com.test.plugin.MyPlugin
# 插件用到的UltiTools-API版本，例如6.0.0就是600
api-version: 600
# 插件作者
authors: [ wisdomme ]
```


## 编写插件主类

新建一个主类继承 `UltiToolsPlugin` ，类似传统的Spigot插件，UltiTools插件也需要重写启动和关闭方法。 但是UltiToolsPlugin增加了一个可选的 `UltiToolsPlugin#reloadSelf()` 方法，用于插件重载时执行。

```java
public class MyPlugin extends UltiToolsPlugin {
    @Override
    public boolean registerSelf() {
        // 插件启动时执行
        return true;
    }

    @Override
    public void unregisterSelf() {
        // 插件关闭时执行
    }
    
    @Override
    public void reloadSelf() {
        // 插件重载时执行
    }
}
```

这样就已经完成了一个什么功能都没有的UltiTools插件。

在后续的文章中，将会教你有关命令、事件、配置文件、数据存储等的使用方法。
