# Config Converters

::: info Availability
This page describes unreleased configuration conversion as of v6.3.0 on the framework alpha branch.
:::

`ConfigConverter<T>` converts a declared Java value to plain configuration data and back. Register a converter with `@ConfigConverterFor` in your module's scan packages before configuration construction. The storage document and registry coordination bridges are internal, not a module transaction API.

## Converter API

The public types are in `com.ultikits.ultitools.config.convert`.

```java
public interface ConfigConverter<T> {
    Object toPlain(T value, ConversionContext ctx) throws ConversionException;
    T fromPlain(Object plain, ConversionContext ctx) throws ConversionException;
}
```

`ConversionContext` supplies `file()`, `path()` (an immutable list of whole keys), and `declaredType()` including generic arguments. Use `ctx.toPlain(nested)` for a nested runtime value and `ctx.fromPlain(nested, type)` for a nested declared type. A `ConversionException` takes a reason, file, whole path and declared type, optionally a cause; it provides located conversion failure information.

## Plain data and round trips

As of v6.3.0, plain data is null, `String`, `Boolean`, `Integer`, `Long`, `BigInteger`, `Double`, lists and string-keyed maps of plain data. Return neither Bukkit `MemorySection` nor an arbitrary Java bean. UUIDs, enums and `BigDecimal` use text through their built-in converters. A registered Bukkit `ConfigurationSerializable` uses its serialization alias and plain map; a value read into an `Object` field stays plain, rather than automatically constructing a Bukkit object.

Your converter must satisfy forward equality for every value `x` of the declared type whose collections and arrays contain no null element. Typed collections (including `List<Object>`) and reference arrays (including `Object[]`) omit null elements on write with one located warning per field; a null element of a typed collection read from the file is skipped with a located warning, as in 6.2. Null map values and null whole fields still round-trip. Plain data in a declared `Object` slot is unchanged. Reverse equality applies to canonical plain values `p` emitted by the converter (`p = toPlain(x)`):

```text
fromPlain(toPlain(x)) equals x
toPlain(fromPlain(p)) equals p
```

A converter may accept noncanonical input `q`. Its canonical form is `toPlain(fromPlain(q))`, and normalization must be stable:

```text
fromPlain(toPlain(fromPlain(q))) equals fromPlain(q)
```

The approved coercions remain unchanged: number to String, numeric text to int/float, `"false"` to boolean and duplicate elements to a Set. They need not preserve the original noncanonical representation. Equality is semantic, not object identity; numeric plain values compare by value. Adding ten on read without subtracting ten on write violates forward equality. Panel map leaf edits and three-way reload depend on that equality to preserve unchanged siblings. Test null, nested values, converter-emitted plain values and accepted noncanonical inputs.

## Registration and lookup

As of v6.3.0, a discovered converter must be a public top-level class with a public no-argument constructor. The package scanner does not discover nested converters. It is instantiated before configuration entities and is not an IoC bean; do not use injected dependencies or module initialization side effects. Put it in the packages named by `@UltiToolsModule(scanBasePackages = {...})`. Two registrations for the same target class refuse load and name both classes. `@ConfigConverterFor(value = T.class, exact = true)` serves only that exact class; the default `exact = false` also serves subtypes.

Lookup order is:

1. An explicit non-default `@ConfigEntry(parser = X.class)` selects the legacy adapter.
2. The module registry: exact class, non-exact superclass chain, then non-exact interfaces.
3. The framework registry, in the same order.
4. Generic collection/map/array/enum and `Object` conversion.
5. Bukkit `ConfigurationSerializable` fallback with a registered alias.
6. No converter: selected configuration type check refuses module load.

Full inherited generic types are checked before any selected config file is read or created. For example an unsupported recipe value produces a diagnostic with this structure (names reflect the affected module):

```text
Module UltiRecipe, file config/recipes.yml, key "recipes": no config converter for ...RecipeDefinition (declared as java.util.Map<java.lang.String, ...RecipeDefinition>). Register one with @ConfigConverterFor in the module scan packages, or declare a supported plain-data type.
```

The actual message names the complete type. During binding, a convertible declared type with an invalid whole value uses its initially declared default, and invalid list/map elements are skipped with a located warning. Unknown runtime objects on save refuse the write before changing the target. Secret-shaped values are redacted in binding warnings.

## Converter example

Place the value/field members below inside `MigrationExample` in package `example.config` (imports go before the outer class). Put the converter in its own public top-level `TokenConverter.java` in the same scanned package, as shown in the second block; do not nest it in the outer class. These are inline snippets for the unreleased branch, not references compiled against the released artifact. The text-only map shape is strict so both equations hold, including null text.

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

## Legacy parser migration

As of v6.3.0, these six announcements first carry `@Deprecated(since = "6.3.0", forRemoval = true)`: `ConfigEntry#parser()`, `interfaces.Parser`, `interfaces.ObjectConfigSerializer`, `interfaces.impl.pasers.ConfigParser`, `DefaultConfigParser`, `StringHashMapParser`. The announced next-MINOR removal is 6.4.0. The published package spelling `pasers` is unchanged.

A `DefaultConfigParser` subclass previously used the inherited section reader and reflective writer. For the `Token` above, a legacy declaration could be:

```java
import java.util.Map;

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

Replace the old field/parser with the converter example's field and class. An explicit legacy override still receives detached Bukkit sections for maps (including old dotted-key splitting), while its serialized output must cross the plain boundary. The default `DefaultConfigParser.class` annotation value instead means registry conversion. No arbitrary custom-class raw passthrough exception is added.

See [Configuration](/guide/essentials/config-file) for whole map keys, file protection, edited emission, atomic/backed saves, reload and the removed entity accessor. Known storage limits remain recorded in [#578](https://github.com/UltiKits/UltiTools-Reborn/issues/578) and [#580](https://github.com/UltiKits/UltiTools-Reborn/issues/580).
