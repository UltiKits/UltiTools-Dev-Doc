package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.AbstractConsoleCommandExecutor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;

public class ConsoleCommandExample extends AbstractConsoleCommandExecutor {
    @Override
    protected boolean onConsoleCommand(CommandSender commandSender, Command command, String[] strings) {
        // your code
        return true;
    }

    // Required: sendHelpMessage is abstract in AbstractCommand.
    @Override
    protected void sendHelpMessage(CommandSender sender) {
        // send help message
    }
}
