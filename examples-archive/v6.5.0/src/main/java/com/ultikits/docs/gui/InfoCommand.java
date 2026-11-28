package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdMapping;
import com.ultikits.ultitools.annotations.command.CmdSender;
import com.ultikits.ultitools.annotations.command.CmdTarget;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(alias = {"info"}, permission = "ultikits.info")
public class InfoCommand extends BaseCommandExecutor {

    @CmdMapping(format = "")
    public void showInfo(@CmdSender Player player) {
        InfoGui gui = new InfoGui(player);
        gui.open();  // Display to player
    }

    @Override
    protected void handleHelp(CommandSender sender) { }
}
