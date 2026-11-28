package com.ultikits.docs.command;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;

import java.io.IOException;
import java.util.List;

public class UltiToolsConnector extends UltiToolsPlugin {

    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath) {
        super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass, resourceFolderPath);
    }

    @Override
    public boolean registerSelf() throws IOException {
        // register command
        getCommandManager().register(this, ExampleCommand.class);
        return true;
    }
}
