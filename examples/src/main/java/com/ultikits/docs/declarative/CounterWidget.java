package com.ultikits.docs.declarative;

import com.ultikits.ultitools.abstracts.gui.declarative.core.State;
import com.ultikits.ultitools.abstracts.gui.declarative.core.StatefulWidget;

// 1. Define the Widget
public class CounterWidget extends StatefulWidget {
    @Override
    public State<CounterWidget> createState() {
        return new CounterState();
    }
}
