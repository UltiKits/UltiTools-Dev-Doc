# 消息与语言

自 v7.0.0 起，框架在 `com.ultikits.ultitools.text` 包中提供一套文本引擎。消息是用 MiniMessage 编写的 Adventure 组件，每个玩家看到的是自己 Minecraft 客户端语言的版本，文本来自使用点分键的 YAML 语言文件。服主在覆盖文件里修改文本；玩家的语言没有译文时，以及控制台输出，使用后备语言。

::: warning 未发布的 v7.0.0 行为
本页描述尚未发布的 7.0.0 框架。6.x 框架只有 [I18n 多语言](/zh/guide/essentials/i18n) 中描述的 `i18n(...)` 路径。
:::

## 语言文件

模块在 JAR 根目录的 `messages/` 下为每种语言放一个 UTF-8 文件，在 Maven 项目中即 `src/main/resources/messages/<语言>.yml`：

```text
src/main/resources/messages/en.yml
src/main/resources/messages/zh.yml
```

每个值是一段 MiniMessage 字符串。键是小写、以点分隔的路径，每段由 `a-z`、`0-9`、`_` 和 `-` 组成。嵌套映射与点分键等价，下面两份文件定义的是同一个键 `home.set.success`：

```yaml
home:
  set:
    success: "<green>已设置家 <home>。</green>"
```

```yaml
home.set.success: "<green>已设置家 <home>。</green>"
```

加载时的规则：

- 只读取 `.yml` 文件。`.yaml` 文件会被跳过并告警。文件名由字母、数字、`_` 或 `-` 加上 `.yml` 组成；`messages/` 的子目录不是语言目录。
- 文件必须是 UTF-8，允许带 UTF-8 BOM。
- 标量键和值一律按文字读取。不加引号的 `yes`、`no`、`Yes`、`true`、`123`、`null` 和 `~` 保持为文本，不会转换成 YAML 的布尔值、数字或空值。
- 列表和非标量键会被拒绝并告警。嵌套映射只用于给点分路径分组。
- 不解释 `§` 和 `&` 颜色码，请使用 `<green>` 这类 MiniMessage 标签。
- 使用 `zh.yml` 这类只带语言的文件。添加 `zh_CN.yml` 这类地区变体时，同时提供基础文件 `zh.yml`：只有地区文件的语言会在加载时告警，且不会被其他地区或只带语言的请求选中。

## 源语言

源语言是模块自身文本所用的语言，在模块的 `plugin.yml` 中声明：

```yaml
source-language: en
```

