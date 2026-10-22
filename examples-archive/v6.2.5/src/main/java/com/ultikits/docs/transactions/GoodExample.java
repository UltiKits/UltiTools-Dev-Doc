package com.ultikits.docs.transactions;

import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;

@Service
public class GoodExample {

    @Autowired
    private BadExample service;  // Inject yourself for external calls

    public void callingMethod() {
        // CORRECT: This goes through the proxy, transaction IS applied
        service.transactionalMethod();
    }

    @Transactional
    public void transactionalMethod() { }
}
