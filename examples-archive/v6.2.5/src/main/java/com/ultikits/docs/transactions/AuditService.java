package com.ultikits.docs.transactions;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.annotations.Autowired;
import com.ultikits.ultitools.annotations.Propagation;
import com.ultikits.ultitools.annotations.Service;
import com.ultikits.ultitools.annotations.Transactional;
import com.ultikits.ultitools.interfaces.DataOperator;

@Service
public class AuditService {

    @Autowired
    private UltiToolsPlugin plugin;

    // This method always gets its own transaction, even if called from another transactional method
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAudit(String message) {
        DataOperator<AuditLogEntity> dataOperator =
            plugin.getDataOperator(AuditLogEntity.class);
        AuditLogEntity log = AuditLogEntity.builder()
            .message(message)
            .timestamp(System.currentTimeMillis())
            .build();
        dataOperator.insert(log);
    }
}
