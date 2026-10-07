package com.ultikits.docs.transactions;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;
import com.ultikits.ultitools.interfaces.DataOperator;

@Service
public class ComplexService {

    @Autowired
    private UltiToolsPlugin plugin;

    // Declarative for simple method-level transactions
    @Transactional
    public void simpleOperation() {
        // Automatic transaction management
    }

    // Programmatic for complex multi-step workflows
    public void complexWorkflow() {
        DataOperator<AccountEntity> dataOp = plugin.getDataOperator(AccountEntity.class);

        // Explicit transaction with fine-grained control
        dataOp.transaction(() -> {
            // Multiple coordinated operations
            step1();
            step2();
            step3();
        });
    }

    private void step1() { }

    private void step2() { }

    private void step3() { }
}
