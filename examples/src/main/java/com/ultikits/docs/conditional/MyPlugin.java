package com.ultikits.docs.conditional;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.UltiToolsModule;

@UltiToolsModule(scanBasePackages = {"com.ultikits.docs.conditional"})
public class MyPlugin extends UltiToolsPlugin {
    @Override
    public boolean registerSelf() { return true; }

    @Override
    public void unregisterSelf() { }
}
