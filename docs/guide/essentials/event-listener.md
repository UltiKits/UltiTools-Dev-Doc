# 事件监听器

UltiTools 模块的事件监听与 Bukkit 的事件监听基本相同。

参见 [Bukkit 事件监听器](https://bukkit.gamepedia.com/Event_API_Reference)。

## 监听器注册

在你的插件主类注册监听器。

```java
getListenerManager().register(this, new SomeListener());
```

当然，你也可以使用 UltiTools 提供的自动注册功能，详情可以查看[这篇文章](/guide/advanced/auto-register)。