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
public class LoggingExceptionHandler implements ExceptionHandler {

    @Override
    public Object handleException(Throwable exception, Object target, Method method, Object[] args) {
        // Log detailed exception information
        System.out.println("Exception in: " + method.getDeclaringClass().getSimpleName() + "." + method.getName());
        System.out.println("Message: " + exception.getMessage());
        exception.printStackTrace();
        return null;
    }

    @Override
    public boolean supports(Class<? extends Throwable> exceptionType) {
        // This handler supports any exception
        return true;
    }
}
