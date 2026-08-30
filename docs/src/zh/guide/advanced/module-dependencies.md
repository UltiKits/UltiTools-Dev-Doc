# 模块加载顺序

::: info 排序自 v6.3.0 起生效
`@PluginDependency` 自 v6.2.0 起就存在，但一直是没有读取方的声明性元数据。v6.3.0 起，它与 `plugin.yml` 的 `loadAfter` 都会真正参与加载顺序。
:::

## 声明依赖

在继承 `UltiToolsPlugin` 的类上添加 `@PluginDependency`：

```java
@UltiToolsModule(scanBasePackages = {"com.example.myplugin"})
@PluginDependency(
    depends = {"CorePlugin", "UtilsPlugin"},
    softDepends = {"OptionalPlugin"}
)
public class MyPlugin extends UltiToolsPlugin {
    // ...
}
```

| 属性 | 含义 |
|---|---|
| `depends` | 必需依赖。加载时缺失会拒绝本模块。 |
| `softDepends` | 可选依赖。若存在，本模块会在它们之后加载；缺失不影响本模块加载。 |
| `loadBefore` | 反向声明：指明哪些模块应在本模块之后加载。 |

## `plugin.yml` 的 `loadAfter`

`plugin.yml` 自身的 `loadAfter:` 列表会被读入与 `@PluginDependency` 相同的依赖图，按模块名解析：

```yaml
# plugin.yml
loadAfter:
  - CorePlugin
```

`@PluginDependency` 本身没有新增 `loadAfter` 属性。两种机制被有意分开：`plugin.yml` 已经有 `loadAfter`，`@PluginDependency` 已经有 `depends`/`softDepends`/`loadBefore`，声明顺序约束时用两者中已经能表达它的那一个即可。

## 循环依赖与缺失依赖

依赖环，或 `depends` 中声明了一个未安装的模块，只会拒绝受影响的模块：环成员（或声明了缺失依赖的模块）以及所有传递依赖它们的模块。其余模块照常加载。

控制台会把整个环按路径打印出来，形如 `A -> B -> C -> A`，并指出应联系哪个模块的作者。这与 Paper 自身报告插件加载环的方式一致。

## 退回旧版顺序

`-Dultitools.useLegacyPluginLoading=true` 会恢复 6.3.0 之前的行为：所有模块按文件系统顺序加载，完全不做依赖解析，也不检测循环依赖。这是一个 JVM 系统属性，只在服务器启动时读取一次，不是可热重载的配置项，与 Paper 自身的 `-Dpaper.useLegacyPluginLoading=true` 是同一种设计。

::: warning 旧版开关的代价
依赖解析被完全跳过后，依赖加载顺序的模块可能初始化失败，且是不可预测的，也不会有错误指出原因。这个开关只应作为修复潜在循环依赖或缺失依赖之前的临时手段。
:::
