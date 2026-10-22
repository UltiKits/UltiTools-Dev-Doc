package com.ultikits.docs.quickstart;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.abstracts.data.AuditableDataEntity;
import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.*;
import com.ultikits.ultitools.interfaces.DataOperator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.bukkit.entity.Player;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// This annotation is required for automatic registration
@EnableAutoRegister(scanPackage = "com.ultikits.docs.quickstart")
public class UltiToolsConnector extends UltiToolsPlugin {

    // If you need to connect to UltiTools-API, you need to override this constructor with parameters,
    // the other one without parameters is for module development.
    // Please do not use the constructor without parameters here
    public UltiToolsConnector(String pluginName, String version, List<String> authors, List<String> loadAfter, int minUltiToolsVersion, String mainClass, String resourceFolderPath) {
      super(pluginName, version, authors, loadAfter, minUltiToolsVersion, mainClass, resourceFolderPath);
    }
    @Override
    public boolean registerSelf() {
        // Executed when the module is started
        // If false is returned, UltiTools will not load this module
        return true;
    }

    @Override
    protected void onUnregister() {
        // Optional,
        // if you only need to unregister all commands and listeners,
        // you don't need to override this method
        // Executed when the module is unregistered
    }

    @Override
    protected void onReload() {
        // Optional,
        // if you only need to reload the module configuration file,
        // you don't need to override this method
        // Executed when the module is reloaded
    }
}