省略这个键时，源语言为 `en`。无效的值会记录为 `Module '<name>' has invalid source-language '<value>'; using en`。源语言是查找过程中显示键本身之前最后尝试的语言文件（见[语言选择](#language-selection)），因此请为它提供完整的文件。

## 使用 `Messages`

每个模块有自己的 `Messages` 服务，像其他 Bean 一样注入：

```java
@Service
public class HomeNotices {
    @Autowired
    private Messages messages;

    public void homeSet(Player player, String homeName) {
        messages.send(player, messages.key("home.set.success"), Arg.string("home", homeName));
    }
}
```

注入的实例绑定到模块的命名空间。命名空间是模块 `plugin.yml` 中的名称转为小写，并把 `a-z`、`0-9`、`_`、`.`、`-` 以外的字符替换为 `_`（`MessageKey.namespaceFor`）。框架自己的命名空间是 `ultitools`。

- `messages.key(path)` 返回 `MessageKey` `<命名空间>:<路径>`。`MessageKey.of(namespace, path)` 与 `MessageKey.parse("namespace:path")` 可为任意命名空间构造键，所有命名空间都可以渲染。
- `Text.of(key, args...)` 是延迟消息：一个键加它的参数，只在知道查看者的语言时才渲染。名称、标题、标签和说明文字这类在投递前就要保存的文本使用它。`Text.plain(string)` 与 `Text.literal(component)` 是固定文本，所有语言下相同。
- `send(audience, text)` 与 `send(audience, key, args...)` 发送聊天文本，`sendActionBar(audience, text)` 发送动作栏文本。
- `render(text, viewer)` 与 `render(text, locale)` 返回 `Component` 而不发送。两者都有 `(key, viewer 或 locale, args...)` 的简写形式。
- `isDefined(key, locale)` 报告该语言（精确匹配或只看语言部分）是否定义了这个键，不经过后备。

`Messages` 是线程安全的，可以在任何线程调用。缺少语言文件或键时不会抛出异常。

### 按接收者投递

`send`、`sendActionBar` 和 `forEachRecipient(audience, text, action)` 会展开转发型受众（如服务器受众或一组玩家），并为每个接收者按其语言各渲染一次。不会对转发型受众本身调用该操作。调用期间加入的玩家可能被跳过，调用期间退出的玩家仍可能被传给该操作，此时发送不产生任何效果。

### 共享对象

实体名称、文本展示实体、共享 Boss 栏这类所有玩家看到同一份的对象，无法按接收者渲染，它们的文本使用 `messages.shared(text)`：

```java
display.text(messages.shared(Text.of(messages.key("hologram.welcome"))));
```

`language: auto` 时，翻译文本会变成由 Paper 按客户端渲染的可翻译组件，其后备内容是按后备语言渲染的文本。`language` 为具体语言时，文本在服务器端按强制语言渲染。固定文本保持原样。

## 参数

译文按名称引用参数，例如 `"欢迎，<player>！"`。不支持位置参数。参数名须匹配 `[a-z0-9_-]+`，在同一个 `Text` 内不能重复，并且优先于同名的 MiniMessage 内置标签。

| 工厂方法 | 值 | 译文中可写的格式 |
| --- | --- | --- |
| `Arg.string(name, value)` | `String` | 无，按原样显示 |
| `Arg.number(name, value)` | 不可变的 `Number`，如 `Integer`、`Long`、`Double`、`BigDecimal` | `<n>` 默认数字格式；`<n:'#,##0.00'>` `DecimalFormat` 模式；`<n:'de-DE':'#,##0.00'>` 指定语言；`<n:choice:'…'>` `ChoiceFormat` 模式 |
| `Arg.time(name, value)` | `Instant`、`ZonedDateTime`、`OffsetDateTime`、`LocalDateTime`、`LocalDate`、`LocalTime` | `<t>` 该语言的中等样式；`<t:'d MMMM yyyy'>` `DateTimeFormatter` 模式 |
| `Arg.text(name, text)` | `Text` | 无，按外层消息的语言渲染 |
| `Arg.component(name, component)` | `ComponentLike` | 无，是 `Arg.text(name, Text.literal(component))` 的简写 |

选择模式按数字选取文本，例如 `<n:choice:'0#no items|1#one item|1<<n> items'>`；选中的文本会带着同样的参数按 MiniMessage 解析，因此其中的 `<n>` 输出格式化后的数字。

格式化使用请求的语言，即使消息文本来自后备语言文件。`Instant` 按服务器默认时区显示；带时区或偏移的值按其自身的时区或偏移显示。模式中含有 `:`、`<`、`>` 或引号时要加引号。引擎无法应用的格式不会让渲染抛出异常：该值按默认格式显示，并且每个键、语言和参数名各记录一次警告。7.0 没有布尔选择，也没有复数类别。

```java
messages.send(player, messages.key("shop.bought"),
        Arg.number("count", 3),
        Arg.time("when", Instant.now()));
```

```yaml
shop:
  bought: "于 <when> 购买了 <count:'#,##0'> 件物品。"
```

### 来自玩家和服主的文本

玩家或服主输入的文本，例如家的名称、聊天内容或告示牌文字，作为参数传入，通常用 `Arg.string`。其中的 MiniMessage 标签永远不会被解释，家名称里的 `<red>` 会原样显示为这五个字符。不要把这类文本拼接进 MiniMessage 模板。只有语言文件中的值会解释标签；`Text.plain` 与 `Arg.string` 按原样显示字符。

## 语言选择 {#language-selection}

`plugins/UltiTools/config.yml` 中有两个键控制语言。新装时两者都是 `auto`：

```yaml
language: "auto"
fallback-language: "auto"
```

`language` 决定玩家看到的语言：

- `auto` 跟随每个玩家当前的客户端语言。玩家语言在每次投递时读取，从不缓存，客户端改语言后下一条消息即生效。
- `en`、`zh` 这类具体语言对所有玩家强制生效。`zh-myserver` 这类 6.x 自定义名称强制使用其官方前缀语言（`zh`）；没有匹配前缀的安全名称使用 `en`。

`fallback-language` 是控制台语言，也是玩家的语言没有译文时使用的语言。控制台、命令方块和其他非玩家受众始终使用它。它按以下顺序确定：

1. 具体的 `fallback-language`（如 `en` 或 `zh`）始终优先，并且不探测时区。
2. `fallback-language` 为 `auto`、空白或缺失时，沿用具体的 `language`，包括自定义名称的官方前缀。因此 `language: en` 加 `fallback-language: auto` 时，即使主机在中国，玩家和控制台也都用英文。
3. 只有 `language` 也为 `auto`、空白或缺失时才按时区规则选择。系统时区 ID `Asia/Shanghai`、`Asia/Urumqi`、`Asia/Hong_Kong`、`Asia/Macau` 以及别名 `PRC`、`Asia/Chongqing`、`Asia/Chungking`、`Asia/Harbin`、`Asia/Kashgar`、`Hongkong`、`Asia/Macao` 选择 `zh`，其他 ID 一律选择 `en`。不看 UTC 偏移：`Asia/Singapore` 和 `Etc/GMT-8` 都选择 `en`。

后备语言在启动时和每次成功的完整 `/ul reload` 时解析，并记录所选语言及原因，例如 `Fallback language: <language> (system time zone <zone>; set fallback-language in config.yml to override)`。无效的值会记录为 `Invalid language locale: <value>` 或 `Invalid fallback-language locale: <value>`。

云主机和容器常用 UTC，因此在那里新装默认使用英文，与 6.x 出厂的中文默认不同。中文客户端在语言文件有中文译文的地方仍看到中文。想要中文，写 `fallback-language: zh` 并执行完整的 `/ul reload`。

已有的配置文件绝不会被改写。已有具体 `language: zh` 或 `en` 且没有后备键的配置，以该语言作为后备语言。没有 `language` 键的配置按 `auto` 处理，而不是 6.x 原先的默认值 `zh`，也不会把这个键写回文件。

### 查找顺序

每条消息依次尝试：请求的语言、后备语言、模块的源语言，最后是带命名空间的键本身。每个候选先精确匹配，再只按语言部分匹配，所以 `zh_CN` 也会尝试 `zh`。缺失的键按每个键和请求语言各记录一次警告。

## 服主覆盖文件 {#operator-overrides}

服主不修改模块 JAR，而是只把要改的键写进与随包文件同名的覆盖文件：

| 文本所属 | 覆盖文件 |
| --- | --- |
| 模块 | `plugins/UltiTools/pluginConfig/<模块>/messages/<语言>.yml` |
| 框架 | `plugins/UltiTools/messages/<语言>.yml` |

使用新语言名称的覆盖文件会增加一种语言。删除覆盖文件即恢复随包文本。覆盖文件遵守与随包文件相同的规则（只读 `.yml`、UTF-8、点分键、MiniMessage）。框架只读取这些文件，从不写入。

框架在它们旁边的 `messages/reference/` 中保存随包文件的只读参考副本。副本以下面的文件头开始，并按随包内容重写；修改副本没有任何效果：

```text
# Generated by UltiTools on every startup; edits here have no effect.
# Copy keys to the same-named override file in the parent directory instead.
```

## 重载 {#reloading}

| 改动 | 生效时机 |
| --- | --- |
| `config.yml` 中的 `language` 或 `fallback-language` | 成功的完整 `/ul reload`，或重启 |
| 模块覆盖文件 | 重载该模块（`/ul reload <模块>`），或重启 |
| 框架覆盖文件 | 仅重启 |
| 玩家的客户端语言 | 下一条消息 |

::: warning 框架覆盖文件需要重启
7.0 中框架语言文件的覆盖只在启动时读取，`/ul reload` 不会重载。后续改动会补上重载入口。
:::

## 旧的 `i18n(...)` 路径

在调用方迁移期间，6.x 的语言系统在 7.0 中仍然存在。`i18n(...)`、`getLanguageCode()`、`getConfiguredLanguage()` 以及 `lang/` 中的文件按 [I18n 多语言](/zh/guide/essentials/i18n) 所述工作，旧路径仍会读取自定义语言文件。移除它是之后单独的改动。

`language` 为 `auto`、空白或缺失时，`getConfiguredLanguage()` 返回解析出的后备语言的基础语言，旧路径加载该语言。具体名称（包括自定义名称）原样返回。

新的语言文件不读取 6.x 文件。6.x 的语言文件、句子键、自定义语言名称和服主的修改都不会转换。请用点分键和 MiniMessage 值重新编写所需文本。模块迁移见[模块版本](/zh/guide/advanced/module-versioning#modules-6x-to-7)。

## 已知限制

- 框架语言文件的覆盖只在重启时重载（见[重载](#reloading)）。
- 时区规则使用时区 ID 而不是 UTC 偏移，并且只在启动和完整 `/ul reload` 时解析。
- 6.x 的语言文件和自定义名称不会转换为新的语言文件。
- 没有 `language` 键的配置按 `auto` 处理，而不是 6.x 的默认值 `zh`。
