package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.parser.TypeParseException;
import com.ultikits.ultitools.abstracts.command.parser.TypeParser;

import java.util.Arrays;
import java.util.List;

public class RangeParser implements TypeParser<IntRange> {

    @Override
    public Class<IntRange> getPrimaryType() {
        return IntRange.class;
    }

    @Override
    public List<Class<?>> getSupportedTypes() {
        return Arrays.asList(IntRange.class, IntRange[].class);
    }

    @Override
    public IntRange parse(String value) throws TypeParseException {
        String[] parts = value.split("-");
        if (parts.length != 2) {
            throw new TypeParseException(value, IntRange.class,
                "Range format: min-max (e.g., 1-100)");
        }

        try {
            int min = Integer.parseInt(parts[0]);
            int max = Integer.parseInt(parts[1]);
            return new IntRange(min, max);
        } catch (NumberFormatException e) {
            throw new TypeParseException(value, IntRange.class,
                "Range bounds must be integers", e);
        }
    }
}
