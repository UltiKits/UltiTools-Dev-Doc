package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.abstracts.command.validation.ValidatorChain;
import com.ultikits.ultitools.abstracts.command.validation.validators.PermissionValidator;
import com.ultikits.ultitools.abstracts.command.validation.validators.SenderTypeValidator;
import org.bukkit.command.CommandSender;

public class ChainCommand extends BaseCommandExecutor {

    // Build the chain inside the constructor. A chain assigned to a local
    // variable outside the class is not reachable from super(...).
    public ChainCommand() {
        super(ValidatorChain.builder()
            .add(SenderTypeValidator.fromAnnotation(null))
            .add(new PermissionValidator("myadmin.use", false))
            .add(new WorldRestrictionValidator("world"))
            .build());
    }

    @Override
    protected void handleHelp(CommandSender sender) { }
}
