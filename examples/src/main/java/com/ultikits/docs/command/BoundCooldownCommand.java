package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.command.BaseCommandExecutor;
import com.ultikits.ultitools.annotations.command.CmdCD;
import com.ultikits.ultitools.annotations.command.CmdExecutor;
import com.ultikits.ultitools.annotations.command.CmdMapping;
import com.ultikits.ultitools.annotations.command.CmdSender;
import com.ultikits.ultitools.annotations.command.CmdTarget;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

@CmdTarget(CmdTarget.CmdTargetType.PLAYER)
@CmdExecutor(alias = {"boundexample"}, permission = "example.wild")
public class BoundCooldownCommand extends BaseCommandExecutor {

    @Override
    protected void handleHelp(CommandSender sender) {
        sender.sendMessage("/boundexample wild");
    }

    @CmdMapping(format = "wild")
    @CmdCD(config = BoundCooldownConfig.class, key = "features.wild.cooldown")
    public void wild(@CmdSender Player player) {
        // 在这里实现功能；方法抛出异常时，这次执行尝试仍会开始冷却。
    }
}
