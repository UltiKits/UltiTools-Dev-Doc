package com.ultikits.docs.transactions;

import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;

@Service
public class PaymentService {
    @Transactional
    public void processPayment(String playerId, double amount) {
        // This method will be wrapped in a transaction automatically
    }
}
