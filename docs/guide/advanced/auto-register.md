# 自动注册

这篇文章将会教你如何使用注解让UltiTools帮你完成一系列的、繁琐的注册任务。

## @EnableAutoRegister 注解

在主类添加这一注解，UltiTools 在加载你的模块时会根据你的配置进行自动注册：
```java
@EnableAutoRegister(
    scanPackage = "",     //要扫描的包
    eventListener = true, //是否注册监器
    cmdExecutor = true,   //是否注册执行器
    config = true,        //是否注册配置文件类
)
```

## @ContextEntry 注解

在主类添加这一注解，UltiTools 在加载你的模块时会自动为指定的类注册 Bean：
```java
@ContextEntry(MyBean.class)
```

## @CmdExecutor 注解
带有此注解的 `CommandExecutor` 类在自动注册启用的情况下被自动注册

详情参见 [命令执行器](/guide/essentials/cmd-executor)

## @EventListener 注解

带有此注解的 `Listener` 类在自动注册启用的情况下被自动注册

详情参见 [命令执行器](/guide/essentials/event-listener)