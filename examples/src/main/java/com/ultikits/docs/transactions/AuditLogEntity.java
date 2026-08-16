package com.ultikits.docs.transactions;

import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.Column;
import com.ultikits.ultitools.annotations.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("audit_log")
public class AuditLogEntity extends BaseDataEntity<String> {
    @Column("message")
    private String message;

    @Column(value = "timestamp", type = "BIGINT")
    private long timestamp;
}
