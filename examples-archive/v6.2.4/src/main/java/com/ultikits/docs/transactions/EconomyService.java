package com.ultikits.docs.transactions;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.interfaces.DataOperator;

@Service
public class EconomyService {

    @Autowired
    private UltiToolsPlugin plugin;

    public boolean transfer(String fromUuid, String toUuid, double amount) {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);

        try {
            dataOperator.transaction(() -> {
                AccountEntity from = dataOperator.query()
                    .where("playerId").eq(fromUuid).first();
                AccountEntity to = dataOperator.query()
                    .where("playerId").eq(toUuid).first();

                if (from == null || to == null) {
                    throw new RuntimeException("Account not found");
                }
                if (from.getBalance() < amount) {
                    throw new RuntimeException("Insufficient balance");
                }

                from.setBalance(from.getBalance() - amount);
                to.setBalance(to.getBalance() + amount);

                try {
                    dataOperator.update(from);
                    dataOperator.update(to);
                } catch (IllegalAccessException e) {
                    throw new RuntimeException(e);
                }
            });
            return true;
        } catch (Exception e) {
            // Transaction rolled back automatically
            return false;
        }
    }
}
