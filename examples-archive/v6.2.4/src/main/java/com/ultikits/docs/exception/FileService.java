package com.ultikits.docs.exception;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.*;
import com.ultikits.ultitools.aop.ExceptionHandler;
import com.ultikits.ultitools.interfaces.DataOperator;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FileService {

    @ExceptionCatch
    // @ExceptionCatch is runtime AOP. It catches the exception when the method
    // is invoked through the proxy, but javac still requires a checked exception
    // to be declared, so `throws IOException` is not optional here.
    public String readFile(String path) throws IOException {
        // If any exception occurs, it will be caught and logged
        // The method returns null
        return new String(Files.readAllBytes(Paths.get(path)));
    }
}
