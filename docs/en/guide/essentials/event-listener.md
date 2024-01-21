::: warning 🚧 This page is under construction

The translation of this page is not finished yet.

:::

# 事件监听器

UltiTools 模块的事件监听与 Bukkit 的事件监听基本相同。

参见 [Bukkit 事件监听器](https://bukkit.gamepedia.com/Event_API_Reference)。

## 监听器注册

在继承了 `UltiToolsPlugin` 的类中的 `registerSelf` 中注册监听器。

```java
import com.ultikits.plugin.ultikitsapiexample.context.ContextConfig;
import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.ContextEntry;
import com.ultikits.ultitools.annotations.EnableAutoRegister;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

    // 如果需要连接到UltiTools-API，则需要重写这个有参数的构造函数，另一个无参数的是给模块开发使用的。
    // 在这里请不要主动使用无参数的构造函数
    public UltiToolsConnector(String name, String version, List<String> authors, List<String> depend, int loadPriority, String mainClass) {
        super(name, version, authors, depend, loadPriority, mainClass);
    }

    @Override
    public boolean registerSelf() throws IOException {
        getListenerManager().register(this, SomeListener.class);
        return true;
    }

    @Override
    public void unregisterSelf() {

    }

    @Override
    public void reloadSelf() {
        super.reloadSelf();
    }
}
```

当然，你也可以使用 UltiTools 提供的自动注册功能，详情可以查看[这篇文章](/guide/advanced/auto-register)。
