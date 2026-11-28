package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.CommandContext;
import com.ultikits.ultitools.abstracts.command.validation.CommandValidator;
import org.bukkit.entity.Player;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class WorldRestrictionValidator implements CommandValidator {

    private final Set<String> allowedWorlds = new HashSet<>();

    public WorldRestrictionValidator(String... worlds) {
        allowedWorlds.addAll(Arrays.asList(worlds));
    }

    @Override
    public ValidationResult validate(CommandContext context) {
        if (!context.isPlayer()) {
            return ValidationResult.success();
        }

        Player player = context.getPlayer();
        if (!allowedWorlds.contains(player.getWorld().getName())) {
            return ValidationResult.failure(
                "You can only use this command in: " + String.join(", ", allowedWorlds),
                "command.error.wrong_world"
            );
        }

        return ValidationResult.success();
    }

    @Override
    public int getOrder() {
        return 400;  // Execute after permission validators
    }

    @Override
    public String getName() {
        return "WorldRestrictionValidator";
    }
}
