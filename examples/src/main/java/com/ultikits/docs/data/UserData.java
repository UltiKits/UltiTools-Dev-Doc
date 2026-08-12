package com.ultikits.docs.data;

import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.Column;
import com.ultikits.ultitools.annotations.Table;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Table("user_data")
public class UserData extends BaseDataEntity<String> {
    @Column("player_name")
    private String playerName;

    @Column(value = "balance", type = "FLOAT")
    private double balance;
}
