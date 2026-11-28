package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.AbstractPlayerCommandExecutor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

public class PlayerCommandExample extends AbstractPlayerCommandExecutor {
    @Override
    protected boolean onPlayerCommand(Command command, String[] strings, Player player) {
        // your code
        return true;
    }

    // Required: sendHelpMessage is abstract in AbstractCommand.
    @Override
    protected void sendHelpMessage(CommandSender sender) {
        // send help message
    }
}
