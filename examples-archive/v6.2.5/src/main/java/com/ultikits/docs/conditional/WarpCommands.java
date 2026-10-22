package com.ultikits.docs.conditional;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.ConditionalOnConfig;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import org.bukkit.command.CommandSender;

@CmdExecutor(alias = {"warp"}, permission = "myplugin.command.warp")
@ConditionalOnConfig(value = "config/config.yml", path = "enableWarp")
public class WarpCommands extends BaseCommandExecutor {
    // Only registered if enableWarp: true in config.yml

    @Override
    protected void handleHelp(CommandSender sender) {
        sender.sendMessage("/warp");
    }
}
