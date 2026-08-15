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
        } catch (NumberFormatException e) {
            throw new TypeParseException(value, Color.class,
                "Invalid color format. Use hexadecimal (e.g., FF0000)", e);
        }
    }

    @Override
    public int getPriority() {
        return 0;
    }
}
