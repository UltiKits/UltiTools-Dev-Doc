package com.ultikits.docs.transactions;

import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;

@Service
public class BadExample {

    @Transactional
    public void transactionalMethod() { }

    public void callingMethod() {
        // WRONG: This bypasses the proxy, transaction NOT applied
        this.transactionalMethod();
    }
}
