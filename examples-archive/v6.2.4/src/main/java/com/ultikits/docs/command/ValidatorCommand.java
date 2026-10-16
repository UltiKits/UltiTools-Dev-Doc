package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import org.bukkit.command.CommandSender;

public class ValidatorCommand extends BaseCommandExecutor {

    public ValidatorCommand() {
        super();
        addValidator(new WorldRestrictionValidator("world", "world_nether"));
    }

    @Override
    protected void handleHelp(CommandSender sender) { }
}
