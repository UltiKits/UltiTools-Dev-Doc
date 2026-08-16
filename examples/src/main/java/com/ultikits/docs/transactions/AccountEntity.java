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
@Table("account_data")
public class AccountEntity extends BaseDataEntity<String> {
    @Column("player_id")
    private String playerId;

    @Column(value = "balance", type = "DOUBLE")
    private double balance;
}
