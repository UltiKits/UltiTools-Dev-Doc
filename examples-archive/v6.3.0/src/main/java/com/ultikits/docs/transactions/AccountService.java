package com.ultikits.docs.transactions;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;
import com.ultikits.ultitools.interfaces.DataOperator;

@Service
public class AccountService {

    @Autowired
    private UltiToolsPlugin plugin;

    @Transactional
    public void transfer(String fromPlayerId, String toPlayerId, double amount) {
        DataOperator<AccountEntity> dataOperator =
            plugin.getDataOperator(AccountEntity.class);

        AccountEntity from = dataOperator.query()
            .where("playerId").eq(fromPlayerId).first();
        AccountEntity to = dataOperator.query()
            .where("playerId").eq(toPlayerId).first();

        from.setBalance(from.getBalance() - amount);
        to.setBalance(to.getBalance() + amount);

        try {
            dataOperator.update(from);
            dataOperator.update(to);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }
}
