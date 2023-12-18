# IOC 容器

IOC 的全称为 Inversion of Control （反转控制），意在将依赖的创建和管理交由容器，而不是让开发者手动完成。

UltiTools 整合了 Spring IOC 容器，你无需手动维护各个对象的依赖关系，降低模块代码的耦合性。

如果你接触过 Spring 开发，你将会对下面的内容感到十分熟悉。

::: warning 局限性
继承或实现了服务端相关类或接口的类不可注册为Bean，因此也不可使用自动注入。

监听器和执行器类使用了在注册时调用了 `autowireBean()` 来模拟支持自动注入，但不支持构造函数注入。
:::

## 模块容器

每个模块都有一个独立的上下文容器 `Context`，你可以使用主类的 `getContext()` 方法获取到。

该 `Context` 与 Spring 的 `AnnotationConfigApplicationContext` 一致，具体使用方法可查阅官网文档，本文仅涉及基本的用法。

所有模块的上下文容器都使用了一个公共的容器作为父容器，该父容器拥有一些 UltiTools 的公共 Bean，也有可能存在其他模块注册的公共 Bean。

## Bean注册
### 手动注册

你可以直接使用容器对象的 `register()` 方法进行注册：

```java
context.register(MyBean.class);
context.refresh();              //别忘记刷新上下文
```

### 自动扫描
在上述示例中的 `MyBean` 类添加了 `@ConpomentScan(...)` 注解，那么在该Bean注册后会自动扫描并注册给定包名下所有类的 Bean

## 依赖获取

### 手动获取

如果我需要从容器获取某个依赖，仅需调用容器对象的 `getBean()` 方法即可：

```java
MyBean myBean = context.getBean(MyBean.class);
```

### 自动注入

如果你的类受容器管理，那么可以使用自动注入：

```java
@Autowired
MyBean myBean;                  //字段注入

public MyClass(MyBean myBean) {
    this.myBean = MyBean;       //构造函数注入
}
```