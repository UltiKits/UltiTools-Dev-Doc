package com.ultikits.ultitools.interfaces;

// Framework interface for the symcheck regression fixture.
// REMOVABLE marks the member that test-symcheck.sh strips to build the
// "trimmed" framework JAR, so the real-missing control has something to find.
public interface Operator<T> {
    T get();

    void removable(); // REMOVABLE
}
