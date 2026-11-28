package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdTarget;
import org.bukkit.command.CommandSender;

@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(alias = {"mycmd"})
public class PlayerOnlyCommand extends BaseCommandExecutor {
    // Automatically rejects console users

    @Override
    protected void handleHelp(CommandSender sender) {
        sender.sendMessage("/mycmd");
    }
}
