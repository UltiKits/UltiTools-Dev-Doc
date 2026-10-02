# 配置转换器

::: info 可用版本
本页描述 alpha 分支尚未发布的配置转换行为，自 v6.3.0 起可用。
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

`ConversionContext` 提供 `file()`、完整键不可变列表 `path()` 和包含泛型的 `declaredType()`。用 `ctx.toPlain(nested)` 转换嵌套运行值，`ctx.fromPlain(nested, type)` 转换嵌套声明类型。`ConversionException` 构造参数是原因、文件、完整路径、声明类型，可选底层原因；它提供定位转换失败信息。

## 普通数据与往返

自 v6.3.0 起，普通数据是 null、`String`、`Boolean`、`Integer`、`Long`、`BigInteger`、`Double`、这些数据组成的列表和字符串键映射。不能返回 Bukkit `MemorySection` 或任意 Java bean。UUID、枚举、`BigDecimal` 由内置转换器用文字表示。注册的 Bukkit `ConfigurationSerializable` 使用序列化别名和普通映射；读入 `Object` 字段的值保持普通数据，不自动构造 Bukkit 对象。

转换器对接受的值必须满足两条等式：

```text
fromPlain(toPlain(x)) equals x
toPlain(fromPlain(p)) equals p
```

比较的是语义值，不是对象身份；普通数值按值比较。接受额外字段再悄悄丢掉违反第二条；读时加十、写时不减十违反互逆要求。面板映射叶编辑和三方重载依靠它保持未改兄弟项。双向测试 null、嵌套值和代表输入。

## 注册与查找

自 v6.3.0 起，发现的转换器需要 public 无参构造器，在配置实体前实例化，不是 IoC bean；不能依赖注入或模块初始化副作用。放进 `@UltiToolsModule(scanBasePackages = {...})` 的包。重复目标类型拒绝加载并列两个类。`@ConfigConverterFor(value = T.class, exact = true)` 只服务精确类型，默认 `exact = false` 也服务子类型。

查找顺序为：

1. 显式非默认 `@ConfigEntry(parser = X.class)` 使用旧适配器。
2. 模块注册表：精确类、非 exact 父类链、非 exact 接口。
3. 框架注册表，同样顺序。
4. 泛型集合、映射、数组、枚举、`Object` 转换。
5. 有登记别名的 Bukkit `ConfigurationSerializable` 后备转换。
6. 无转换器：选中配置类型检查拒绝模块加载。

完整继承泛型在读取或创建任何选中配置文件前检查。配方值不支持时诊断结构如下（名称来自相关模块）：

```text
Module UltiRecipe, file config/recipes.yml, key "recipes": no config converter for ...RecipeDefinition (declared as java.util.Map<java.lang.String, ...RecipeDefinition>). Register one with @ConfigConverterFor in the module scan packages, or declare a supported plain-data type.
```

实际消息列完整类型。声明类型可转换但整个值无效时使用最初声明默认值，无效列表/映射元素跳过并定位警告。未知运行对象在保存时拒绝且不改目标。绑定警告隐藏密钥形状值。

## 转换器示例

把以下成员放进扫描包内的 `MigrationExample` 类。这是未发布分支内联片段，不是对已发布构件编译的引用。严格的单文字键映射使两条等式成立，包括 null 文字。

```java
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import com.ultikits.ultitools.annotations.ConfigEntry;
import com.ultikits.ultitools.config.convert.ConfigConverter;
import com.ultikits.ultitools.config.convert.ConfigConverterFor;
import com.ultikits.ultitools.config.convert.ConversionContext;
import com.ultikits.ultitools.config.convert.ConversionException;

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

@ConfigConverterFor(Token.class)
public static class TokenConverter implements ConfigConverter<Token> {
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

自 v6.3.0 起，六项公告首次带 `@Deprecated(since = "6.3.0", forRemoval = true)`：`ConfigEntry#parser()`、`interfaces.Parser`、`interfaces.ObjectConfigSerializer`、`interfaces.impl.pasers.ConfigParser`、`DefaultConfigParser`、`StringHashMapParser`。公告下个 MINOR 6.4.0 删除，已发布的包名拼写 `pasers` 不变。

`DefaultConfigParser` 子类曾使用继承的配置节读取器和反射写入器。上述 `Token` 的旧声明可以是：

```java
public static class TokenParser extends
        com.ultikits.ultitools.interfaces.impl.pasers.DefaultConfigParser {
    @Override public Object parse(Object raw) {
        Map<?, ?> values = (Map<?, ?>) super.parse(raw);
        return new Token((String) values.get("text"));
    }
}
@ConfigEntry(path = "token", parser = TokenParser.class)
private Token oldToken = new Token("hello");
```

用转换器示例的字段和类替换旧字段/解析器。显式旧覆盖仍收到隔离 Bukkit 配置节（保留点号拆分），序列化输出仍须通过普通数据边界。默认 `DefaultConfigParser.class` 注解值改表示注册表转换，不增加任意自定义类原始透传例外。

完整映射键、文件保护、整份输出、原子/备份保存、重载和实体 accessor 删除见[配置文件](/zh/guide/essentials/config-file)。存储已知限制仍记录在 [#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578) 和 [#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580)。
