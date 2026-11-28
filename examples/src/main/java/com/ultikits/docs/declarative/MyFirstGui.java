package com.ultikits.docs.declarative;

import com.ultikits.ultitools.abstracts.gui.declarative.core.BuildContext;
import com.ultikits.ultitools.abstracts.gui.declarative.core.Widget;
import com.ultikits.ultitools.abstracts.gui.declarative.engine.DeclarativeGui;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.Container;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.TextButton;
import com.ultikits.ultitools.scheduling.Scheduler;
import com.ultikits.ultitools.text.Text;
import com.ultikits.ultitools.ui.UiService;
import org.bukkit.entity.Player;

public class MyFirstGui extends DeclarativeGui {

    public MyFirstGui(UiService ui, Scheduler scheduler, Player player) {
        super(ui, scheduler, player, "my_first_gui", Text.plain("Hello GUI"), 2);
    }

    @Override
    public Widget build(BuildContext context) {
        // Return the root widget
        return Container.builder()
            .child(
                TextButton.builder()
                    .text(Text.plain("Click Me!"))
                    .color("GREEN")
                    .slot(13)
                    .onClick(click -> click.viewer().sendMessage("You clicked the button!"))
                    .build()
            )
            .build();
    }
}
