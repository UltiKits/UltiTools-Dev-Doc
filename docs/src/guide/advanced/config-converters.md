# Config Converters

This guide targets UltiTools-API 7.0. For 6.x, see the [archived v6.5.0 guide](/v6.5.0/guide/advanced/config-converters.html).

`ConfigConverter<T>` converts a declared Java value to plain configuration data and back. Register a converter with `@ConfigConverterFor` in your module's scan packages before configuration construction. The storage document and registry coordination bridges are internal, not a module transaction API.

## Converter API

The public types are in `com.ultikits.ultitools.config.convert`.

```java
public interface ConfigConverter<T> {
    Object toPlain(T value, ConversionContext ctx) throws ConversionException;
    T fromPlain(Object plain, ConversionContext ctx) throws ConversionException;
}
```

`ConversionContext` supplies `file()`, `path()` (an immutable list of whole keys), and `declaredType()` including generic arguments. Use `ctx.toPlain(nested)` for a nested runtime value and `ctx.fromPlain(nested, type)` for a nested declared type. A `ConversionException` takes a reason, file, whole path and declared type, optionally a cause; it provides located conversion failure information. The reason you pass is shown to the operator in the skip warning as `(reason: ...)`, redacted together with the value under a secret-shaped key, so write it for the operator: say what the setting expects.

## Plain data and round trips

Plain data is null, `String`, `Boolean`, `Integer`, `Long`, `BigInteger`, `Double`, lists and string-keyed maps of plain data. Return neither Bukkit `MemorySection` nor an arbitrary Java bean. UUIDs, enums and `BigDecimal` use text through their built-in converters. A registered Bukkit `ConfigurationSerializable` uses its serialization alias and plain map; a value read into an `Object` field stays plain, rather than automatically constructing a Bukkit object.

Your converter must satisfy forward equality for every value `x` of the declared type whose collections and arrays contain no null element. Typed collections (including `List<Object>`) and reference arrays (including `Object[]`) omit null elements on write with one located warning per field; a null element of a typed collection read from the file is skipped with a located warning. Null map values and null whole fields still round-trip. Plain data in a declared `Object` slot is unchanged. Reverse equality applies to canonical plain values `p` emitted by the converter (`p = toPlain(x)`):

```text
fromPlain(toPlain(x)) equals x
toPlain(fromPlain(p)) equals p
```

A converter may accept noncanonical input `q`. Its canonical form is `toPlain(fromPlain(q))`, and normalization must be stable:

```text
fromPlain(toPlain(fromPlain(q))) equals fromPlain(q)
```

Built-in coercions include number to String, numeric text to `int` or `float`, `"false"` to boolean and duplicate elements to a Set. They need not preserve the original noncanonical representation. Equality is semantic, not object identity; numeric plain values compare by value. Adding ten on read without subtracting ten on write violates forward equality. Panel map leaf edits and three-way reload depend on that equality to preserve unchanged siblings. Test null, nested values, converter-emitted plain values and accepted noncanonical inputs.

## Registration and lookup

A discovered converter must be a public top-level class with a public no-argument constructor. The package scanner does not discover nested converters. It is instantiated before configuration entities and is not an IoC bean; do not use injected dependencies or module initialization side effects. Put it in a scanned package: by default the package of the module class, or the packages named by `@UltiToolsModule(scanBasePackages = {...})`. Two registrations for the same target class refuse load and name both classes. `@ConfigConverterFor(value = T.class, exact = true)` serves only that exact class; the default `exact = false` also serves subtypes.

Lookup order is:

1. The module registry: exact class, non-exact superclass chain, then non-exact interfaces.
2. The framework registry, in the same order.
3. Generic collection/map/array/enum and `Object` conversion.
4. Bukkit `ConfigurationSerializable` fallback with a registered alias.
5. No converter: selected configuration type check refuses module load.

Full inherited generic types are checked before any selected config file is read or created. For example an unsupported recipe value produces a diagnostic with this structure (names reflect the affected module):

```text
Module UltiRecipe, file config/recipes.yml, key "recipes": no config converter for ...RecipeDefinition (declared as java.util.Map<java.lang.String, ...RecipeDefinition>). Register one with @ConfigConverterFor(RecipeDefinition.class) in the module's scan packages, or declare the value type as Map<String, Object>.
```

The actual message names the complete type. A whole-field conversion failure uses the initially declared default; invalid elements of typed collections or maps are skipped. A binding warning can read `File <file>, key '<key>', declared as <type>: found <kind> <value> (reason: <reason>); skipped or using the declared default`. The reason is omitted when unavailable; on a secret-shaped value, both the value and reason are shown as `<redacted>`. Unsupported runtime objects refuse a save before the file changes. As of v7.0.0, the world key in a Paper-serialized location is `world_key`; see [Saved locations](/guide/essentials/config-file#saved-locations).

## Converter example

Create `TokenConfig.java` and `TokenConverter.java` in `example.config`, a package your module scans. The first file declares the config entity and immutable value; the second contains the public top-level converter. The example targets 7.0. The map accepts exactly one `text` key holding text or null.

```java
package example.config;

import com.ultikits.ultitools.abstracts.AbstractConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntity;
import com.ultikits.ultitools.annotations.ConfigEntry;

@ConfigEntity("config/tokens.yml")
public class TokenConfig extends AbstractConfigEntity {
    public record Token(String text) {}

    @ConfigEntry(path = "token")
    private Token token = new Token("hello");

    public TokenConfig(String path) {
        super(path);
    }
}
```

```java
package example.config;

import java.util.LinkedHashMap;
import java.util.Map;
import example.config.TokenConfig.Token;
import com.ultikits.ultitools.config.convert.ConfigConverter;
import com.ultikits.ultitools.config.convert.ConfigConverterFor;
import com.ultikits.ultitools.config.convert.ConversionContext;
import com.ultikits.ultitools.config.convert.ConversionException;

@ConfigConverterFor(Token.class)
public class TokenConverter implements ConfigConverter<Token> {
    @Override
    public Object toPlain(Token value, ConversionContext ctx) {
        if (value == null) { return null; }
        Map<String, Object> plain = new LinkedHashMap<>();
        plain.put("text", value.text());
        return plain;
    }

    @Override
    public Token fromPlain(Object plain, ConversionContext ctx) throws ConversionException {
        if (plain == null) { return null; }
        if (!(plain instanceof Map<?, ?> map) || map.size() != 1 || !map.containsKey("text")) {
            throw failure(ctx);
        }
        Object text = map.get("text");
        if (text != null && !(text instanceof String)) { throw failure(ctx); }
        return new Token((String) text);
    }

    private ConversionException failure(ConversionContext ctx) {
        return new ConversionException("Expected only a text key containing text or null",
                ctx.file(), ctx.path(), ctx.declaredType());
    }
}
```

## Legacy parser migration

7.0 does not provide `@ConfigEntry(parser = ...)`. Remove the attribute; register custom conversion with `@ConfigConverterFor` in a scanned package and use built-in conversion for basic types and plain maps. See [Upgrading from 6.x to 7.0](/guide/advanced/upgrading-to-7) for other migration steps and [Configuration](/guide/essentials/config-file) for write protection and reload behavior.
