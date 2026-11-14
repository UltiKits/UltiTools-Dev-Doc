# 配置转换器

::: info 可用版本
配置转换已在 UltiTools-API v6.3.0 中提供。
:::

`ConfigConverter<T>` 在声明 Java 值与普通配置数据之间双向转换。通过模块扫描包内的 `@ConfigConverterFor` 在配置构造前登记。文档存储和注册表协调桥接是内部实现，不是模块事务 API。

## 转换器 API

公开类型位于 `com.ultikits.ultitools.config.convert`。

```java
public interface ConfigConverter<T> {
    Object toPlain(T value, ConversionContext ctx) throws ConversionException;
    T fromPlain(Object plain, ConversionContext ctx) throws ConversionException;
}
```

`ConversionContext` 提供 `file()`、完整键不可变列表 `path()` 和包含泛型的 `declaredType()`。用 `ctx.toPlain(nested)` 转换嵌套运行值，`ctx.fromPlain(nested, type)` 转换嵌套声明类型。`ConversionException` 构造参数是原因、文件、完整路径、声明类型，可选底层原因；它提供定位转换失败信息。自 v6.3.0 起，传入的原因会以 `(reason: ...)` 显示在给服主的跳过警告里，键名像密钥时与值一起脱敏，所以原因要写给服主看：说明该设置期望什么。

## 普通数据与往返

自 v6.3.0 起，普通数据是 null、`String`、`Boolean`、`Integer`、`Long`、`BigInteger`、`Double`、这些数据组成的列表和字符串键映射。不能返回 Bukkit `MemorySection` 或任意 Java bean。UUID、枚举、`BigDecimal` 由内置转换器用文字表示。注册的 Bukkit `ConfigurationSerializable` 使用序列化别名和普通映射；读入 `Object` 字段的值保持普通数据，不自动构造 Bukkit 对象。

转换器对声明类型中集合和数组均无 null 元素的每个值 `x` 必须满足正向相等。类型化集合（包括 `List<Object>`）和引用数组（包括 `Object[]`）写入时省略 null 元素，每个字段记录一条定位警告；从文件读取时，类型化集合里的 null 元素被跳过并给出定位警告，与 6.2 一致。映射的 null 值与整个 null 字段仍可往返。声明为 `Object` 的普通数据槽保持原样。反向相等适用于转换器输出的规范普通值 `p`（`p = toPlain(x)`）：

```text
fromPlain(toPlain(x)) equals x
toPlain(fromPlain(p)) equals p
```

转换器可以接受非规范输入 `q`。其规范形式为 `toPlain(fromPlain(q))`，规范化必须稳定：

```text
fromPlain(toPlain(fromPlain(q))) equals fromPlain(q)
```

已批准的转换行为不变：数值转 String、数字文字转 int/float、`"false"` 转 boolean、重复元素转 Set。无需保留原始非规范表示。比较的是语义值，不是对象身份；普通数值按值比较。读时加十、写时不减十违反正向相等。面板映射叶编辑和三方重载依靠正向相等保持未改兄弟项。测试 null、嵌套值、转换器输出的普通值及接受的非规范输入。

## 注册与查找

自 v6.3.0 起，发现的转换器需要是 public 顶层类，带 public 无参构造器；扫描器不发现嵌套转换器。转换器在配置实体前实例化，不是 IoC bean；不能依赖注入或模块初始化副作用。放进 `@UltiToolsModule(scanBasePackages = {...})` 的包。重复目标类型拒绝加载并列两个类。`@ConfigConverterFor(value = T.class, exact = true)` 只服务精确类型，默认 `exact = false` 也服务子类型。

查找顺序为：

1. 模块注册表：精确类、非 exact 父类链、非 exact 接口。
2. 框架注册表，同样顺序。
3. 泛型集合、映射、数组、枚举、`Object` 转换。
4. 有登记别名的 Bukkit `ConfigurationSerializable` 后备转换。
5. 无转换器：选中配置类型检查拒绝模块加载。

