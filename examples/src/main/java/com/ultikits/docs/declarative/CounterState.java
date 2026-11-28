package com.ultikits.docs.declarative;

import com.ultikits.ultitools.abstracts.gui.declarative.core.BuildContext;
import com.ultikits.ultitools.abstracts.gui.declarative.core.State;
import com.ultikits.ultitools.abstracts.gui.declarative.core.Widget;
import com.ultikits.ultitools.abstracts.gui.declarative.widgets.TextButton;
import com.ultikits.ultitools.text.Text;

// 2. Define the State
public class CounterState extends State<CounterWidget> {
    private int count = 0; // persistent across rebuilds

    @Override
    public Widget build(BuildContext context) {
        return TextButton.builder()
            .slot(13)
            .text(Text.plain("Count: " + count))
            .color("BLUE")
            .onClick(click -> setState(() -> count++))
            .build();
    }
}
