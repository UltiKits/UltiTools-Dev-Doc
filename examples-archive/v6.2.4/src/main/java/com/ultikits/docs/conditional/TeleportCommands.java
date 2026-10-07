package com.ultikits.docs.conditional;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.ConditionalOnConfig;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import org.bukkit.command.CommandSender;

@CmdExecutor(alias = {"tp"}, permission = "myplugin.teleport")
@ConditionalOnConfig(value = "config/config.yml", path = "features.teleport.enabled")
public class TeleportCommands extends BaseCommandExecutor {

    @Override
    protected void handleHelp(CommandSender sender) {
        sender.sendMessage("/tp");
    }
}