完整继承泛型在读取或创建任何选中配置文件前检查。配方值不支持时诊断结构如下（名称来自相关模块）：

```text
Module UltiRecipe, file config/recipes.yml, key "recipes": no config converter for ...RecipeDefinition (declared as java.util.Map<java.lang.String, ...RecipeDefinition>). Register one with @ConfigConverterFor(RecipeDefinition.class) in the module's scan packages, or declare the value type as Map<String, Object>.
```

实际消息列完整类型。声明类型可转换但整个值无效时使用最初声明默认值，无效列表/映射元素跳过并定位警告。未知运行对象在保存时拒绝且不改目标。绑定警告隐藏密钥形状值。

## 转换器示例

把以下值/字段成员放进 `example.config` 包的 `MigrationExample` 类（imports 放在外层类前）。转换器单独放进同一扫描包的 public 顶层文件 `TokenConverter.java`，见第二段；不能嵌套在外层类中。这些内联片段面向 v6.3.0；与共享示例文件引用不同，文档构建不会编译它们。严格的单文字键映射使两条等式成立，包括 null 文字。

```java
import java.util.Objects;
import com.ultikits.ultitools.annotations.ConfigEntry;

public static class Token {
    public String text;
    public Token(String text) { this.text = text; }
    @Override public boolean equals(Object other) {
        return other instanceof Token && Objects.equals(text, ((Token) other).text);
    }
    @Override public int hashCode() { return Objects.hashCode(text); }
}
@ConfigEntry(path = "token")
private Token token = new Token("hello");

```

```java
// TokenConverter.java: a separate top-level source file.
package example.config;

import java.util.LinkedHashMap;
import java.util.Map;
import example.config.MigrationExample.Token;
import com.ultikits.ultitools.config.convert.ConfigConverter;
import com.ultikits.ultitools.config.convert.ConfigConverterFor;
import com.ultikits.ultitools.config.convert.ConversionContext;
import com.ultikits.ultitools.config.convert.ConversionException;

@ConfigConverterFor(Token.class)
public class TokenConverter implements ConfigConverter<Token> {
    public TokenConverter() { }
    @Override public Object toPlain(Token value, ConversionContext ctx) {
        if (value == null) { return null; }
        Map<String, Object> plain = new LinkedHashMap<>();
        plain.put("text", value.text);
        return plain;
    }
    @Override public Token fromPlain(Object plain, ConversionContext ctx)
            throws ConversionException {
        if (plain == null) { return null; }
        if (!(plain instanceof Map)) { throw failure(ctx); }
        Map<?, ?> map = (Map<?, ?>) plain;
        if (map.size() != 1 || !map.containsKey("text")
                || !(map.get("text") == null || map.get("text") instanceof String)) {
            throw failure(ctx);
        }
        return new Token((String) map.get("text"));
    }
    private ConversionException failure(ConversionContext ctx) {
        return new ConversionException("Expected only a text key containing text or null",
                ctx.file(), ctx.path(), ctx.declaredType());
    }
}
```

## 旧解析器迁移

::: warning 已在 v6.4.0 移除
旧解析器 API 已删除：`ConfigEntry#parser()`、`interfaces.Parser`、`interfaces.ObjectConfigSerializer`、`interfaces.impl.pasers.ConfigParser`、`DefaultConfigParser`、`StringHashMapParser`。它们在 v6.3.0 已弃用待删。请在扫描包内用 public 顶层 `ConfigConverter<T>` 并加 `@ConfigConverterFor(T.class)` 替换，写法见上面的转换器示例。
:::

删除字段上的 `parser = ...`。只声明了 `DefaultConfigParser` 或 `StringHashMapParser` 的字段无需替换，内置转换已覆盖这些类型。

完整映射键、文件保护、整份输出、原子/备份保存、重载和实体 accessor 删除见[配置文件](/zh/guide/essentials/config-file)。仍适用的存储限制记录在 [#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578)（具体哪几项见配置文件一页）；[#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580) 是已记录的读取器限制。
