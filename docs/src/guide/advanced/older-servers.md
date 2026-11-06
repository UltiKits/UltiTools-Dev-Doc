# Supporting servers below 1.21

::: info As of v6.4.0 (draft)
This page describes the 6.4.0 compatibility target, not a released compatibility guarantee.
Use the matching framework and module builds; see the [6.4.0 draft release notes](/guide/release-notes/6.4.0).
:::

## Server and framework requirements

As of v6.4.0, the five affected modules (UltiKits, UltiLogin, UltiMail, UltiRemoteBag and UltiTrade) target the framework's supported floor, Paper 1.19.2 build 163 or later. On Minecraft below 1.21 they require UltiTools 6.4.0 or later. With an older framework on those servers, the target behavior is to refuse startup with an upgrade message, rather than fail when a player opens a screen. On Minecraft 1.21 or later, this compatibility requirement does not raise their framework minimum from the 6.3.x line.

These requirements do not mean every server provides the same capabilities. Module-specific degradation is listed in the draft release notes. Plain Spigot is not a supported server target.

## Load-time binary adaptation

As of v6.4.0, UltiTools adapts module bytecode when loading classes. `InventoryView` is an abstract class on Paper 1.19.2–1.20.6 and an interface from 1.21. A module compiled against the interface can otherwise throw `IncompatibleClassChangeError` when its inventory call executes on an older server.

One generic rule aligns invocation kind with the type on the running server, rather than maintaining an `InventoryView`-specific list. The method name, descriptor and receiver remain the same. For example, an interface invocation becomes a virtual invocation when the runtime owner is a class. This repairs the binary shape, not missing methods. No operator configuration switch is required or provided.

The loader foundation is described in [framework PR #806](https://github.com/UltiKits/UltiTools-Reborn/pull/806), and the generic alignment rule in [framework PR #809](https://github.com/UltiKits/UltiTools-Reborn/pull/809).

## Startup diagnostics and limits

As of v6.4.0, each unresolved server-API reference produces a startup `WARNING`, and the module still loads. A warning is not proof that the affected path is usable: calling a missing method can still fail unless the module handles that failure. See [framework PR #810](https://github.com/UltiKits/UltiTools-Reborn/pull/810).

If a bean is skipped because it references an absent server class, a separate consequence warning names the bean, the missing class and the handlers that were not registered. One absent event parameter type can prevent reflection of the whole listener class, so otherwise supported handlers in that same class can also be lost.

The framework does not substitute missing server capabilities, rename events, or isolate handlers inside one class. In particular, loading successfully does not imply that all login protections are available. The module must select a real older equivalent where one exists and document any unavailable protection where none exists.

## Optional listener classes

As of v6.4.0, the module-side pattern is to keep each optional event dependency in a separate listener class, outside every declared `scanBasePackages` string prefix. Keep the common listener free of those optional signature types. Merely guarding a method body does not prevent reflection from resolving its parameter type.

For example, with `scanBasePackages = {"com.example.login"}`, place optional listeners under `com.example.compat.login`, not `com.example.logincompat`. The latter still starts with the scan string. Check every configured prefix, not just the main module package, and do not rely on a dot-boundary assumption.

Probe the event by name before loading or constructing the optional listener:

```java
Class.forName(
        "io.papermc.paper.event.player.PlayerPickItemEvent",
        false,
        getClass().getClassLoader());
```

Only after this probe succeeds should the module load, construct and manually register the separate listener. Keep registration code that directly refers to the optional event behind that boundary as well. An absent class means selecting an actual older equivalent or emitting a named warning; it does not authorize pretending the protection exists. Remove manually registered listeners during module unload.

[UltiLogin PR #84](https://github.com/UltiKits/UltiLogin/pull/84) and [PR #85](https://github.com/UltiKits/UltiLogin/pull/85) apply this pattern using `com.ultikits.plugins.compat.login`, outside the `com.ultikits.plugins.login` scan prefix. The module probes pick-item and sign-open independently and selects either the modern or legacy mount listener, never both.

## Verification scope

As of v6.4.0, binary adaptation and startup warnings are not a substitute for testing the module's actions on the server versions it supports. Verify normal screens, event-driven protections and fallback item returns independently. The linked implementation PRs and their tests describe the current work; this draft does not claim that the final cross-version real-server acceptance matrix has passed.
