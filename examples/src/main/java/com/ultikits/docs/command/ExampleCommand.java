package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdTarget;
import org.bukkit.command.CommandSender;

// Command limits executor
@CmdTarget(CmdTarget.CmdTargetType.BOTH)
@CmdExecutor(
        // Command permission (optional)
        permission = "ultikits.example.all",
        // Command description (optional)
        description = "Test command",
        // Command alias
        alias = {"test", "ts"},
        // Whether to register manually (optional)
        manualRegister = false,
        // Whether to require OP permission (optional)
        requireOp = false
)
public class ExampleCommand extends BaseCommandExecutor {

    @Override
    protected void handleHelp(CommandSender sender) {
        // Send help message to command sender
    }
}
