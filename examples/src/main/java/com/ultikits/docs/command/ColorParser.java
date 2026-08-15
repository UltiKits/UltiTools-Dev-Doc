package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.parser.TypeParseException;
import com.ultikits.ultitools.abstracts.command.parser.TypeParser;
import org.bukkit.Color;

import java.util.Arrays;
import java.util.List;

public class ColorParser implements TypeParser<Color> {

    @Override
    public Class<Color> getPrimaryType() {
        return Color.class;
    }

    @Override
    public List<Class<?>> getSupportedTypes() {
        return Arrays.asList(Color.class, Color[].class);
    }

    @Override
    public Color parse(String value) throws TypeParseException {
        try {
            // Parse hex color like "FF0000"
            int rgb = Integer.parseInt(value, 16);
            return Color.fromRGB(rgb);
        } catch (IllegalArgumentException e) {
            // Catch IllegalArgumentException, not NumberFormatException. Two
            // different failures land here and only one of them is a format
            // error: Integer.parseInt throws NumberFormatException on bad hex,
            // while Color.fromRGB throws plain IllegalArgumentException for a
            // value outside the low 24 bits (e.g. "1000000" parses fine, then
            // gets rejected). NumberFormatException extends
            // IllegalArgumentException, so catching the supertype covers both.
            // Catching only the subtype lets the range error escape as an
            // undeclared runtime exception instead of a TypeParseException.
            throw new TypeParseException(value, Color.class,
                "Invalid color. Use 6-digit hexadecimal RGB (e.g., FF0000)", e);
        }
    }

    @Override
    public int getPriority() {
        return 0;
    }
}
